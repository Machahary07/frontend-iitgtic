import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { founder } = await parent();
	if (!founder.companyId || founder.memberStatus !== 'approved') return { pendingChange: null };

	const { data } = await founderDb(founder.userId)
		.from('company_profile_changes')
		.select('id, changes, status, review_note, created_at')
		.eq('company_id', founder.companyId)
		.eq('status', 'pending')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	return { pendingChange: data ?? null };
};
