import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const category = content.pages.incubatedStartups.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Category not found');

	const startup = category.startups.find((s) => s.slug === params.startupSlug);
	if (!startup) error(404, 'Startup not found');

	return { category, startup };
};
