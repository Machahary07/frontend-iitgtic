import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// The newsletter list. A list nobody can read is a list nobody can use, so the
// console can pull it for export and remove an address on request.

export const GET: RequestHandler = async ({ cookies }) => {
	const ctx = requireAdmin(cookies);

	const { data, error: dbError } = await ctx.db
		.from('newsletter_subscribers')
		.select('id, email, source, created_at')
		.is('unsubscribed_at', null)
		.order('created_at', { ascending: false });
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, 'exported the newsletter list', {
		table: 'newsletter_subscribers'
	});

	return json({ subscribers: data ?? [] });
};

// Someone asking to come off the list is not a soft preference — the row goes.
export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const email = url.searchParams.get('email')?.trim().toLowerCase();
	if (!email) error(400, 'Missing email address.');

	const { error: dbError } = await ctx.db
		.from('newsletter_subscribers')
		.delete()
		.eq('email', email);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `removed ${email} from the newsletter list`, {
		table: 'newsletter_subscribers'
	});
	return json({ ok: true });
};
