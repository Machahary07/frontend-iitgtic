import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

// Read with the service key and filtered to this company by hand: a founder has
// to see their own pending and rejected postings, which the public policy — and
// so a browser-side query — deliberately hides.

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, activeCompanyId } = await parent();
	if (!activeCompanyId) return { jobs: [] };

	const { data } = await founderDb(founder.userId)
		.from('jobs')
		.select(
			'id, slug, role, company, location, type, sector, posted, status, review_note, reviewed_at, submitted_at, updated_at'
		)
		.eq('company_id', activeCompanyId)
		.order('submitted_at', { ascending: false });

	return { jobs: data ?? [] };
};
