import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { content } = await parent();
	const post = content.pages.blog.posts.find((p) => p.slug === params.slug);
	if (!post) error(404, 'Post not found');
	return { post };
};
