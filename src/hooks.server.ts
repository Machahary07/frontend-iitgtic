import { randomUUID } from 'node:crypto';
import { dev } from '$app/environment';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { readTicAdminSession } from '$lib/server/ticAdminSession';
import type { Handle } from '@sveltejs/kit';

// Records one row per page view, admin routes included. Only HTML responses to
// GET requests are counted, so assets, API calls and the sitemap never land here.

const VISITOR_COOKIE = 'tic_visitor';
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

export const handle: Handle = async ({ event, resolve }) => {
	let visitorId = event.cookies.get(VISITOR_COOKIE);
	if (!visitorId) {
		visitorId = randomUUID();
		event.cookies.set(VISITOR_COOKIE, visitorId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: VISITOR_MAX_AGE
		});
	}

	const startedAt = Date.now();
	const response = await resolve(event);

	// A 404 for an asset still renders the HTML error page, so content-type alone
	// is not enough — dev-server module requests would be counted as visits.
	const path = event.url.pathname;
	const looksLikeAsset =
		path.startsWith('/node_modules') ||
		path.startsWith('/@') ||
		path.startsWith('/.well-known') ||
		path.startsWith('/_app') ||
		/\.[a-z0-9]{2,5}$/i.test(path);

	const isPageView =
		event.request.method === 'GET' &&
		!looksLikeAsset &&
		(response.headers.get('content-type') ?? '').includes('text/html');

	if (isPageView) {
		const admin = readTicAdminSession(event.cookies);
		const write = Promise.resolve(
			supabaseAdmin.from('page_views').insert({
				path,
				visitor_id: visitorId,
				user_id: admin?.userId ?? null,
				actor_label: admin ? `${admin.name || admin.email} (admin)` : null,
				is_admin: event.url.pathname.startsWith('/tic-admin'),
				referrer: event.request.headers.get('referer'),
				user_agent: event.request.headers.get('user-agent'),
				status: response.status,
				duration_ms: Date.now() - startedAt
			})
		).then(({ error }) => {
			if (error) console.error('page_views insert failed:', error.message);
		});

		// Logging must not slow the page down. Where the platform offers
		// waitUntil, the write is handed to it; otherwise it is left to settle on
		// its own, which can drop the occasional row if the instance is frozen
		// straight after the response.
		const waitUntil = (
			event.platform as { context?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined
		)?.context?.waitUntil;

		if (waitUntil) waitUntil(write);
		else void write.catch(() => {});
	}

	return response;
};
