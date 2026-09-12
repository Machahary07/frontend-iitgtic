import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { readTicAdminSession } from '$lib/server/ticAdminSession';
import { readFounderSession } from '$lib/server/founderSession';
import { redirect, type Handle } from '@sveltejs/kit';

// Records one row per page view, admin routes included. Only HTML responses to
// GET requests are counted, so assets, API calls and the sitemap never land here.
//
// Deliberately sets no visitor cookie: analytics must not plant a tracking
// identifier in anyone's browser, which keeps the site to strictly necessary
// cookies only. Each view gets a fresh throwaway id instead — page_views.visitor_id
// is NOT NULL, so it still needs a value — at the cost of cross-page uniqueness.

// Where the company job-posting portal used to live, along with the two public
// pages that were the way into the application. Everything they did now happens
// inside the founder console, so an old bookmark or an old email link lands on
// the page that replaced it rather than on a 404.
//
// 308 rather than 302: these paths are not coming back, and a permanent redirect
// is what stops search engines carrying the old URLs around.
const MOVED: Record<string, string> = {
	'/opportunities/job-posting-admin': '/founder',
	'/opportunities/job-posting-admin/applicants': '/founder/applicants',
	'/opportunities/job-posting-admin/admin-settings': '/founder/settings',
	// Registering a startup moved inside the console, so the way in is an account
	// first. /signup was the company sign-up and is gone with it.
	'/opportunities/job-posting-admin/signup': '/apply',
	'/signup': '/apply',
	'/opportunities/job-posting-admin/edit/new': '/founder/jobs/new',
	'/application': '/founder/application',
	'/account': '/founder/application'
};

export const handle: Handle = async ({ event, resolve }) => {
	const visitorId = randomUUID();

	const moved = MOVED[event.url.pathname.replace(/\/$/, '') || '/'];
	if (moved) redirect(308, moved);

	// An edit link for a specific role kept its id, so it is matched by shape
	// rather than by name.
	const editMatch = event.url.pathname.match(/^\/opportunities\/job-posting-admin\/edit\/([^/]+)$/);
	if (editMatch) redirect(308, `/founder/jobs/${editMatch[1]}`);

	// /account/<id> showed one submitted application; the console lists them all.
	if (/^\/account\/[^/]+$/.test(event.url.pathname)) redirect(308, '/founder/application');

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
		const founder = admin ? null : readFounderSession(event.cookies);
		const write = Promise.resolve(
			supabaseAdmin.from('page_views').insert({
				path,
				visitor_id: visitorId,
				user_id: admin?.userId ?? founder?.userId ?? null,
				actor_label: admin
					? `${admin.name || admin.email} (admin)`
					: founder
						? `${founder.name || founder.email} (founder)`
						: null,
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
