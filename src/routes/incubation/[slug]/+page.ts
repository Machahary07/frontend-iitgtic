import { error } from '@sveltejs/kit';
import content from '$lib/data/content.json';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const pillar = content.pages.incubation.links.find((p) => p.slug === params.slug);
	if (!pillar) error(404, 'Section not found');
	return { pillar };
};
