import {
	adminDb,
	loadIncubatedCompanies,
	loadJobApplications,
	loadJobs
} from '$lib/server/adminData';
import { loadVisibleApplications } from '$lib/server/applicationReview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const [companies, jobs, applications, jobApplications] = await Promise.all([
		loadIncubatedCompanies(db),
		loadJobs(db),
		loadVisibleApplications(db, admin!),
		loadJobApplications(db)
	]);
	return { companies, jobs, applications, jobApplications };
};
