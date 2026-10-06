import { adminDb, loadIncubatedCompanies } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	return { companies: await loadIncubatedCompanies(adminDb(admin!)) };
};
