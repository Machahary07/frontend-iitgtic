import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { founder } = await parent();
	if (!founder.companyId || founder.memberStatus !== 'approved') return { members: [] };

	const { data } = await founderDb(founder.userId)
		.from('profiles')
		.select('id, full_name, email, phone, member_role, member_status, created_at')
		.eq('company_id', founder.companyId)
		.order('created_at', { ascending: true });

	return { members: data ?? [] };
};
