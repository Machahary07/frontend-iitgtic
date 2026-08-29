import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import type { RequestHandler } from './$types';

// Company moderation. `status` and `rejection_reason` are not granted to the
// authenticated role in the schema, so this service-role route is the only way
// an account can be verified or rejected.

const STATUSES = ['pending', 'verified', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		rejectionReason?: string;
	};
	if (!body.id) error(400, 'Missing company id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	const { error: dbError } = await ctx.db
		.from('companies')
		.update({
			status: body.status,
			rejection_reason: body.status === 'rejected' ? (body.rejectionReason ?? '') : null
		})
		.eq('id', body.id);
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `set company status to ${body.status}`, {
		table: 'companies',
		recordId: body.id
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing company id.');

	await logAdminAction(ctx, 'deleted a company account', {
		table: 'companies',
		recordId: id
	});

	// companies.id references auth.users on delete cascade, and jobs.company_id
	// cascades from companies — so removing the auth user clears all three.
	const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
	if (authError) error(500, authError.message);
	return json({ ok: true });
};
