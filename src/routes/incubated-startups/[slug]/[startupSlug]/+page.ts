import { error } from '@sveltejs/kit';
import content from '$lib/data/content.json';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const category = content.pages.incubatedStartups.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Category not found');

	const startup = category.startups.find((s) => s.slug === params.startupSlug);
	if (!startup) error(404, 'Startup not found');

	return { category, startup };
};
