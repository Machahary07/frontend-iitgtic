import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { adminAlertRecipient, formatEventTime, sendTemplateEmail } from '$lib/server/email';
import { issueTicAdminSession, clearTicAdminSession } from '$lib/server/ticAdminSession';
import { issueFounderSession, clearFounderSession } from '$lib/server/founderSession';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';
import { currentAccount } from '$lib/server/sessionValidation';
import { verifyTurnstile } from '$lib/server/turnstile';
import { stopViewAs } from '$lib/server/viewAs';
import { isStaffRole, roleLabel } from '$lib/utils/roles';

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

	const body = (await request.json().catch(() => ({}))) as { accessToken?: string; captchaToken?: string };
	if (!(await verifyTurnstile(body.captchaToken, getClientAddress()))) error(400, 'Verification failed. Please try again.');
	if (!body.accessToken) error(400, 'Missing access token.');

	const { data, error: authError } = await supabaseAdmin.auth.getUser(body.accessToken);
	if (authError || !data.user) {
		return json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 });
	}

	const profile = await currentAccount(data.user.id);
	if (!profile) error(403, 'This account is unavailable.');
	const { name, email } = profile;

	// --- TIC team ------------------------------------------------------------
	// A fresh sign-in is never still viewing as someone.
	stopViewAs(cookies);

	if (isStaffRole(profile.role)) {
		const session = { userId: data.user.id, email, name };
		issueTicAdminSession(cookies, session);
		// An admin who also runs a startup would otherwise carry a stale founder
		// cookie into the console; clear it so the two never overlap by accident.
		clearFounderSession(cookies);

		await supabaseAdmin.from('audit_log').insert({
			source: 'app',
			actor_id: session.userId,
			actor_label: `${name || email} (${roleLabel(profile.role)})`,
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
	stopViewAs(cookies);
	clearTicAdminSession(cookies);
	clearFounderSession(cookies);
	return json({ ok: true });
};
