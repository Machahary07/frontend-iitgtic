import { error } from '@sveltejs/kit';
import content from '$lib/data/content.json';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const post = content.pages.events.posts.find((p) => p.slug === params.slug);
	if (!post) error(404, 'Event not found');
	return { post };
};
