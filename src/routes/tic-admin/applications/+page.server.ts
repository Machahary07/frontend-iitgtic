import { adminDb } from '$lib/server/adminData';
import {
	loadVisibleApplications,
	pendingHeadReviews,
	reviewScope
} from '$lib/server/applicationReview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const scope = reviewScope(admin!);
	return {
		applications: await loadVisibleApplications(db, admin!),
		scope,
		// Where a head may still reject: assigned and not signed off yet.
		headPending: scope === 'head' ? await pendingHeadReviews(db, admin!.userId) : []
	};
};
