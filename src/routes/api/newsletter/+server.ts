import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { LIMITS, retryMinutes, withinLimit } from '$lib/server/rateLimit';
import { EMAIL_RE } from '$lib/utils/jobApplications';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// Footer newsletter signup.
//
// No Turnstile here, deliberately: the widget would have to load on every page
// of the site to guard one optional field. A new subscriber gets one welcome
// email, and only the first time an address is added — the unique index means
// subscribing someone again sends nothing, so an address can be mailed this way
// at most once. The per-IP limit and that index are the brakes.

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!(await withinLimit('newsletter', getClientAddress()))) {
		error(429, `Too many requests. Try again in ${retryMinutes(LIMITS.newsletter)} minutes.`);
	}

	const body = (await request.json().catch(() => ({}))) as { email?: string };
	const email = body.email?.trim().toLowerCase() ?? '';

	if (!EMAIL_RE.test(email)) error(400, 'Enter a valid email address.');
	if (email.length > 254) error(400, 'That address is too long.');

	const { error: dbError } = await supabaseAdmin
		.from('newsletter_subscribers')
		.insert({ email, source: 'footer' });

	// 23505 is the unique index doing its job. Subscribing twice is not a
	// failure, and saying so would confirm the address is already on the list.
	if (dbError && dbError.code !== '23505') {
		console.error('[newsletter] insert failed:', dbError.message);
		error(500, 'Could not save that just now. Please try again.');
	}

	if (!dbError) {
		await sendTemplateEmail({
			templateKey: 'newsletter-welcome',
			to: email,
			context: { table: 'newsletter_subscribers' }
		});
	}

	return json({ ok: true }, { status: 201 });
};
