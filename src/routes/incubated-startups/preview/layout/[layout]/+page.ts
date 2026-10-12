import { error } from '@sveltejs/kit';
import { PROFILE_LAYOUTS, type ProfileLayout } from '$lib/utils/startupProfile';
import { sampleProfile } from '$lib/utils/sampleProfile';
import type { PageLoad } from './$types';

// What a layout looks like, filled with a made-up startup, for founders choosing one.
export const load: PageLoad = ({ params }) => {
	const layout = PROFILE_LAYOUTS.find((l) => l.value === params.layout);
	if (!layout) error(404, 'No such layout');
	return { layout, startup: sampleProfile(layout.value as ProfileLayout) };
};
