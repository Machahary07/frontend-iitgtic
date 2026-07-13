import { error } from '@sveltejs/kit';
import content from '$lib/data/content.json';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const post = content.pages.blog.posts.find((p) => p.slug === params.slug);
	if (!post) error(404, 'Post not found');
	return { post };
};
