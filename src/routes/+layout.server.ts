import { getSiteContent } from '$lib/server/siteContent';
import type { LayoutServerLoad } from './$types';

// Loaded once per request and handed to every page. Cached in-process, so this
// is a map lookup rather than a database round trip on most requests.
export const load: LayoutServerLoad = async () => {
	return { content: await getSiteContent() };
};
