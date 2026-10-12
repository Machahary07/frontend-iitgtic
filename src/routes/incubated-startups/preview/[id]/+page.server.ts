import { error } from '@sveltejs/kit';
import { validatedAdminSession, validatedFounderSession } from '$lib/server/sessionValidation';
import { founderDb, listMyCompanies } from '$lib/server/founderGuard';
import { profileById } from '$lib/server/startupProfiles';
import type { PageServerLoad } from './$types';

// A profile exactly as the public page will show it, before it is approved or
// listed. For TIC staff and the founders of that startup only. `?v=live` shows
// the published version instead of the draft.
export const load: PageServerLoad = async ({ params, cookies, url, parent }) => {
	const profile = await profileById(params.id);
	if (!profile) error(404, 'Not found');

	let allowed = Boolean(await validatedAdminSession(cookies));
	if (!allowed && profile.company_id) {
		const founder = await validatedFounderSession(cookies);
		if (founder) {
			const mine = await listMyCompanies(founderDb(founder.userId), founder.userId);
			allowed = mine.some((c) => c.id === profile.company_id);
		}
	}
	if (!allowed) error(404, 'Not found');

	const { content } = await parent();
	const live = url.searchParams.get('v') === 'live' && profile.published;
	const groupSlug =
		profile.stage === 'graduated' ? 'graduated' : profile.is_virtual ? 'virtual' : 'current';
	const group = content.pages.incubatedStartups.categories.find((c) => c.slug === groupSlug);

	return {
		startup: live ? profile.published! : profile.draft,
		version: live ? 'live' : 'draft',
		category: { slug: groupSlug, title: group?.title ?? 'Incubated startups' }
	};
};
