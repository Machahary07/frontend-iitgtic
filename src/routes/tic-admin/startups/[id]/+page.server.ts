import { error } from '@sveltejs/kit';
import { profileById } from '$lib/server/startupProfiles';
import { canOpen } from '$lib/utils/roles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { admin, content } = await parent();
	if (!canOpen(admin!.actor?.role ?? admin!.role, 'content')) error(403, 'Not allowed.');
	const profile = await profileById(params.id);
	if (!profile) error(404, 'Profile not found.');
	return {
		profile: {
			id: profile.id,
			draft: profile.draft,
			status: profile.draft_status,
			hasPublished: Boolean(profile.published)
		},
		sectors: content.pages.incubatedStartups.sectors as string[]
	};
};
