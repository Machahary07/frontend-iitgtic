import { adminDb, loadIncubatedCompanies } from '$lib/server/adminData';
import { listAllProfiles } from '$lib/server/startupProfiles';
import { groupsFor } from '$lib/utils/startupProfile';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const [companies, profiles] = await Promise.all([
		loadIncubatedCompanies(adminDb(admin!)),
		listAllProfiles()
	]);

	// Where "View profile" goes: the live page when the startup is on the site,
	// otherwise the staff preview of whatever the founder has written so far.
	const profileLinks: Record<string, string> = {};
	for (const p of profiles) {
		if (!p.company_id) continue;
		const group = p.listed && p.published ? groupsFor(p.stage, false)[0] : undefined;
		profileLinks[p.company_id] = group
			? `/incubated-startups/${group}/${p.slug}`
			: `/incubated-startups/preview/${p.id}`;
	}
	return { companies, profileLinks };
};
