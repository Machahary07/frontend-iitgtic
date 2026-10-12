import { ensureProfile } from '$lib/server/startupProfiles';
import { groupsFor, sectorList } from '$lib/utils/startupProfile';
import type { PageServerLoad } from './$types';

// The founder's public profile. Created from their application the first time
// they open this once TIC has accepted it.
export const load: PageServerLoad = async ({ parent }) => {
	const { activeCompanyId, content } = await parent();
	const sectors = sectorList(content.pages.incubatedStartups);
	if (!activeCompanyId) return { profile: null, sectors };
	const profile = await ensureProfile(activeCompanyId);
	return {
		sectors,
		profile: profile && {
			id: profile.id,
			slug: profile.slug,
			stage: profile.stage,
			isVirtual: profile.is_virtual,
			listed: profile.listed,
			draft: profile.draft,
			hasPublished: Boolean(profile.published),
			status: profile.draft_status,
			note: profile.review_note,
			submittedAt: profile.submitted_at,
			// The page visitors see, once it is on the site.
			liveHref:
				profile.listed && profile.published && profile.stage !== 'exited'
					? `/incubated-startups/${groupsFor(profile.stage, false)[0]}/${profile.slug}`
					: null
		}
	};
};
