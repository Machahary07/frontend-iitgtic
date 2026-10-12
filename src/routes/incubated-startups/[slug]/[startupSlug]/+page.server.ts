import { error } from '@sveltejs/kit';
import { publicStartup } from '$lib/server/startupProfiles';
import type { ProfileGroup } from '$lib/utils/startupProfile';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const category = content.pages.incubatedStartups.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Category not found');

	// Only under a group it belongs to: a graduate is not at /current/….
	const startup = await publicStartup(params.startupSlug);
	if (!startup || !startup.groups.includes(params.slug as ProfileGroup)) {
		error(404, 'Startup not found');
	}
	return { category, startup };
};
