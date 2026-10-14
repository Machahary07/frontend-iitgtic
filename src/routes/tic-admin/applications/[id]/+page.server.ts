import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/adminData';
import {
	APPLICATION_COLUMNS,
	canScore,
	canSeeApplication,
	ceoFillsGaps,
	loadAdminScores,
	loadAllScores,
	loadAssignable,
	loadMyScores,
	loadReviewers,
	reviewScope,
	visibleApplicationIds
} from '$lib/server/applicationReview';
import type { EarlierApplication } from '$lib/utils/ticAdmin';
import { loadScreening } from '$lib/server/evaluation';
import type { PageServerLoad } from './$types';

const BUCKET = 'application-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

type DocumentEntry = { path: string; name: string; size: number };

export const load: PageServerLoad = async ({ parent, params }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const scope = reviewScope(admin!);

	// Not yet at this person's step, or not assigned to them: as far as they
	// can tell, it does not exist.
	if (!(await canSeeApplication(db, admin!, params.id))) error(404, 'Application not found.');

	const { data, error: dbError } = await db
		.from('applications')
		.select(
			`${APPLICATION_COLUMNS}, answers, documents, meet_at, meeting_ended_at, company_id, rejected_at, reapply_from, reapply_allowed_at`
		)
		.eq('id', params.id)
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) error(404, 'Application not found.');

	// The CEO opening it is the CEO review starting.
	if (scope === 'ceo' && data.review_stage === 1 && data.status !== 'rejected') {
		await db
			.from('applications')
			.update({ review_stage: 2 })
			.eq('id', data.id)
			.eq('review_stage', 1);
		data.review_stage = 2;
	}

	const assigns = scope === 'admin' || scope === 'ceo';
	// The coordinators' screening marks: admin always, the CEO from the recheck
	// on (stage 4), once the call has ended. Nobody else.
	const seesScreening = scope === 'admin' || (scope === 'ceo' && Boolean(data.meeting_ended_at));

	const [reviewers, coordinators, heads, myScores, allScores, adminScores, scoring, screening] =
		await Promise.all([
			loadReviewers(db, data.id),
			assigns ? loadAssignable(db, 'coordinator') : Promise.resolve([]),
			assigns ? loadAssignable(db, 'head') : Promise.resolve([]),
			loadMyScores(db, data.id, admin!.userId),
			// Everyone's marks go to admin and nobody else — not even as a total.
			scope === 'admin' ? loadAllScores(db, data.id) : Promise.resolve(null),
			// The CEO also reads admin's marks; coordinators and heads only their own.
			scope === 'ceo' ? loadAdminScores(db, data.id) : Promise.resolve(null),
			canScore(db, admin!, data),
			seesScreening ? loadScreening(db, data.id) : Promise.resolve(null)
		]);

	// "Applied before": the same startup's (or founder's) earlier applications,
	// only those this person could open anyway — so the CEO never learns of one
	// admin turned down before passing it on.
	const visibleIds = await visibleApplicationIds(db, admin!);
	let earlierQuery = db
		.from('applications')
		.select('id, status, startup_name, created_at, rejected_stage, applicant_message')
		.neq('id', data.id)
		.lt('created_at', data.created_at)
		.order('created_at', { ascending: false });
	earlierQuery = data.company_id
		? earlierQuery.or(`company_id.eq.${data.company_id},user_id.eq.${data.user_id}`)
		: earlierQuery.eq('user_id', data.user_id);
	if (visibleIds !== null) earlierQuery = earlierQuery.in('id', visibleIds);
	const { data: earlier } = await earlierQuery;

	const documents = (data.documents ?? {}) as Record<string, DocumentEntry>;
	const documentLinks: Record<string, { name: string; size: number; url: string | null }> = {};

	for (const [field, entry] of Object.entries(documents)) {
		if (!entry?.path) continue;
		const { data: signed } = await db.storage
			.from(BUCKET)
			.createSignedUrl(entry.path, SIGNED_URL_TTL_SECONDS);
		documentLinks[field] = { name: entry.name, size: entry.size, url: signed?.signedUrl ?? null };
	}

	return {
		application: data,
		documentLinks,
		scope,
		me: admin!.userId,
		reviewers,
		assignable: { coordinators, heads },
		scores: {
			mine: myScores,
			all: allScores,
			admin: adminScores,
			canScore: scoring,
			// The CEO's recheck: their marks are locked, gaps may be filled.
			fillGaps: ceoFillsGaps(admin!, data)
		},
		earlier: (earlier ?? []) as EarlierApplication[],
		screening: screening
			? { people: screening, meetAt: data.meet_at, endedAt: data.meeting_ended_at }
			: null
	};
};
