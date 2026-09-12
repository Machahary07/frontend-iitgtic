import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { adminAlertRecipient, formatEventTime, sendTemplateEmail } from '$lib/server/email';
import { issueTicAdminSession, clearTicAdminSession } from '$lib/server/ticAdminSession';
import { issueFounderSession, clearFounderSession } from '$lib/server/founderSession';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// The one door. /login authenticates the credentials with supabase-js and hands
// the resulting access token here; this route reads the profile, decides which
// console the person belongs in, issues the matching signed cookie and says
// where to go. The browser never gets to choose its own role.
//
// POST   { accessToken }  sign in, returns { role, redirect }
// DELETE                  sign out of both consoles

export type LoginRole = 'admin' | 'founder';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	if (!(await withinLimit('adminLogin', getClientAddress()))) {
		error(
			429,
			`Too many sign-in attempts. Try again in ${retryMinutes(LIMITS.adminLogin)} minutes.`
		);
	}

	const body = (await request.json().catch(() => ({}))) as { accessToken?: string };
	if (!body.accessToken) error(400, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(body.accessToken);
	if (authError || !data.user) {
		return json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 });
	}

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('role, full_name, email, company_id, member_role, member_status')
		.eq('id', data.user.id)
		.maybeSingle();

	const name = (profile?.full_name as string) || '';
	const email = (profile?.email as string) || data.user.email || '';

	// --- TIC team ------------------------------------------------------------
	if (profile?.role === 'admin') {
		const session = { userId: data.user.id, email, name };
		issueTicAdminSession(cookies, session);
		// An admin who also runs a startup would otherwise carry a stale founder
		// cookie into the console; clear it so the two never overlap by accident.
		clearFounderSession(cookies);

		await supabaseAdmin.from('audit_log').insert({
			source: 'app',
			actor_id: session.userId,
			actor_label: `${name || email} (admin)`,
			action: 'signed in to the admin console'
		});

		await sendTemplateEmail({
			templateKey: 'admin-signin-alert',
			to: adminAlertRecipient(),
			variables: { adminName: name || email, adminEmail: email, loginTime: formatEventTime() },
			context: { table: 'profiles', recordId: session.userId }
		});

		return json({ ok: true, role: 'admin' as LoginRole, redirect: '/tic-admin', name, email });
	}

	// --- founders and the people they add ------------------------------------
	// A company row may exist without profiles.company_id being set on an account
	// created before this console did, so the company is looked up by id as well.
	let companyId = (profile?.company_id as string | null) ?? null;
	if (!companyId) {
		const { data: company } = await supabaseAdmin
			.from('companies')
			.select('id')
			.eq('id', data.user.id)
			.maybeSingle();
		if (company) {
			companyId = company.id as string;
			await supabaseAdmin
				.from('profiles')
				.update({ company_id: companyId, member_role: 'owner', member_status: 'approved' })
				.eq('id', data.user.id);
		}
	}

	const session = {
		userId: data.user.id,
		email,
		name,
		companyId,
		memberRole: ((profile?.member_role as string) === 'member' ? 'member' : 'owner') as
			'owner' | 'member',
		memberStatus: ((profile?.member_status as string) ?? 'approved') as
			'pending' | 'approved' | 'rejected'
	};
	issueFounderSession(cookies, session);
	clearTicAdminSession(cookies);

	await supabaseAdmin.from('audit_log').insert({
		source: 'app',
		actor_id: session.userId,
		actor_label: `${name || email} (founder)`,
		action: 'signed in to the founder console'
	});

	return json({ ok: true, role: 'founder' as LoginRole, redirect: '/founder', name, email });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	clearTicAdminSession(cookies);
	clearFounderSession(cookies);
	return json({ ok: true });
};
