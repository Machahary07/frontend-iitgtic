import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import {
	adminAlertRecipient,
	emailConfig,
	formatEventTime,
	sendTemplateEmail
} from '$lib/server/email';
import { verifyEmailUrl } from '$lib/server/emailVerify';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// Welcome + confirm-your-email. Called by the browser right after signup, and
// again when someone on the application asks to have the link resent.
//
// Authenticated by the founder's access token — the recipient and the id inside
// the verify link both come from the authenticated user, never from the request,
// so this cannot be pointed at someone else's address. Already-verified accounts
// are a no-op, so a stray "resend" costs nothing.

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!(await withinLimit('founderWelcome', getClientAddress()))) {
		error(429, `Too many requests. Try again in ${retryMinutes(LIMITS.founderWelcome)} minutes.`);
	}

	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !auth.user) error(401, 'Invalid session.');

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('full_name, email, phone, email_verified')
		.eq('id', auth.user.id)
		.maybeSingle();

	// Nothing to confirm — don't send a "please confirm" to someone already done.
	if (profile?.email_verified) return json({ ok: true });

	const to = (profile?.email as string) || auth.user.email || '';
	if (!to) return json({ ok: true });

	const fullName =
		(profile?.full_name as string) || (auth.user.user_metadata?.full_name as string) || '';

	await sendTemplateEmail({
		templateKey: 'founder-welcome',
		to,
		toName: fullName,
		variables: {
			fullName,
			verifyUrl: verifyEmailUrl(emailConfig().siteUrl, auth.user.id)
		},
		context: { table: 'profiles', recordId: auth.user.id }
	});

	// Tell the operating inbox a new applicant signed up — once per account, keyed
	// on the user id, so a later "resend" of the confirm link never re-alerts the
	// team.
	const { count } = await supabaseAdmin
		.from('email_log')
		.select('id', { count: 'exact', head: true })
		.eq('template_key', 'new-applicant-alert')
		.eq('context->>recordId', auth.user.id);

	if ((count ?? 0) === 0) {
		await sendTemplateEmail({
			templateKey: 'new-applicant-alert',
			to: adminAlertRecipient(),
			variables: {
				fullName,
				email: to,
				phone: (profile?.phone as string) ?? '',
				signupTime: formatEventTime()
			},
			context: { table: 'profiles', recordId: auth.user.id }
		});
	}

	return json({ ok: true });
};
