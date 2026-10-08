// Site content accessor.
//
// Every page used to `import content from '$lib/data/content.json'`, which baked
// the copy into the bundle. It now comes from the site_content table, loaded once
// per request by the root layout and handed to this module before anything
// renders. content.json stays as the fallback, so the site still works if the
// database is unreachable or a section has not been seeded yet.

import fallback from '$lib/data/content.json';

type ContentDoc = typeof fallback;

// Lists that ship empty — job boards, the blog, the startup portfolio — are
// typed by JSON alone as never[], so every page reading them needs a cast. These
// are the shapes the console fills them with; they follow LIST_TEMPLATES below.

export type BlogPost = {
	slug: string;
	date: string;
	title: string;
	excerpt: string;
	author: string;
	readTime: string;
	coverImage: { src?: string; alt: string };
	body: ContentDoc['pages']['events']['posts'][number]['body'];
};

export type Startup = {
	slug: string;
	name: string;
	/** One of `pages.incubatedStartups.sectors` — the portfolio filters on it. */
	sector: string;
	tagline?: string;
	oneLiner?: string;
	industry?: string;
	/** Current status: one of STARTUP_STAGES. */
	stage?: string;
	foundingYear?: number;
	hqLocation?: string;
	description?: string;
	logo: { src?: string; alt: string };
	website?: string;
	/** Shown in the homepage founder stories when set and the story is filled in. */
	featured?: boolean;
	founderStory?: { whatTheyBuilt: string; whatTicContributed: string; whereTheyAreNow: string };
	socials?: Partial<
		Record<'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'github' | 'youtube', string>
	>;
	registration?: Record<string, string>;
	problem?: string;
	solution?: string;
	features?: string[];
	targetMarket?: string;
	traction?: { label: string; value: string }[];
	funding?: { raised?: string; grants?: string[] };
	incubation?: { program?: string; duration?: string; mentors?: string[] };
	founders?: { name: string; role: string; bio?: string }[];
	achievements?: string[];
	mediaMentions?: { outlet: string; title: string; url: string }[];
	partnerships?: string[];
	techStack?: string[];
	hiring?: { isHiring: boolean; rolesUrl?: string; openRoles?: number };
	contactEmail?: string;
	testimonials?: { quote: string; author: string; role?: string }[];
	/** Funding and market milestones, oldest first. */
	milestones?: { year: string; event: string }[];
	supportedBy?: string[];
	graduateOutcome?: string | null;
	impactCreated?: string;
	ipPatents?: string[];
	sdgAlignment?: string[];
};

type Pages = ContentDoc['pages'];
type WithPosts<T, P> = Omit<T, 'posts'> & { posts: P[] };

export type SiteContent = Omit<ContentDoc, 'pages'> & {
	pages: Omit<Pages, 'blog' | 'incubatedStartups'> & {
		blog: WithPosts<Pages['blog'], BlogPost>;
		incubatedStartups: Omit<Pages['incubatedStartups'], 'categories'> & {
			categories: (Omit<Pages['incubatedStartups']['categories'][number], 'startups'> & {
				startups: Startup[];
			})[];
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
	{ key: 'home', label: 'Home sections', group: 'Global' },
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
	'pages.ticCoordinators.members': () => ({
		name: '',
		avatar: { src: '', alt: '' },
		role: '',
		bio: '',
		email: '',
		phone: ''
	}),
	'pages.ticCoordinators.facultyCoordinators.members': () => ({
		name: '',
		avatar: { src: '', alt: '' },
		role: 'TIC Coordinator',
		affiliation: '',
		bio: ''
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
	}),
	'pages.incubatedStartups.categories[].startups': () => ({
		slug: '',
		name: '',
		sector: '',
		stage: '',
		tagline: '',
		oneLiner: '',
		industry: '',
		foundingYear: new Date().getFullYear(),
		hqLocation: '',
		description: '',
		logo: { src: '', alt: '' },
		website: '',
		featured: false,
		founderStory: { whatTheyBuilt: '', whatTicContributed: '', whereTheyAreNow: '' },
		milestones: [],
		funding: { raised: '', grants: [] },
		traction: [],
		founders: [],
		problem: '',
		solution: '',
		features: [],
		targetMarket: '',
		incubation: { program: '', duration: '', mentors: [] },
		achievements: [],
		mediaMentions: [],
		partnerships: [],
		techStack: [],
		supportedBy: [],
		impactCreated: '',
		ipPatents: [],
		sdgAlignment: [],
		testimonials: [],
		hiring: { isHiring: false, rolesUrl: '/opportunities', openRoles: 0 },
		contactEmail: '',
		socials: { linkedin: '', twitter: '', instagram: '', facebook: '', github: '', youtube: '' },
		registration: { type: '', cin: '', gstin: '', dpiit: '', incorporatedOn: '' },
		graduateOutcome: ''
	}),
	// The startup's own lists start empty too, and most hold small records.
	'pages.incubatedStartups.categories[].startups[].milestones': () => ({ year: '', event: '' }),
	'pages.incubatedStartups.categories[].startups[].traction': () => ({ label: '', value: '' }),
	'pages.incubatedStartups.categories[].startups[].founders': () => ({
		name: '',
		role: '',
		bio: ''
	}),
	'pages.incubatedStartups.categories[].startups[].mediaMentions': () => ({
		outlet: '',
		title: '',
		url: ''
	}),
	'pages.incubatedStartups.categories[].startups[].testimonials': () => ({
		quote: '',
		author: '',
		role: ''
	}),
	'pages.partners.partners': () => ({ name: '', image: '', href: '', category: '', enables: '' })
};

export const STARTUP_STAGES = [
	'Ideation',
	'Proof of concept',
	'Prototype',
	'MVP',
	'Early revenue',
	'Growth'
];

export type FieldOption = { value: string; label: string };

// Fields that take one of a known set of values, shown as a dropdown instead of
// a text box. A typo in a sector or a partner category would quietly drop that
// entry out of a filter or a group, so these are picked, not typed. Keyed like
// LIST_TEMPLATES; each receives the whole section being edited, so a list the
// section itself holds (partner categories, sectors) stays editable there.
export const FIELD_OPTIONS: Record<string, (section: unknown) => FieldOption[]> = {
	'pages.partners.partners[].category': (section) =>
		listAt<{ id: string; title: string }>(section, 'categories').map((c) => ({
			value: c.id,
			label: c.title
		})),
	'pages.incubatedStartups.categories[].startups[].sector': (section) =>
		listAt<string>(section, 'sectors').map((s) => ({ value: s, label: s })),
	'pages.incubatedStartups.categories[].startups[].stage': () =>
		STARTUP_STAGES.map((s) => ({ value: s, label: s }))
};

function listAt<T>(section: unknown, field: string): T[] {
	const list = (section as Record<string, unknown> | null)?.[field];
	return Array.isArray(list) ? (list as T[]) : [];
}

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
