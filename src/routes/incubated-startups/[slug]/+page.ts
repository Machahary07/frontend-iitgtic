import { error } from '@sveltejs/kit';
import content from '$lib/data/content.json';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const category = content.pages.incubatedStartups.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Category not found');
	return { category };
};
