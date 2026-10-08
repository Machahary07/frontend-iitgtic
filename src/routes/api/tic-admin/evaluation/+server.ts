import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin, type AdminContext } from '$lib/server/adminGuard';
import { canSeeApplication, reviewScope } from '$lib/server/applicationReview';
import { formatEventTime, sendTemplateEmail } from '$lib/server/email';
import { GOOGLE_MEET_URL } from '$lib/server/evaluation';
import { notifyReviewers } from '$lib/server/reviewMail';
import {
	EVALUATION_CRITERIA,
	isCriterion,
	MAX_CRITERION_SCORE
} from '$lib/utils/evaluationCriteria';
import type { RequestHandler } from './$types';

// The coordinators' screening call, at stage 3 of the review chain.
//
//   PUT    { id, meetUrl, meetAt }        admin sets up (or moves) the meeting
//   PATCH  { id, marks }                  a coordinator's auto-saved draft
//   POST   { id, action: 'submit', marks } a coordinator submits; marks lock
//   POST   { id, action: 'end' }          admin ends it once everyone submitted;
//                                         it goes to the CEO for the recheck (4)

type MarksBody = Record<string, { score?: number | null; remark?: string }>;

async function loadApp(ctx: AdminContext, id: string | undefined) {
	if (!id) error(400, 'Missing application id.');
	if (!(await canSeeApplication(ctx.db, ctx.admin, id))) error(404, 'Application not found.');
	const { data } = await ctx.db
		.from('applications')
		.select(
			'id, status, review_stage, startup_name, full_name, email, meet_url, meet_at, meeting_ended_at'
		)
		.eq('id', id)
		.maybeSingle();
	if (!data) error(404, 'Application not found.');
	if (data.status === 'rejected') error(409, 'This application was rejected.');
	if (data.review_stage !== 3 || data.meeting_ended_at) {
		error(409, 'This application is not at the screening call.');
	}
	return data;
}

// The coordinator's own assignment, still open. Anything else may not write.
async function requireOpenAssignment(ctx: AdminContext, appId: string) {
	if (reviewScope(ctx.admin) !== 'coordinator') error(403, 'Only an assigned coordinator scores.');
	const { data } = await ctx.db
		.from('application_reviewers')
		.select('id, done_at')
		.eq('application_id', appId)
		.eq('user_id', ctx.admin.userId)
		.eq('kind', 'coordinator')
		.maybeSingle();
	if (!data) error(403, 'You are not assigned to this application.');
	if (data.done_at) error(409, 'You have already submitted your scores.');
	return data.id as string;
}

async function saveMarks(ctx: AdminContext, appId: string, marks: MarksBody | undefined) {
	const rows = Object.entries(marks ?? {})
		.filter(([key]) => isCriterion(key))
		.map(([criterion, mark]) => {
			const score = mark?.score ?? null;
			if (
				score !== null &&
				(!Number.isInteger(score) || score < 0 || score > MAX_CRITERION_SCORE)
			) {
				error(400, `Scores are whole numbers from 0 to ${MAX_CRITERION_SCORE}.`);
			}
			return {
				application_id: appId,
				user_id: ctx.admin.userId,
				criterion,
				score,
				remark: mark?.remark?.trim().slice(0, 4000) || null,
				updated_at: new Date().toISOString()
			};
		});
	if (rows.length === 0) return;
	const { error: dbError } = await ctx.db
		.from('evaluation_scores')
		.upsert(rows, { onConflict: 'application_id,user_id,criterion' });
	if (dbError) error(500, dbError.message);
}

