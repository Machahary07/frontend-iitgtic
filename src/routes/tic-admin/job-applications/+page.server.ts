import { adminDb, loadJobApplications } from '$lib/server/adminData';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	return { jobApplications: await loadJobApplications(adminDb(admin!)) };
};
