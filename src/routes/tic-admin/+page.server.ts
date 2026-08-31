import {
	adminDb,
	loadApplications,
	loadCompanies,
	loadJobApplications,
	loadJobs
} from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const [companies, jobs, applications, jobApplications] = await Promise.all([
		loadCompanies(db),
		loadJobs(db),
		loadApplications(db),
		loadJobApplications(db)
	]);
	return { companies, jobs, applications, jobApplications };
};
