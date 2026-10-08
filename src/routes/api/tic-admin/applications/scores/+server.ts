import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/adminGuard';
import { canScore, canSeeApplication } from '$lib/server/applicationReview';
import { isScoredStep } from '$lib/utils/applicationScores';
import type { RequestHandler } from './$types';

// One reviewer's mark for one step: PUT { id, step, score } saves it, a null
// score clears it. Nobody can read or change anyone else's — the row is always
// the caller's own.

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		step?: number;
		score?: number | null;
	};
	if (!body.id) error(400, 'Missing application id.');
	const step = Number(body.step);
	if (!isScoredStep(step)) error(400, 'That step is not scored.');
	const score = body.score;
	if (score !== null && (!Number.isInteger(score) || score! < 0 || score! > 100)) {
		error(400, 'A score is a whole number from 0 to 100.');
	}
	if (!(await canSeeApplication(ctx.db, ctx.admin, body.id))) error(404, 'Application not found.');

	const { data: app } = await ctx.db
		.from('applications')
		.select('id, status, review_stage')
		.eq('id', body.id)
		.maybeSingle();
	if (!app) error(404, 'Application not found.');
	if (
		!(await canScore(
			ctx.db,
			ctx.admin,
			app as { id: string; status: string; review_stage: number }
		))
	)
		error(403, 'You cannot score this application at its current step.');

	const { error: dbError } =
		score === null
			? await ctx.db
					.from('application_scores')
					.delete()
					.eq('application_id', app.id)
					.eq('user_id', ctx.admin.userId)
					.eq('step', step)
			: await ctx.db.from('application_scores').upsert(
					{
						application_id: app.id,
						user_id: ctx.admin.userId,
						role: ctx.admin.role,
						step,
						score,
						updated_at: new Date().toISOString()
					},
					{ onConflict: 'application_id,user_id,step' }
				);
	if (dbError) error(500, dbError.message);

	return json({ ok: true });
};
