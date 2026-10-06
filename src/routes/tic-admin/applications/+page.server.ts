import { adminDb } from '$lib/server/adminData';
import { loadVisibleApplications, reviewScope } from '$lib/server/applicationReview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	return {
		applications: await loadVisibleApplications(adminDb(admin!), admin!),
		scope: reviewScope(admin!)
	};
};
