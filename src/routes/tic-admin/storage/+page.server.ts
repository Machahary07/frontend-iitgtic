import { adminDb } from '$lib/server/adminData';
import { readStorage } from '$lib/server/storageUsage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	return { storage: await readStorage(adminDb(admin!)) };
};
