import { error } from '@sveltejs/kit';
import { CONTENT_SECTIONS } from '$lib/content';
import { getSection } from '$lib/server/siteContent';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	await parent();

	const section = CONTENT_SECTIONS.find((s) => s.key === params.key);
	if (!section) error(404, 'Unknown content section.');

	return { section, value: await getSection(section.key) };
};
