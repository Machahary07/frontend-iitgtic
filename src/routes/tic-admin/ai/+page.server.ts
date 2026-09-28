import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The assistant is a side panel on every console page now, not a page of its
// own. Old bookmarks and links land on the overview with the panel open.
export const load: PageServerLoad = async () => {
	redirect(303, '/tic-admin?assistant=open');
};
