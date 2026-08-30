import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const category = content.pages.incubatedStartups.categories.find((c) => c.slug === params.slug);
	if (!category) error(404, 'Category not found');
	return { category };
};
