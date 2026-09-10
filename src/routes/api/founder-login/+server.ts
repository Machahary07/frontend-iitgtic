import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { formatEventTime, sendTemplateEmail } from '$lib/server/email';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

// "Welcome back" / new-sign-in notice for a founder. Authenticated by the
// founder's access token, and the recipient is read from the account, not the
// request.
//
// Throttled to at most once per 24h per address: a founder fills the eight-step
// application over several sittings, so mailing on every single sign-in would be
// noise and would burn the plan allowance. The IP rate limit only stops abuse.

const THROTTLE_MS = 24 * 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!(await withinLimit('founderLogin', getClientAddress()))) {
		error(429, `Too many requests. Try again in ${retryMinutes(LIMITS.founderLogin)} minutes.`);
	}

	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) error(401, 'Missing access token.');

	const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
	if (authError || !auth.user) error(401, 'Invalid session.');

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('full_name, email')
		.eq('id', auth.user.id)
		.maybeSingle();

	const to = (profile?.email as string) || auth.user.email || '';
	if (!to) return json({ ok: true });

	// At most one notice a day: skip if we already sent one to this address inside
	// the window.
	const since = new Date(Date.now() - THROTTLE_MS).toISOString();
	const { count } = await supabaseAdmin
		.from('email_log')
		.select('id', { count: 'exact', head: true })
		.eq('template_key', 'founder-login')
		.eq('to_email', to)
		.gte('created_at', since);
	if ((count ?? 0) > 0) return json({ ok: true });

	await sendTemplateEmail({
		templateKey: 'founder-login',
		to,
		toName: (profile?.full_name as string) || '',
		variables: {
			fullName: (profile?.full_name as string) ?? '',
			loginTime: formatEventTime()
		},
		context: { table: 'profiles', recordId: auth.user.id }
	});

	return json({ ok: true });
};
