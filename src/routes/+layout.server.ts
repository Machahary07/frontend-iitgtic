import { getSiteContent } from '$lib/server/siteContent';
import type { LayoutServerLoad } from './$types';

// Run the server next to the database. Supabase lives in ap-southeast-2
// (Sydney); Vercel's default region is Washington, which put every query —
// several per page — on a trans-Pacific round trip. Inherited by every route.
export const config = { regions: ['syd1'] };

// Loaded once per request and handed to every page. Cached in-process, so this
// is a map lookup rather than a database round trip on most requests.
export const load: LayoutServerLoad = async () => {
	return { content: await getSiteContent() };
};
