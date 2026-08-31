import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Role applicants. public.job_applications has RLS on with no policies, so this
// service-role route is the only way the table is read back or moved along.

const STATUSES = ['new', 'shortlisted', 'forwarded', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

const BUCKET = 'job-applications';

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		reviewNote?: string;
	};
	if (!body.id) error(400, 'Missing application id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	const { error: dbError } = await ctx.db
		.from('job_applications')
		.update({
			status: body.status,
			review_note: body.reviewNote?.trim() || null,
			reviewed_at: new Date().toISOString()
		})
		.eq('id', body.id);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `moved role applicant to ${body.status}`, {
		table: 'job_applications',
		recordId: body.id
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing application id.');

	// The resume is only reachable through this row, so it goes first — deleting
	// the row on its own would orphan the object in the bucket.
	const { data: row } = await ctx.db
		.from('job_applications')
		.select('resume')
		.eq('id', id)
		.maybeSingle();

	const path = (row?.resume as { path?: string } | null)?.path;
	if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);

	await logAdminAction(ctx, 'deleted a role applicant', {
		table: 'job_applications',
		recordId: id
	});

	const { error: dbError } = await ctx.db.from('job_applications').delete().eq('id', id);
	if (dbError) error(500, dbError.message);

	return json({ ok: true });
};
