// Page metadata, resolved from the content document.
//
// Every page carried a <title> and nothing else — no description, no Open
// Graph, no canonical — so a link to any of them shared into WhatsApp or
// LinkedIn rendered as a bare URL, and search engines had only the title to go
// on.
//
// The descriptions are not new copy. Almost every section already opens with a
// `hero.lede` or `hero.intro` that says what the page is, written by whoever
// wrote the page; this reads that. A section whose wording is edited in the
// admin console changes its own meta description with it.

import { getContent, readPath } from '$lib/content';

export type PageSeo = {
	title: string;
	description: string;
	/** Admin, auth and applicant-facing screens stay out of the index. */
	noindex: boolean;
};

// Route → the content section that describes it. Only static routes are listed;
// a dynamic one (a blog post, a role) sets its own, because the copy lives in
// the record rather than in a section.
const SECTION_FOR: Record<string, string> = {
	'/about': 'pages.about',
	'/about/what-happens': 'pages.whatHappens',
	'/about/governing-body': 'pages.governingBody',
	'/about/committee-of-management': 'pages.committeeOfManagement',
	'/about/team': 'pages.team',
	'/about/mentors': 'pages.mentors',
	'/about/tic-coordinators': 'pages.ticCoordinators',
	'/about/faq': 'pages.faq',
	'/about/blog': 'pages.blog',
	'/incubation': 'pages.incubation',
	'/incubated-startups': 'pages.incubatedStartups',
	'/programs': 'pages.programs',
	'/events': 'pages.events',
	'/schemes': 'pages.schemes',
	'/partners': 'pages.partners',
	'/opportunities': 'pages.opportunities',
	'/opportunities/tic-jobs': 'pages.ticJobs',
	'/opportunities/startup-jobs': 'pages.startupJobs',
	'/apply': 'pages.apply',
	'/contact': 'pages.contact',
	'/privacy': 'pages.privacy',
	'/terms': 'pages.terms'
};

// Nothing under these belongs in a search result: consoles, the auth plumbing,
// the pages that show one person their own application, and /status — an
// internal build checklist that names the architecture is not something to hand
// to a search engine.
const PRIVATE_PREFIXES = [
	'/tic-admin',
	'/opportunities/job-posting-admin',
	'/auth',
	'/application',
	'/login',
	'/status',
	// static/robots.txt already disallows this one; the two should not disagree.
	'/apply'
];

const FALLBACK_DESCRIPTION =
	'The Technology Incubation Centre at IIT Guwahati — incubation, mentorship, funding access and workspace for deep-tech founders in the North-East.';

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

// One line, no markup, short enough that a search result does not truncate
// mid-thought. 155 characters is the usual budget.
export function trimForMeta(value: string, max = 155): string {
	const flat = value.replace(/\s+/g, ' ').trim();
	if (flat.length <= max) return flat;

	const cut = flat.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-–—]$/, '')}…`;
}

export function seoFor(pathname: string): PageSeo {
	const content = getContent();
	const seo = (content as unknown as { seo?: Record<string, string> }).seo ?? {};
	const siteName = text(seo.siteName) || 'IIT Guwahati TIC';
	const noindex = PRIVATE_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);

	if (pathname === '/') {
		const home = content.homeHero as unknown as Record<string, unknown> | undefined;
		return {
			title: text(seo.homeTitle) || siteName,
			description: trimForMeta(
				text(seo.defaultDescription) || text(home?.lede) || FALLBACK_DESCRIPTION
			),
			noindex
		};
	}

	const section = SECTION_FOR[pathname];
	const node = section
		? (readPath(content, section) as Record<string, unknown> | undefined)
		: undefined;
	const hero = (node?.hero ?? {}) as Record<string, unknown>;

	// lede on most sections, intro on the ones built from the grid layout.
	const description =
		text(hero.lede) || text(hero.intro) || text(seo.defaultDescription) || FALLBACK_DESCRIPTION;

	return {
		title: text(node?.title) || siteName,
		description: trimForMeta(description),
		noindex
	};
}
