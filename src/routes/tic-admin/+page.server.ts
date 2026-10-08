import { loadOverview } from '$lib/server/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	return { overview: await loadOverview(admin!) };
};
