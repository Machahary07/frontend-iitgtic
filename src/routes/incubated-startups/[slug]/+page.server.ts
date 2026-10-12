import { error } from '@sveltejs/kit';
import { startupsInGroup } from '$lib/server/startupProfiles';
import type { ProfileGroup } from '$lib/utils/startupProfile';
import type { PageServerLoad } from './$types';

// The category's copy comes from site content; its startups from startup_profiles.
export const load: PageServerLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const category = content.pages.incubatedStartups.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Category not found');
	return { category, startups: await startupsInGroup(params.slug as ProfileGroup) };
};
