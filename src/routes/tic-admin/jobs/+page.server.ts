import { adminDb, loadApplicantCounts, loadJobs } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const [jobs, counts] = await Promise.all([loadJobs(db), loadApplicantCounts(db)]);
	return { jobs, counts };
};
