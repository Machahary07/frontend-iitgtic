import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Application review. Applicants can read only their own rows and cannot touch
// `status`, so the TIC team reads and moves them through review from here.

const STATUSES = ['submitted', 'under-review', 'accepted', 'rejected'] as const;
type Status = (typeof STATUSES)[number];


const BUCKET = 'application-documents';

type DocumentEntry = { path: string; name: string; size: number };

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
		.from('applications')
		.update({
			status: body.status,
			review_note: body.reviewNote?.trim() || null,
			reviewed_at: new Date().toISOString()
		})
		.eq('id', body.id);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `moved application to ${body.status}`, {
		table: 'applications',
		recordId: body.id
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing application id.');

	// Remove the uploaded files first — deleting the row would orphan them.
	const { data: row } = await ctx.db
		.from('applications')
		.select('documents')
		.eq('id', id)
		.maybeSingle();

	const paths = Object.values((row?.documents ?? {}) as Record<string, DocumentEntry>)
		.map((d) => d?.path)
		.filter((p): p is string => Boolean(p));

	if (paths.length > 0) await supabaseAdmin.storage.from(BUCKET).remove(paths);

	await logAdminAction(ctx, 'deleted an application', { table: 'applications', recordId: id });

	const { error: dbError } = await ctx.db.from('applications').delete().eq('id', id);
	if (dbError) error(500, dbError.message);

	return json({ ok: true });
};
