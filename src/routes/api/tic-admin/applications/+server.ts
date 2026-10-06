import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import { canSeeApplication, reviewScope } from '$lib/server/applicationReview';
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
	const ctx = await requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		applicantMessage?: string;
		reviewNote?: string;
	};
	if (!body.id) error(400, 'Missing application id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	// Admin decides; the CEO may also turn one down while it is with them.
	// Nobody else changes status — coordinators and heads sign off instead.
	const scope = reviewScope(ctx.admin);
	const rejecting = body.status === 'rejected';
	if (scope !== 'admin' && !(rejecting && scope === 'ceo')) error(403, 'Not allowed.');
	if (!(await canSeeApplication(ctx.db, ctx.admin, body.id))) error(404, 'Application not found.');

	const { data: current } = await ctx.db
		.from('applications')
		.select('review_stage')
		.eq('id', body.id)
		.maybeSingle();
	if (!current) error(404, 'Application not found.');
	const stage = current.review_stage as number;

	// The final email goes out only once every assigned head has signed off.
	if (body.status === 'accepted') {
		const { count: heads } = await ctx.db
			.from('application_reviewers')
			.select('id', { count: 'exact', head: true })
			.eq('application_id', body.id)
			.eq('kind', 'head');
		const { count: pending } = await ctx.db
			.from('application_reviewers')
			.select('id', { count: 'exact', head: true })
			.eq('application_id', body.id)
			.eq('kind', 'head')
			.is('done_at', null);
		if (stage < 5 || !heads || pending) error(409, 'Every assigned TIC head has to sign off first.');
	}

	const { data: application, error: dbError } = await ctx.db
		.from('applications')
		.update({
			status: body.status,
			applicant_message: body.applicantMessage?.trim() || null,
			review_note: body.reviewNote?.trim() || null,
			reviewed_at: new Date().toISOString(),
			// Where it was turned down, kept for the dots; cleared if reopened.
			rejected_stage: rejecting ? stage : null,
			...(body.status === 'under-review' && stage === 0 ? { review_stage: 1 } : {})
		})
		.eq('id', body.id)
		.select('email, full_name, startup_name, applicant_message, company_id')
		.maybeSingle();
	if (dbError) error(500, dbError.message);

	// Accepted for incubation is what makes it a TIC company: verify it, so it
	// shows on the Companies tab and can post roles.
	if (body.status === 'accepted' && application?.company_id) {
		await ctx.db
			.from('companies')
			.update({ status: 'verified', rejection_reason: null })
			.eq('id', application.company_id);
	}

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
	const ctx = await requireAdmin(cookies);
	if (reviewScope(ctx.admin) !== 'admin') error(403, 'Not allowed.');
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
