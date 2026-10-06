import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Company moderation. `status` and `rejection_reason` are not granted to the
// authenticated role in the schema, so this service-role route is the only way
// an account can be verified or rejected.

const STATUSES = ['pending', 'verified', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		rejectionReason?: string;
	};
	if (!body.id) error(400, 'Missing company id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	const { data: company, error: dbError } = await ctx.db
		.from('companies')
		.update({
			status: body.status,
			rejection_reason: body.status === 'rejected' ? (body.rejectionReason ?? '') : null
		})
		.eq('id', body.id)
		.select('id')
		.maybeSingle();
	if (dbError) error(500, dbError.message);
	if (!company) error(404, 'Company not found.');

	await logAdminAction(ctx, `set company status to ${body.status}`, {
		table: 'companies',
		recordId: body.id
	});

	// No email here: a startup hears about incubation through its application
	// (application-accepted), which is also what verifies the company now.
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = await requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing company id.');

	await logAdminAction(ctx, 'deleted a company', {
		table: 'companies',
		recordId: id
	});

	// The company is deleted, not the founder who created it: one person may run
	// several, and removing their login because one startup was withdrawn would
	// take the others with it. Deleting the account itself is /api/tic-admin/users.
	//
	// jobs.company_id cascades from here. Resumes and any incubation application
	// are deliberately left: both are `on delete set null`, so TIC's record of
	// what it reviewed outlives the company.
	const { error: dbError } = await ctx.db.from('companies').delete().eq('id', id);
	if (dbError) error(500, dbError.message);
	return json({ ok: true });
};
