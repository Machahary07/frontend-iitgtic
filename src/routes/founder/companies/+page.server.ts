import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

// Where each startup's incubation application stands, for the stickers on the
// list. Read with the service key and filtered to this founder's startups.

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, companies } = await parent();
	const ids = companies.map((c) => c.id);
	if (ids.length === 0) return { applications: {} as Record<string, ApplicationStanding> };

	const { data } = await founderDb(founder.userId)
		.from('applications')
		.select('company_id, status, review_stage, created_at')
		.in('company_id', ids)
		.order('created_at', { ascending: false });

	// The newest application per startup is the one that counts.
	const applications: Record<string, ApplicationStanding> = {};
	for (const row of data ?? []) {
		const id = row.company_id as string;
		if (!applications[id]) {
			applications[id] = {
				status: row.status as ApplicationStanding['status'],
				live: (row.review_stage as number) >= 6
			};
		}
	}
	return { applications };
};

type ApplicationStanding = {
	status: 'submitted' | 'under-review' | 'accepted' | 'rejected';
	live: boolean;
};
