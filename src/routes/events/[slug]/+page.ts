import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const post = content.pages.events.posts.find((p) => p.slug === params.slug);
	if (!post) error(404, 'Event not found');
	return { post };
};
