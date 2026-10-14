import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { reviewScope } from '$lib/server/applicationReview';
import type { RequestHandler } from './$types';

// "Allow reapplying now": admin lifts the wait on a rejected application, so
// its startup may apply again straight away. The insert policy reads
// reapply_allowed_at as well as the founder console.

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	if (reviewScope(ctx.admin) !== 'admin') error(403, 'Not allowed.');

	const body = (await request.json().catch(() => ({}))) as { id?: string };
	if (!body.id) error(400, 'Missing application id.');

	const { data, error: dbError } = await ctx.db
		.from('applications')
		.update({ reapply_allowed_at: new Date().toISOString() })
		.eq('id', body.id)
		.eq('status', 'rejected')
		.select('id')
		.maybeSingle();
	if (dbError) error(500, dbError.message);
	if (!data) error(409, 'Only a rejected application has a wait to lift.');

	await logAdminAction(ctx, 'allowed a rejected startup to reapply now', {
		table: 'applications',
		recordId: body.id
	});

	return json({ ok: true });
};
