import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// Application review. Applicants can read only their own rows and cannot touch
// `status`, so the TIC team reads and moves them through review from here.

const STATUSES = ['submitted', 'under-review', 'accepted', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

const BUCKET = 'application-documents';

// 'submitted' is the state an application arrives in, so moving one back to it
// is an internal correction rather than news for the applicant.
const TEMPLATE_FOR: Partial<Record<Status, string>> = {
	'under-review': 'application-under-review',
	accepted: 'application-accepted',
	rejected: 'application-rejected'
};

type DocumentEntry = { path: string; name: string; size: number };

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		applicantMessage?: string;
		reviewNote?: string;
	};
	if (!body.id) error(400, 'Missing application id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	const { data: application, error: dbError } = await ctx.db
		.from('applications')
		.update({
			status: body.status,
			applicant_message: body.applicantMessage?.trim() || null,
			review_note: body.reviewNote?.trim() || null,
			reviewed_at: new Date().toISOString()
		})
		.eq('id', body.id)
		.select('email, full_name, startup_name, applicant_message')
		.maybeSingle();
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `moved application to ${body.status}`, {
		table: 'applications',
		recordId: body.id
	});

	// The applicant hears about the decision here. sendTemplateEmail() never
	// throws, so a mail problem cannot turn a completed review into a 500.
	const templateKey = TEMPLATE_FOR[body.status as Status];
	let email: { status: string; error: string | null } | null = null;

	if (templateKey && application?.email) {
		const result = await sendTemplateEmail({
			templateKey,
			to: application.email as string,
			toName: (application.full_name as string) ?? '',
			variables: {
				fullName: (application.full_name as string) ?? '',
				startupName: (application.startup_name as string) ?? '',
				note: (application.applicant_message as string) ?? ''
			},
			context: { table: 'applications', recordId: body.id, status: body.status },
			sentBy: ctx.admin.userId
		});
		email = { status: result.status, error: result.error };
	}

	return json({ ok: true, email });
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
