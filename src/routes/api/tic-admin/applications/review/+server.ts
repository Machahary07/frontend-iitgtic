import { error, json } from '@sveltejs/kit';
import { actorId, logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import {
	canSeeApplication,
	requireAllScored,
	reviewScope,
	type ReviewerKind
} from '$lib/server/applicationReview';
import { notifyReviewers } from '$lib/server/reviewMail';
import type { RequestHandler } from './$types';

// Moves an application along the review chain. Each action is allowed to one
// role at one stage only; anything else is refused, so a stale tab cannot skip
// a step or act on a step that has already moved on.
//
//   forward   admin    0 → 1   passes it to the CEO (applicant hears "under review")
//   assign    admin/CEO 1|2 → 3 coordinators, or 4 → 5 heads
//   sign-off  assigned head at 5 (coordinators submit from /tic-admin/evaluation,
//             and admin ending the screening call moves it to 4)
//   live      admin    accepted → 6, once it shows among the incubated startups
//
// Accepting and rejecting stay on PATCH /api/tic-admin/applications.

type Body = {
	id?: string;
	action?: 'forward' | 'assign' | 'sign-off' | 'live';
	kind?: ReviewerKind;
	userIds?: string[];
	note?: string;
};

export const POST: RequestHandler = async ({ cookies, request, url }) => {
	const ctx = await requireAdmin(cookies);
	const scope = reviewScope(ctx.admin);
	const body = (await request.json().catch(() => ({}))) as Body;
	if (!body.id) error(400, 'Missing application id.');
	if (!(await canSeeApplication(ctx.db, ctx.admin, body.id))) error(404, 'Application not found.');

	const { data: app } = await ctx.db
		.from('applications')
		.select('id, status, review_stage, email, full_name, startup_name')
		.eq('id', body.id)
		.maybeSingle();
	if (!app) error(404, 'Application not found.');
	if (app.status === 'rejected') error(409, 'This application was rejected.');
	const stage = app.review_stage as number;

	// Who is being handed it, in the review-your-turn email.
	const handOff = {
		db: ctx.db,
		siteUrl: url.origin,
		sentBy: ctx.admin.userId,
		application: {
			id: app.id as string,
			startup_name: app.startup_name as string | null,
			full_name: app.full_name as string | null
		},
		assignedBy: ctx.admin.name || ctx.admin.email
	};

	const setStage = async (next: number, extra: Record<string, unknown> = {}) => {
		const { error: dbError } = await ctx.db
			.from('applications')
			.update({ review_stage: next, reviewed_at: new Date().toISOString(), ...extra })
			.eq('id', app.id)
			.eq('review_stage', stage);
		if (dbError) error(500, dbError.message);
	};

	switch (body.action) {
		case 'forward': {
			if (scope !== 'admin') error(403, 'Only admin passes an application to the CEO.');
			if (stage !== 0) error(409, 'Already passed on.');
			await requireAllScored(ctx.db, app.id, ctx.admin.userId, 'pass it to the CEO');
			await setStage(1, { status: 'under-review' });
			await logAdminAction(ctx, 'passed application to the CEO', {
				table: 'applications',
				recordId: app.id
			});
			await notifyReviewers({
				...handOff,
				stage: 1,
				roles: ['tic_ceo'],
				stageName: 'CEO review',
				ask: 'admin has checked this incubation application and passed it to you for review. Assign the coordinators who should look at it.'
			});
			if (app.status === 'submitted' && app.email) {
				await sendTemplateEmail({
					templateKey: 'application-under-review',
					to: app.email as string,
					toName: (app.full_name as string) ?? '',
					variables: {
						fullName: (app.full_name as string) ?? '',
						startupName: (app.startup_name as string) ?? '',
						note: ''
					},
					context: { table: 'applications', recordId: app.id, status: 'under-review' },
					sentBy: ctx.admin.userId
				});
			}
			break;
		}

		case 'assign': {
			if (scope !== 'admin' && scope !== 'ceo')
				error(403, 'Only admin or the CEO assigns reviewers.');
			const kind = body.kind;
			const ids = [...new Set(body.userIds ?? [])];
			if (kind !== 'coordinator' && kind !== 'head') error(400, 'Unknown reviewer kind.');
			if (ids.length === 0) error(400, 'Choose at least one person.');
			if (kind === 'coordinator' && stage !== 1 && stage !== 2)
				error(409, 'Coordinators are assigned after the CEO review.');
			if (kind === 'head' && stage !== 4) error(409, 'Heads are assigned after the CEO recheck.');
			await requireAllScored(
				ctx.db,
				app.id,
				ctx.admin.userId,
				kind === 'coordinator' ? 'assign coordinators' : 'assign TIC heads'
			);

			// Only people who actually hold the role can be handed it.
			const role = kind === 'coordinator' ? 'tic_coordinator' : 'tic_head';
			const { data: people } = await ctx.db
				.from('profiles')
				.select('id')
				.in('id', ids)
				.eq('role', role);
			if ((people ?? []).length !== ids.length)
				error(400, 'Someone chosen does not hold that role.');

			const { error: insertError } = await ctx.db.from('application_reviewers').upsert(
				ids.map((user_id) => ({
					application_id: app.id,
					user_id,
					kind,
					assigned_by: actorId(ctx.admin)
				})),
				{ onConflict: 'application_id,user_id,kind', ignoreDuplicates: true }
			);
			if (insertError) error(500, insertError.message);

			await setStage(kind === 'coordinator' ? 3 : 5);
			await notifyReviewers({
				...handOff,
				stage: kind === 'coordinator' ? 3 : 5,
				userIds: ids,
				ask:
					kind === 'coordinator'
						? 'you have been assigned to review this incubation application as a coordinator.'
						: 'you have been assigned to review this incubation application as a TIC head.'
			});
			await logAdminAction(ctx, `assigned ${ids.length} ${kind}${ids.length === 1 ? '' : 's'}`, {
				table: 'applications',
				recordId: app.id,
				after: { kind, userIds: ids }
			});
			break;
		}

		case 'sign-off': {
			if (scope === 'coordinator') error(403, 'Coordinators submit their scores from Evaluation.');
			if (scope !== 'head') error(403, 'Only an assigned TIC head signs off.');
			if (stage !== 5) error(409, 'It is not at your step.');
			await requireAllScored(ctx.db, app.id, ctx.admin.userId, 'sign off');

			const { data: mine, error: updateError } = await ctx.db
				.from('application_reviewers')
				.update({ note: body.note?.trim() || null, done_at: new Date().toISOString() })
				.eq('application_id', app.id)
				.eq('user_id', ctx.admin.userId)
				.eq('kind', scope)
				.select('id');
			if (updateError) error(500, updateError.message);
			if (!mine?.length) error(403, 'You are not assigned to this application.');

			// Heads stay at 5: once they are all done it is with admin for the
			// final email.
			const { count: pending } = await ctx.db
				.from('application_reviewers')
				.select('id', { count: 'exact', head: true })
				.eq('application_id', app.id)
				.eq('kind', scope)
				.is('done_at', null);
			if (pending === 0) {
				await notifyReviewers({
					...handOff,
					stage: 5,
					roles: ['admin', 'tic_admin'],
					stageName: 'Final email',
					ask: 'every assigned TIC head has signed off. It is back with you to send the final email.'
				});
			}
			await logAdminAction(ctx, `signed off as ${scope}`, {
				table: 'applications',
				recordId: app.id
			});
			break;
		}

		case 'live': {
			if (scope !== 'admin') error(403, 'Only admin marks a startup live.');
			if (app.status !== 'accepted') error(409, 'Accept it and send the final email first.');
			await setStage(6);
			await logAdminAction(ctx, 'marked startup live', { table: 'applications', recordId: app.id });
			if (app.email) {
				await sendTemplateEmail({
					templateKey: 'startup-live',
					to: app.email as string,
					toName: (app.full_name as string) ?? '',
					variables: {
						fullName: (app.full_name as string) ?? '',
						startupName: (app.startup_name as string) ?? ''
					},
					context: { table: 'applications', recordId: app.id, status: 'live' },
					sentBy: ctx.admin.userId
				});
			}
			break;
		}

		default:
			error(400, 'Unknown action.');
	}

	return json({ ok: true });
};
