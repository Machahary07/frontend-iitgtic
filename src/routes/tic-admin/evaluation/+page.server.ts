import { adminDb } from '$lib/server/adminData';
import { reviewScope } from '$lib/server/applicationReview';
import { loadEvaluations } from '$lib/server/evaluation';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);
	const { active, done } = await loadEvaluations(db, admin!);
	return { active, done, scope: reviewScope(admin!), me: admin!.userId };
};
