import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

// Read with the service key and filtered to this company by hand: a founder has
// to see their own closed and removed postings, which the public policy — and so
// a browser-side query — deliberately hides.

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, activeCompanyId } = await parent();
	if (!activeCompanyId) return { jobs: [], applied: {} };

	const db = founderDb(founder.userId);
	const [{ data: jobs }, { data: applicants }] = await Promise.all([
		db
			.from('jobs')
			.select(
				'id, slug, role, type, work_mode, location, sector, posted, closes_on, max_applicants, status, removed_reason'
			)
			.eq('company_id', activeCompanyId)
			.order('posted', { ascending: false }),
		db.from('job_applications').select('job_id').eq('company_id', activeCompanyId)
	]);

	const applied: Record<string, number> = {};
	for (const a of applicants ?? []) {
		if (a.job_id) applied[a.job_id as string] = (applied[a.job_id as string] ?? 0) + 1;
	}

	return { jobs: jobs ?? [], applied };
};
