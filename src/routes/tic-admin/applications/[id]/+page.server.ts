import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/adminData';
import {
	APPLICATION_COLUMNS,
	canSeeApplication,
	loadAssignable,
	loadReviewers,
	reviewScope
} from '$lib/server/applicationReview';
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
		.select(`${APPLICATION_COLUMNS}, answers, documents`)
		.eq('id', params.id)
		.maybeSingle();

	if (dbError) error(500, dbError.message);
	if (!data) error(404, 'Application not found.');

	// The CEO opening it is the CEO review starting.
	if (scope === 'ceo' && data.review_stage === 1 && data.status !== 'rejected') {
		await db.from('applications').update({ review_stage: 2 }).eq('id', data.id).eq('review_stage', 1);
		data.review_stage = 2;
	}

	const assigns = scope === 'admin' || scope === 'ceo';
	const [reviewers, coordinators, heads] = await Promise.all([
		loadReviewers(db, data.id),
		assigns ? loadAssignable(db, 'coordinator') : Promise.resolve([]),
		assigns ? loadAssignable(db, 'head') : Promise.resolve([])
	]);

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
		assignable: { coordinators, heads }
	};
};
