import { adminDb, loadApplications, loadCompanies, loadJobs } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const [companies, jobs, applications] = await Promise.all([
		loadCompanies(db),
		loadJobs(db),
		loadApplications(db)
	]);
	return { companies, jobs, applications };
};
