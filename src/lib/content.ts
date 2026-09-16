// Site content accessor.
//
// Every page used to `import content from '$lib/data/content.json'`, which baked
// the copy into the bundle. It now comes from the site_content table, loaded once
// per request by the root layout and handed to this module before anything
// renders. content.json stays as the fallback, so the site still works if the
// database is unreachable or a section has not been seeded yet.

import fallback from '$lib/data/content.json';

type ContentDoc = typeof fallback;

// TIC Jobs ships with an empty `posts` array, which JSON alone types as never[].
// It holds the same shape as the startup board's posts, so say so — otherwise
// nothing can be added to it from the admin console without a cast.
export type SiteContent = Omit<ContentDoc, 'pages'> & {
	pages: Omit<ContentDoc['pages'], 'ticJobs'> & {
		ticJobs: Omit<ContentDoc['pages']['ticJobs'], 'posts'> & {
			posts: ContentDoc['pages']['startupJobs']['posts'];
		};
	};
};

let current: SiteContent = fallback as SiteContent;

export function setContent(next: Partial<SiteContent> | null | undefined): void {
	if (!next) return;
	current = { ...fallback, ...next } as SiteContent;
}

export function getContent(): SiteContent {
	return current;
}

// The sections the admin console exposes, in the order they appear there.
// `key` is the site_content primary key; a dotted key addresses a nested path.
export const CONTENT_SECTIONS: { key: string; label: string; group: string }[] = [
	{ key: 'nav', label: 'Navigation', group: 'Global' },
	{ key: 'eventBar', label: 'Announcement bar', group: 'Global' },
	{ key: 'homeHero', label: 'Home hero', group: 'Global' },
	{ key: 'cta', label: 'Call to action', group: 'Global' },
	{ key: 'error', label: 'Error page', group: 'Global' },
	{ key: 'seo', label: 'Search & social', group: 'Global' },
	{ key: 'footer', label: 'Footer', group: 'Global' },
	{ key: 'pages.about', label: 'About', group: 'Pages' },
	{ key: 'pages.whatHappens', label: 'What happens', group: 'Pages' },
	{ key: 'pages.governingBody', label: 'Governing body', group: 'Pages' },
	{ key: 'pages.committeeOfManagement', label: 'Committee of management', group: 'Pages' },
	{ key: 'pages.team', label: 'TIC team', group: 'Pages' },
	{ key: 'pages.mentors', label: 'Mentors', group: 'Pages' },
	{ key: 'pages.ticCoordinators', label: 'TIC coordinators', group: 'Pages' },
	{ key: 'pages.faq', label: 'FAQ', group: 'Pages' },
	{ key: 'pages.blog', label: 'Blog', group: 'Pages' },
	{ key: 'pages.incubation', label: 'Incubation', group: 'Pages' },
	{ key: 'pages.incubatedStartups', label: 'Incubated startups', group: 'Pages' },
	{ key: 'pages.programs', label: 'Schemes & programs', group: 'Pages' },
	{ key: 'pages.events', label: 'Events', group: 'Pages' },
	{ key: 'pages.schemes', label: 'Schemes', group: 'Pages' },
	{ key: 'pages.schemesFunding', label: 'Schemes · Funding', group: 'Pages' },
	{ key: 'pages.partners', label: 'Partners', group: 'Pages' },
	{ key: 'pages.opportunities', label: 'Opportunities', group: 'Pages' },
	{ key: 'pages.ticJobs', label: 'TIC jobs', group: 'Pages' },
	{ key: 'pages.startupJobs', label: 'Startup jobs', group: 'Pages' },
	{ key: 'pages.apply', label: 'Apply', group: 'Pages' },
	{ key: 'pages.contact', label: 'Contact', group: 'Pages' },
	{ key: 'pages.privacy', label: 'Privacy policy', group: 'Pages' },
	{ key: 'pages.terms', label: 'Terms of use', group: 'Pages' }
];

// Shapes for list fields the editor cannot infer on its own.
//
// "Add" clones the first item of a list, which works everywhere except a list
// that is currently empty — there is nothing to clone, so the editor would add a
// bare text box instead of a properly shaped entry. These templates fill that
// gap. The key is the list's own path within the content document; the value
// returns the shape of one item in it.
export const LIST_TEMPLATES: Record<string, () => unknown> = {
	// A role at the centre itself. Pre-filled with the parts that are the same on
	// every TIC posting, so what is left to write is the role and the description.
	'pages.ticJobs.posts': () => ({
		slug: '',
		role: '',
		company: 'IITG TIC',
		companySlug: 'iitg-tic',
		location: 'IIT Guwahati · in-person',
		type: 'Full-time',
		sector: '',
		posted: new Date().toISOString().slice(0, 10),
		description: '',
		applyLink: 'mailto:tic@iitg.ac.in'
	}),
	'pages.startupJobs.posts': () => ({
		slug: '',
		role: '',
		company: '',
		companySlug: '',
		location: '',
		type: 'Full-time',
		sector: '',
		posted: new Date().toISOString().slice(0, 10),
		description: '',
		applyLink: ''
	}),
	'pages.ticCoordinators.members': () => ({
		name: '',
		avatar: { src: '', alt: '' },
		role: '',
		bio: '',
		email: '',
		phone: ''
	}),
	'pages.schemes.schemes': () => ({
		name: '',
		shortName: '',
		provider: '',
		summary: '',
		support: [],
		href: ''
	}),
	'pages.schemesFunding.schemes': () => ({
		id: '',
		label: '',
		name: '',
		tagline: '',
		description: '',
		amountLabel: 'Funding available',
		amount: '',
		eligibility: [],
		help: []
	})
};

export function readPath(doc: unknown, key: string): unknown {
	return key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
			doc
		);
}

export function writePath(doc: Record<string, unknown>, key: string, value: unknown): void {
	const parts = key.split('.');
	let node = doc;
	for (const part of parts.slice(0, -1)) {
		if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
		node = node[part] as Record<string, unknown>;
	}
	node[parts[parts.length - 1]] = value;
}
