import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Taking an address off the suppression list.
//
// Suppressions are written by /api/resend-webhook when a message hard-bounces or
// somebody reports it as spam, and nothing sends to a suppressed address again.
// That is right by default and wrong occasionally — a mailbox that was full has
// been emptied, a typo'd domain now resolves — so an admin can lift one. The
// audit trigger on the table records who did.

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const email = url.searchParams.get('email')?.trim().toLowerCase();
	if (!email) error(400, 'Missing email address.');

	const { error: dbError } = await ctx.db.from('email_suppressions').delete().eq('email', email);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `lifted the mail suppression on ${email}`, {
		table: 'email_suppressions',
		recordId: email
	});
	return json({ ok: true });
};
