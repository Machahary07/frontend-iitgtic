import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The home-page scaffold has been replaced by the content editor, which edits the
// same section — and every other one — against the database.
export const load: PageServerLoad = async () => {
	redirect(308, '/tic-admin/content/homeHero');
};
