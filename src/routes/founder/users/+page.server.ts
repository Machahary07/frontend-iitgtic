import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, activeCompanyId } = await parent();
	if (!activeCompanyId) return { members: [], owner: null };

	const db = founderDb(founder.userId);

	// The founder who registered the startup is not a row in the members list —
	// they are companies.owner_id — so they are read separately and shown at the
	// top of the team, where everyone expects to find them.
	const [members, company] = await Promise.all([
		db
			.from('profiles')
			.select('id, full_name, email, phone, member_status, created_at')
			.eq('company_id', activeCompanyId)
			.order('created_at', { ascending: true }),
		db.from('companies').select('owner_id').eq('id', activeCompanyId).maybeSingle()
	]);

	const ownerId = (company.data?.owner_id as string | undefined) ?? null;
	const { data: ownerProfile } = ownerId
		? await db.from('profiles').select('full_name, email').eq('id', ownerId).maybeSingle()
		: { data: null };

	return {
		members: members.data ?? [],
		owner: ownerId
			? {
					id: ownerId,
					name: (ownerProfile?.full_name as string) ?? '',
					email: (ownerProfile?.email as string) ?? ''
				}
			: null
	};
};
