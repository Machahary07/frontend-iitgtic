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
		.select('role, full_name, email')
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

	// --- founders -------------------------------------------------------------
	// There is no third case. Every non-admin account is a founder: which
	// companies they hold, and whether TIC has verified them, is looked up per
	// request by the console rather than frozen into a cookie here.
	const session = { userId: data.user.id, email, name };
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
