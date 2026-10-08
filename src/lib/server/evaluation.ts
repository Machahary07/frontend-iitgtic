import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsoleSession } from '$lib/server/sessionValidation';
import { reviewScope } from '$lib/server/applicationReview';
import {
	EVALUATION_CRITERIA,
	type EvaluationCard,
	type Marks
} from '$lib/utils/evaluationCriteria';

// The coordinators' screening call (stage 3). Admin sets up the Meet and ends
// it; each assigned coordinator scores against EVALUATION_CRITERIA and submits.
// A coordinator only ever reads their own marks — everyone's go to admin alone.

export const GOOGLE_MEET_URL = /^https:\/\/meet\.google\.com\/[\w-]+(\?.*)?$/i;

export function emptyMarks(): Marks {
	return Object.fromEntries(EVALUATION_CRITERIA.map((c) => [c.key, { score: null, remark: '' }]));
}

type AppRow = {
	id: string;
	startup_name: string | null;
	full_name: string | null;
	meet_url: string | null;
	meet_at: string | null;
	meeting_ended_at: string | null;
};

const APP_COLUMNS = 'id, startup_name, full_name, meet_url, meet_at, meeting_ended_at';

/** Active screening calls (at stage 3) this person can see, and — for admin
 *  only — the history of every call that has ended. */
export async function loadEvaluations(
	db: SupabaseClient,
	admin: Pick<ConsoleSession, 'role' | 'userId'>
): Promise<{ active: EvaluationCard[]; done: EvaluationCard[] }> {
	const scope = reviewScope(admin);
	const isAdmin = scope === 'admin';
	if (!isAdmin && scope !== 'coordinator') return { active: [], done: [] };

	// Which applications: admin sees every one at the call stage plus those whose
	// call has ended; a coordinator only those they were assigned.
	let assignedIds: string[] | null = null;
	if (!isAdmin) {
		const { data } = await db
			.from('application_reviewers')
			.select('application_id')
			.eq('user_id', admin.userId)
			.eq('kind', 'coordinator');
		assignedIds = (data ?? []).map((r) => r.application_id as string);
		if (assignedIds.length === 0) return { active: [], done: [] };
	}

	let activeQuery = db
		.from('applications')
		.select(APP_COLUMNS)
		.eq('review_stage', 3)
		.neq('status', 'rejected')
		.order('reviewed_at', { ascending: false });
	if (assignedIds) activeQuery = activeQuery.in('id', assignedIds);
	const doneQuery = isAdmin
		? db
				.from('applications')
				.select(APP_COLUMNS)
				.not('meeting_ended_at', 'is', null)
				.order('meeting_ended_at', { ascending: false })
				.limit(200)
		: Promise.resolve({ data: [] as AppRow[] });
	const [{ data: activeRows }, { data: doneRows }] = await Promise.all([activeQuery, doneQuery]);
	const apps = [...(activeRows ?? []), ...(doneRows ?? [])] as AppRow[];
	if (apps.length === 0) return { active: [], done: [] };
	const ids = apps.map((a) => a.id);

	const [{ data: reviewerRows }, { data: scoreRows }] = await Promise.all([
		db
			.from('application_reviewers')
			.select(
				'application_id, user_id, done_at, profile:profiles!application_reviewers_user_id_fkey(full_name, email)'
			)
			.in('application_id', ids)
			.eq('kind', 'coordinator')
			.order('assigned_at'),
		// Never anyone else's marks unless the reader is admin.
		isAdmin
			? db
					.from('evaluation_scores')
					.select('application_id, user_id, criterion, score, remark')
					.in('application_id', ids)
			: db
					.from('evaluation_scores')
					.select('application_id, user_id, criterion, score, remark')
					.in('application_id', ids)
					.eq('user_id', admin.userId)
	]);

	const marksFor = (appId: string, userId: string): Marks => {
		const marks = emptyMarks();
		for (const row of scoreRows ?? []) {
			if (row.application_id !== appId || row.user_id !== userId) continue;
			if (!(row.criterion in marks)) continue;
			marks[row.criterion as string] = {
				score: (row.score as number | null) ?? null,
				remark: (row.remark as string | null) ?? ''
			};
		}
		return marks;
	};

	const card = (app: AppRow): EvaluationCard => {
		const coordinators = (reviewerRows ?? [])
			.filter((r) => r.application_id === app.id)
			.map((r) => {
				const profile = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as {
					full_name: string | null;
					email: string | null;
				} | null;
				return {
					userId: r.user_id as string,
					name: profile?.full_name || profile?.email || 'Coordinator',
					submitted: Boolean(r.done_at)
				};
			});
		return {
			id: app.id,
			startupName: app.startup_name || 'Untitled startup',
			founderName: app.full_name || '',
			meetUrl: app.meet_url,
			meetAt: app.meet_at,
			meetingEndedAt: app.meeting_ended_at,
			coordinators,
			mine: marksFor(app.id, admin.userId),
			submitted: coordinators.find((c) => c.userId === admin.userId)?.submitted ?? false,
			all: isAdmin ? coordinators.map((c) => ({ ...c, marks: marksFor(app.id, c.userId) })) : null
		};
	};

	return {
		active: ((activeRows ?? []) as AppRow[]).map(card),
		done: ((doneRows ?? []) as AppRow[]).map(card)
	};
}

/** Every coordinator's submitted screening marks for one application, read-only.
 *  For admin and — at the recheck and after — the CEO. */
export async function loadScreening(db: SupabaseClient, applicationId: string) {
	const [{ data: reviewerRows }, { data: scoreRows }] = await Promise.all([
		db
			.from('application_reviewers')
			.select(
				'user_id, done_at, profile:profiles!application_reviewers_user_id_fkey(full_name, email)'
			)
			.eq('application_id', applicationId)
			.eq('kind', 'coordinator')
			.order('assigned_at'),
		db
			.from('evaluation_scores')
			.select('user_id, criterion, score, remark')
			.eq('application_id', applicationId)
	]);

	return (reviewerRows ?? []).map((r) => {
		const profile = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as {
			full_name: string | null;
			email: string | null;
		} | null;
		const marks = emptyMarks();
		for (const row of scoreRows ?? []) {
			if (row.user_id !== r.user_id || !(row.criterion in marks)) continue;
			marks[row.criterion as string] = {
				score: (row.score as number | null) ?? null,
				remark: (row.remark as string | null) ?? ''
			};
		}
		return {
			userId: r.user_id as string,
			name: profile?.full_name || profile?.email || 'Coordinator',
			submitted: Boolean(r.done_at),
			marks
		};
	});
}

/** The screening averages for the decision email: `eval_<criterion>` as "7.5/10"
 *  and `evalOverall`. Only submitted marks count; nothing is set if there are
 *  none, and the template then leaves the card out. */
export async function screeningEmailVariables(
	db: SupabaseClient,
	applicationId: string
): Promise<Record<string, string>> {
	const people = (await loadScreening(db, applicationId)).filter((p) => p.submitted);
	const out: Record<string, string> = {};
	const averages: number[] = [];
	for (const criterion of EVALUATION_CRITERIA) {
		const given = people
			.map((p) => p.marks[criterion.key].score)
			.filter((s): s is number => s !== null);
		if (!given.length) continue;
		const avg = given.reduce((a, b) => a + b, 0) / given.length;
		averages.push(avg);
		out[`eval_${criterion.key}`] = `${avg.toFixed(1)}/10`;
	}
	if (averages.length) {
		out.evalOverall = `${(averages.reduce((a, b) => a + b, 0) / averages.length).toFixed(1)}/10`;
	}
	return out;
}
