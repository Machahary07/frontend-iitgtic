import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, activeCompanyId } = await parent();
	if (!activeCompanyId) return { pendingChange: null };

	const { data } = await founderDb(founder.userId)
		.from('company_profile_changes')
		.select('id, changes, status, review_note, created_at')
		.eq('company_id', activeCompanyId)
		.eq('status', 'pending')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	return { pendingChange: data ?? null };
};
