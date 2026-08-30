import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const pillar = content.pages.incubation.links.find((p) => p.slug === params.slug);
	if (!pillar) error(404, 'Section not found');
	return { pillar };
};
