import { adminDb, loadCompanies } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	return { companies: await loadCompanies(adminDb(admin!)) };
};
