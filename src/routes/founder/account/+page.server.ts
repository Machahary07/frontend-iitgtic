import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { founder } = await parent();

	const { data } = await founderDb(founder.userId)
		.from('profiles')
		.select('full_name, email, phone, created_at')
		.eq('id', founder.userId)
		.maybeSingle();

	return {
		me: {
			fullName: (data?.full_name as string) ?? '',
			email: (data?.email as string) || founder.email,
			phone: (data?.phone as string) ?? '',
			joinedAt: (data?.created_at as string | null) ?? null
		}
	};
};
