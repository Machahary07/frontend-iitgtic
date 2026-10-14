import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { emailConfig, sendTemplateEmail } from '$lib/server/email';
import { verifyEmailUrl } from '$lib/server/emailVerify';
import {
	canSeeApplication,
	pendingHeadReviews,
	requireAllScored,
	reviewScope,
	scoreEmailVariables
} from '$lib/server/applicationReview';
import { screeningEmailVariables } from '$lib/server/evaluation';
import { REVIEW_STEP_NAMES } from '$lib/utils/emailBlocks';
import { REJECT_REFUSALS, reapplyFrom, rejectRefusal } from '$lib/utils/applicationReject';
import { notifyRejection } from '$lib/server/reviewMail';
import { roleLabel } from '$lib/utils/roles';
import type { RequestHandler } from './$types';

// Application review. Applicants can read only their own rows and cannot touch
// `status`, so the TIC team reads and moves them through review from here.

const STATUSES = ['submitted', 'under-review', 'accepted', 'rejected', 'returned'] as const;
type Status = (typeof STATUSES)[number];

const BUCKET = 'application-documents';

// 'submitted' is the state an application arrives in, so moving one back to it
// is an internal correction rather than news for the applicant.
const TEMPLATE_FOR: Partial<Record<Status, string>> = {
	'under-review': 'application-under-review',
	accepted: 'application-accepted',
	rejected: 'application-rejected',
	returned: 'application-returned'
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

	// Admin decides; the CEO and an assigned TIC head may also turn one down
	// (rejectRefusal says when). Nobody else changes status.
	const scope = reviewScope(ctx.admin);
	const rejecting = body.status === 'rejected';
	if (scope !== 'admin' && !rejecting) error(403, 'Not allowed.');
	if (!(await canSeeApplication(ctx.db, ctx.admin, body.id))) error(404, 'Application not found.');

	const { data: current } = await ctx.db
		.from('applications')
		.select('review_stage, status')
		.eq('id', body.id)
		.maybeSingle();
	if (!current) error(404, 'Application not found.');
	const stage = current.review_stage as number;

	// Sent back before anyone has started on it, so no review is left half-done
	// while the founder has it.
	if (body.status === 'returned' && (current.status !== 'submitted' || stage !== 0)) {
		error(409, 'Only a submitted application that has not gone into review can be sent back.');
	}

	if (rejecting) {
		const headPending =
			scope === 'head' && (await pendingHeadReviews(ctx.db, ctx.admin.userId)).includes(body.id);
		const refusal = rejectRefusal(scope, stage, current.status as string, headPending);
		if (refusal) error(refusal === 'not-allowed' ? 403 : 409, REJECT_REFUSALS[refusal]);
		// The founder is always told why.
		if (!body.applicantMessage?.trim()) error(400, 'Give the founder a reason before rejecting.');
	}

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
		if (stage < 5 || !heads || pending)
			error(409, 'Every assigned TIC head has to sign off first.');
		await requireAllScored(ctx.db, body.id, ctx.admin.userId, 'accept it');
	}

	const now = new Date();
	const { data: application, error: dbError } = await ctx.db
		.from('applications')
		.update({
			status: body.status,
			applicant_message: body.applicantMessage?.trim() || null,
			review_note: body.reviewNote?.trim() || null,
			reviewed_at: now.toISOString(),
			// Where it was turned down, kept for the dots; cleared if reopened.
			rejected_stage: rejecting ? stage : null,
			// When, and when the startup may apply again; also cleared if reopened.
			rejected_at: rejecting ? now.toISOString() : null,
			reapply_from: rejecting ? reapplyFrom(now).toISOString() : null,
			reapply_allowed_at: null,
			...(body.status === 'under-review' && stage === 0 ? { review_stage: 1 } : {})
		})
		.eq('id', body.id)
		.select('email, full_name, startup_name, applicant_message, review_note, company_id, user_id')
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
	const decidedAt = stage === 0 ? 'Admin check' : (REVIEW_STEP_NAMES[stage - 1] ?? '');

	if (templateKey && application?.email) {
		// The panel's marks go out with the decision only — never while it is
		// still being reviewed — as per-step averages with no names attached.
		const decided = rejecting || body.status === 'accepted';
		// A founder who has not confirmed their email gets the link with it, since
		// that is what stands between them and submitting again.
		let verifyUrl = '';
		if (body.status === 'returned') {
			const { data: owner } = await supabaseAdmin
				.from('profiles')
				.select('email_verified')
				.eq('id', application.user_id)
				.maybeSingle();
			if (!owner?.email_verified) {
				verifyUrl = verifyEmailUrl(emailConfig().siteUrl, application.user_id as string);
			}
		}
		const scoreVars = decided
			? {
					...(await scoreEmailVariables(ctx.db, body.id)),
					...(await screeningEmailVariables(ctx.db, body.id))
				}
			: {};
		const result = await sendTemplateEmail({
			templateKey,
			to: application.email as string,
			toName: (application.full_name as string) ?? '',
			variables: {
				fullName: (application.full_name as string) ?? '',
				startupName: (application.startup_name as string) ?? '',
				// applicant_message only: the internal note never goes to the founder.
				note: (application.applicant_message as string) ?? '',
				verifyUrl,
				...scoreVars,
				...(rejecting ? { decidedAt, decidedBy: roleLabel(ctx.admin.role) } : {})
			},
			context: { table: 'applications', recordId: body.id, status: body.status },
			sentBy: ctx.admin.userId
		});
		email = { status: result.status, error: result.error };
	}

	// And the staff who worked on it, internal note included. Never throws.
	if (rejecting && application) {
		await notifyRejection({
			db: ctx.db,
			siteUrl: emailConfig().siteUrl,
			rejectedBy: {
				userId: ctx.admin.userId,
				name: ctx.admin.name || ctx.admin.email,
				role: roleLabel(ctx.admin.role)
			},
			application: {
				id: body.id,
				startup_name: application.startup_name as string | null,
				full_name: application.full_name as string | null
			},
			stage,
			stageName: decidedAt,
			reason: (application.applicant_message as string) ?? '',
			internalNote: (application.review_note as string) ?? ''
		});
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
