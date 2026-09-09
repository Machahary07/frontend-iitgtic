import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { verifyUnsubscribe } from '$lib/server/newsletter';
import type { PageServerLoad } from './$types';

// Public newsletter unsubscribe — one click, no confirmation step. The link in
// the email carries the address and its signature; opening it removes the
// address straight away and lands on a plain confirmation. The signature is what
// stops anyone unsubscribing anyone, and setting unsubscribed_at is idempotent,
// so a second open (or a mail client pre-fetching the link) is a harmless no-op.

export const load: PageServerLoad = async ({ url }) => {
	const email = url.searchParams.get('e')?.trim().toLowerCase() ?? '';
	const token = url.searchParams.get('t') ?? '';

	if (!verifyUnsubscribe(email, token)) return { email, status: 'invalid' as const };

	const { error } = await supabaseAdmin
		.from('newsletter_subscribers')
		.update({ unsubscribed_at: new Date().toISOString() })
		.eq('email', email)
		.is('unsubscribed_at', null);
	if (error) return { email, status: 'error' as const };

	return { email, status: 'ok' as const };
};
