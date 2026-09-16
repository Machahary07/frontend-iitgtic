import { getSiteContent } from '$lib/server/siteContent';
import type { SiteContent } from '$lib/content';
import type { RequestHandler } from './$types';

const SITE = 'https://iitgtic.itsjeu.com';

const STATIC_ROUTES = [
	'/',
	'/about',
	'/about/what-happens',
	'/about/governing-body',
	'/about/committee-of-management',
	'/about/team',
	'/about/faq',
	'/about/blog',
	'/about/mentors',
	'/about/tic-coordinators',
	'/programs',
	'/events',
	'/schemes',
	'/schemes/funding',
	'/incubated-startups',
	'/incubation',
	'/opportunities',
	'/opportunities/tic-jobs',
	'/opportunities/startup-jobs',
	'/partners',
	'/contact',
	'/privacy',
	'/terms'
];

function buildUrls(content: SiteContent): string[] {
	const urls = [...STATIC_ROUTES];

	for (const p of content.pages.events.posts) urls.push(`/events/${p.slug}`);
	for (const p of content.pages.blog.posts) urls.push(`/about/blog/${p.slug}`);
	for (const p of content.pages.incubation.links) urls.push(`/incubation/${p.slug}`);

	for (const cat of content.pages.incubatedStartups.categories) {
		urls.push(`/incubated-startups/${cat.slug}`);
		for (const s of cat.startups) urls.push(`/incubated-startups/${cat.slug}/${s.slug}`);
	}

	for (const p of content.pages.ticJobs.posts) urls.push(`/opportunities/${p.slug}`);
	for (const p of content.pages.startupJobs.posts) urls.push(`/opportunities/${p.slug}`);

	return urls;
}

export const GET: RequestHandler = async () => {
	const content = await getSiteContent();

	const today = new Date().toISOString().split('T')[0];
	const urls = buildUrls(content);

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(path) => `	<url>
		<loc>${SITE}${path}</loc>
		<lastmod>${today}</lastmod>
		<changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq>
		<priority>${path === '/' ? '1.0' : '0.7'}</priority>
	</url>`
	)
	.join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
