import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Companies were merged into Incubatees, which shows each accepted startup's
// company record next to its page on the website.
export const load: PageServerLoad = () => redirect(308, '/tic-admin/startups');
