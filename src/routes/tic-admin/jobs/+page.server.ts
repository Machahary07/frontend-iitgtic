import { adminDb, loadCompanies, loadJobs } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const [jobs, companies] = await Promise.all([loadJobs(db), loadCompanies(db)]);
	return { jobs, companies };
};
