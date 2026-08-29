import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Every company-posted job, including those from pending or rejected companies,
// which the public jobs policy hides.

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing job id.');

	const { error: dbError } = await ctx.db.from('jobs').delete().eq('id', id);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, 'removed a job posting', { table: 'jobs', recordId: id });
	return json({ ok: true });
};