export const PUT: RequestHandler = async ({ cookies, request, url }) => {
	const ctx = await requireAdmin(cookies);
	if (reviewScope(ctx.admin) !== 'admin') error(403, 'Only admin sets up the screening call.');
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		meetUrl?: string;
		meetAt?: string;
	};
	const app = await loadApp(ctx, body.id);

	const meetUrl = body.meetUrl?.trim() ?? '';
	if (!GOOGLE_MEET_URL.test(meetUrl)) {
		error(400, 'Paste a Google Meet link, like https://meet.google.com/abc-defg-hij.');
	}
	const meetAt = body.meetAt ? new Date(body.meetAt) : null;
	if (!meetAt || Number.isNaN(meetAt.getTime())) error(400, 'Choose the meeting date and time.');

	const changed =
		meetUrl !== app.meet_url ||
		meetAt.getTime() !== (app.meet_at ? new Date(app.meet_at as string).getTime() : NaN);
	if (!changed) return json({ ok: true, notified: 0 });

	const { error: dbError } = await ctx.db
		.from('applications')
		.update({ meet_url: meetUrl, meet_at: meetAt.toISOString() })
		.eq('id', app.id);
	if (dbError) error(500, dbError.message);

	await logAdminAction(
		ctx,
		app.meet_url ? 'moved the screening call' : 'set up the screening call',
		{
			table: 'applications',
			recordId: app.id as string,
			after: { meetUrl, meetAt: meetAt.toISOString() }
		}
	);

	// Every assigned coordinator hears about it, and again if it moves.
	const { data: people } = await ctx.db
		.from('application_reviewers')
		.select('profile:profiles!application_reviewers_user_id_fkey(full_name, email)')
		.eq('application_id', app.id)
		.eq('kind', 'coordinator');
	const recipients = (people ?? [])
		.map(
			(r) =>
				(Array.isArray(r.profile) ? r.profile[0] : r.profile) as {
					full_name: string | null;
					email: string | null;
				} | null
		)
		.filter((p): p is { full_name: string | null; email: string } => Boolean(p?.email));

	// The applicant is invited too, with the same time and link.
	const applicantSend = app.email
		? sendTemplateEmail({
				templateKey: 'screening-invite',
				to: app.email as string,
				toName: (app.full_name as string) ?? '',
				variables: {
					fullName: (app.full_name as string) ?? '',
					startupName: (app.startup_name as string) || 'your startup',
					meetTime: formatEventTime(meetAt),
					meetUrl
				},
				context: { table: 'applications', recordId: app.id, status: 'screening' },
				sentBy: ctx.admin.userId
			})
		: null;

	const [applicant] = await Promise.all([
		applicantSend,
		...recipients.map((p) =>
			sendTemplateEmail({
				templateKey: 'evaluation-meeting',
				to: p.email,
				toName: p.full_name ?? '',
				variables: {
					recipientName: (p.full_name ?? '').split(' ')[0] || 'there',
					startupName: (app.startup_name as string) || 'Untitled startup',
					founderName: (app.full_name as string) ?? '',
					meetTime: formatEventTime(meetAt),
					meetUrl,
					evaluationUrl: `${url.origin}/tic-admin/evaluation`
				},
				context: { table: 'applications', recordId: app.id },
				sentBy: ctx.admin.userId
			})
		)
	]);

	return json({ ok: true, notified: recipients.length, applicantInvited: Boolean(applicant?.ok) });
};

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as { id?: string; marks?: MarksBody };
	const app = await loadApp(ctx, body.id);
	await requireOpenAssignment(ctx, app.id as string);
	if (!app.meet_url) error(409, 'Scoring opens once admin sets up the meeting.');
	await saveMarks(ctx, app.id as string, body.marks);
	return json({ ok: true, savedAt: new Date().toISOString() });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		action?: 'submit' | 'end';
		marks?: MarksBody;
	};
	const app = await loadApp(ctx, body.id);
	const appId = app.id as string;

	if (body.action === 'submit') {
		const assignmentId = await requireOpenAssignment(ctx, appId);
		if (!app.meet_url) error(409, 'Scoring opens once admin sets up the meeting.');
		await saveMarks(ctx, appId, body.marks);

		// Judged on what is stored, so a submit can never lock in less than it shows.
		const { data: stored } = await ctx.db
			.from('evaluation_scores')
			.select('criterion, score')
			.eq('application_id', appId)
			.eq('user_id', ctx.admin.userId);
		const scored = new Set(
			(stored ?? []).filter((r) => r.score !== null).map((r) => r.criterion as string)
		);
		const missing = EVALUATION_CRITERIA.filter((c) => !scored.has(c.key));
		if (missing.length) {
			error(
				400,
				`Score every criterion first — missing: ${missing.map((c) => c.name).join(', ')}.`
			);
		}

		const { error: dbError } = await ctx.db
			.from('application_reviewers')
			.update({ done_at: new Date().toISOString() })
			.eq('id', assignmentId);
		if (dbError) error(500, dbError.message);
		await logAdminAction(ctx, 'submitted screening scores', {
			table: 'applications',
			recordId: appId
		});
		return json({ ok: true });
	}

	if (body.action === 'end') {
		if (reviewScope(ctx.admin) !== 'admin') error(403, 'Only admin ends the screening call.');
		if (!app.meet_url) error(409, 'Set up the meeting first.');

		const { data: coordinators } = await ctx.db
			.from('application_reviewers')
			.select('done_at')
			.eq('application_id', appId)
			.eq('kind', 'coordinator');
		if (!coordinators?.length) error(409, 'No coordinators are assigned.');
		const waiting = coordinators.filter((c) => !c.done_at).length;
		if (waiting) {
			error(409, `${waiting} coordinator${waiting === 1 ? ' has' : 's have'} not submitted yet.`);
		}

		// Moves it on without touching anyone's scores.
		const { data: moved, error: dbError } = await ctx.db
			.from('applications')
			.update({
				review_stage: 4,
				meeting_ended_at: new Date().toISOString(),
				reviewed_at: new Date().toISOString()
			})
			.eq('id', appId)
			.eq('review_stage', 3)
			.select('id')
			.maybeSingle();
		if (dbError) error(500, dbError.message);
		if (!moved) error(409, 'It has already moved on.');

		await logAdminAction(ctx, 'ended the screening call and passed it to the CEO', {
			table: 'applications',
			recordId: appId
		});
		await notifyReviewers({
			db: ctx.db,
			siteUrl: new URL(request.url).origin,
			sentBy: ctx.admin.userId,
			application: {
				id: appId,
				startup_name: app.startup_name as string | null,
				full_name: app.full_name as string | null
			},
			assignedBy: ctx.admin.name || ctx.admin.email,
			stage: 4,
			roles: ['tic_ceo'],
			ask: 'the coordinators have finished the screening call and submitted their scores. Recheck the application and their screening scores, then assign the TIC heads.'
		});
		return json({ ok: true });
	}

	error(400, 'Unknown action.');
};
