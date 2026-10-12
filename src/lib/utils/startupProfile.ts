// A startup's public profile: the shape stored in startup_profiles.draft and
// .published, the layouts it can be shown in, and the one sanitiser every write
// passes through. Shared by the founder editor, the console and the public pages.

import { STARTUP_STAGES } from '$lib/content';

export type ProfileLayout = 'classic' | 'story' | 'one-pager';

export const PROFILE_LAYOUTS: { value: ProfileLayout; label: string; hint: string }[] = [
	{
		value: 'classic',
		label: 'Classic profile',
		hint: 'Every section in order, with an index alongside. Suits a complete profile.'
	},
	{
		value: 'story',
		label: 'Story roadmap',
		hint: 'Your milestones as stops on a road that draws itself as visitors scroll. Suits a journey with photos.'
	},
	{
		value: 'one-pager',
		label: 'One-pager',
		hint: 'A fact card, your numbers up front, funding and team on one page. Suits startups with traction.'
	}
];

export type ProfileGroup = 'current' | 'virtual' | 'graduated';
export type ProfileStage = 'current' | 'graduated' | 'exited';
export type DraftStatus = 'draft' | 'in_review' | 'sent_back' | 'approved';

export type Image = { src: string; alt: string };
export type Milestone = {
	year: string;
	/** The stop's title. */
	event: string;
	text: string;
	photo: string;
	/** A stop still ahead — drawn as the dashed part of the road. */
	upcoming: boolean;
};

export type StartupProfileData = {
	layout: ProfileLayout;
	name: string;
	tagline: string;
	oneLiner: string;
	description: string;
	sector: string;
	industry: string;
	stage: string;
	foundingYear: string;
	hqLocation: string;
	website: string;
	contactEmail: string;
	logo: Image;
	cover: Image;
	/** Story roadmap: the sentence over the hero. */
	headline: string;
	/** One-pager: the paragraph that opens it. */
	summary: string;
	businessModel: string;
	marketSize: string;
	raising: string;
	teamSize: string;
	problem: string;
	solution: string;
	features: string[];
	targetMarket: string;
	founderStory: { whatTheyBuilt: string; whatTicContributed: string; whereTheyAreNow: string };
	traction: { label: string; value: string; note: string }[];
	funding: { raised: string; grants: string[] };
	founders: { name: string; role: string; bio: string; photo: string }[];
	incubation: { program: string; duration: string; mentors: string[] };
	milestones: Milestone[];
	achievements: string[];
	mediaMentions: { outlet: string; title: string; url: string }[];
	partnerships: string[];
	techStack: string[];
	supportedBy: string[];
	impactCreated: string;
	ipPatents: string[];
	sdgAlignment: string[];
	testimonials: { quote: string; author: string; role: string }[];
	hiring: { isHiring: boolean; openRoles: number };
	socials: Record<SocialKey, string>;
	registration: { type: string; cin: string; gstin: string; dpiit: string; incorporatedOn: string };
	graduateOutcome: string;
	featured: boolean;
};

export const SOCIAL_KEYS = ['linkedin', 'twitter', 'instagram', 'facebook', 'github', 'youtube'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export function emptyProfile(): StartupProfileData {
	return {
		layout: 'classic',
		name: '',
		tagline: '',
		oneLiner: '',
		description: '',
		sector: '',
		industry: '',
		stage: '',
		foundingYear: '',
		hqLocation: '',
		website: '',
		contactEmail: '',
		logo: { src: '', alt: '' },
		cover: { src: '', alt: '' },
		headline: '',
		summary: '',
		businessModel: '',
		marketSize: '',
		raising: '',
		teamSize: '',
		problem: '',
		solution: '',
		features: [],
		targetMarket: '',
		founderStory: { whatTheyBuilt: '', whatTicContributed: '', whereTheyAreNow: '' },
		traction: [],
		funding: { raised: '', grants: [] },
		founders: [],
		incubation: { program: '', duration: '', mentors: [] },
		milestones: [],
		achievements: [],
		mediaMentions: [],
		partnerships: [],
		techStack: [],
		supportedBy: [],
		impactCreated: '',
		ipPatents: [],
		sdgAlignment: [],
		testimonials: [],
		hiring: { isHiring: false, openRoles: 0 },
		socials: { linkedin: '', twitter: '', instagram: '', facebook: '', github: '', youtube: '' },
		registration: { type: '', cin: '', gstin: '', dpiit: '', incorporatedOn: '' },
		graduateOutcome: '',
		featured: false
	};
}

// ---- sanitising -------------------------------------------------------------
//
// Founders write this and the public site renders it, so every value is forced
// to its expected type and length, and every link to http(s) — never trusted as
// it arrives. Unknown keys are dropped.

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, max = 400) =>
	(typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').trim().slice(0, max);
const text = (v: unknown) => str(v, 4000);
const list = <T>(v: unknown, max: number, item: (x: unknown) => T, keep: (x: T) => boolean): T[] =>
	(Array.isArray(v) ? v : []).slice(0, max).map(item).filter(keep);
const strings = (v: unknown, max = 30) => list(v, max, (x) => str(x), Boolean);

export function safeUrl(v: unknown): string {
	const s = str(v, 600);
	if (!s) return '';
	try {
		const u = new URL(s);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
	} catch {
		return '';
	}
}

function safeEmail(v: unknown): string {
	const s = str(v, 200).toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

const image = (v: unknown): Image => ({ src: safeUrl(obj(v).src), alt: str(obj(v).alt, 200) });

export function sanitizeProfile(input: unknown): StartupProfileData {
	const r = obj(input);
	const base = emptyProfile();
	const layout = PROFILE_LAYOUTS.some((l) => l.value === r.layout)
		? (r.layout as ProfileLayout)
		: base.layout;
	const story = obj(r.founderStory);
	const funding = obj(r.funding);
	const incubation = obj(r.incubation);
	const hiring = obj(r.hiring);
	const socials = obj(r.socials);
	const reg = obj(r.registration);

	return {
		layout,
		name: str(r.name, 120),
		tagline: str(r.tagline, 160),
		oneLiner: str(r.oneLiner, 300),
		description: text(r.description),
		sector: str(r.sector, 80),
		industry: str(r.industry, 120),
		stage: STARTUP_STAGES.includes(str(r.stage)) ? str(r.stage) : '',
		foundingYear: /^\d{4}$/.test(str(r.foundingYear)) ? str(r.foundingYear) : '',
		hqLocation: str(r.hqLocation, 120),
		website: safeUrl(r.website),
		contactEmail: safeEmail(r.contactEmail),
		logo: image(r.logo),
		cover: image(r.cover),
		headline: str(r.headline, 200),
		summary: text(r.summary),
		businessModel: text(r.businessModel),
		marketSize: text(r.marketSize),
		raising: str(r.raising, 160),
		teamSize: str(r.teamSize, 40),
		problem: text(r.problem),
		solution: text(r.solution),
		features: strings(r.features, 12),
		targetMarket: text(r.targetMarket),
		founderStory: {
			whatTheyBuilt: text(story.whatTheyBuilt),
			whatTicContributed: text(story.whatTicContributed),
			whereTheyAreNow: text(story.whereTheyAreNow)
		},
		traction: list(
			r.traction,
			8,
			(x) => ({ label: str(obj(x).label, 80), value: str(obj(x).value, 40), note: str(obj(x).note, 80) }),
			(t) => Boolean(t.label && t.value)
		),
		funding: { raised: str(funding.raised, 300), grants: strings(funding.grants, 12) },
		founders: list(
			r.founders,
			12,
			(x) => ({
				name: str(obj(x).name, 120),
				role: str(obj(x).role, 120),
				bio: str(obj(x).bio, 600),
				photo: safeUrl(obj(x).photo)
			}),
			(f) => Boolean(f.name)
		),
		incubation: {
			program: str(incubation.program, 120),
			duration: str(incubation.duration, 60),
			mentors: strings(incubation.mentors, 20)
		},
		milestones: list(
			r.milestones,
			16,
			(x) => ({
				year: str(obj(x).year, 20),
				event: str(obj(x).event, 160),
				text: str(obj(x).text, 1200),
				photo: safeUrl(obj(x).photo),
				upcoming: obj(x).upcoming === true
			}),
			(m) => Boolean(m.year && m.event)
		),
		achievements: strings(r.achievements, 20),
		mediaMentions: list(
			r.mediaMentions,
			20,
			(x) => ({ outlet: str(obj(x).outlet, 120), title: str(obj(x).title, 240), url: safeUrl(obj(x).url) }),
			(m) => Boolean(m.title)
		),
		partnerships: strings(r.partnerships, 20),
		techStack: strings(r.techStack, 30),
		supportedBy: strings(r.supportedBy, 20),
		impactCreated: text(r.impactCreated),
		ipPatents: strings(r.ipPatents, 20),
		sdgAlignment: strings(r.sdgAlignment, 17),
		testimonials: list(
			r.testimonials,
			8,
			(x) => ({ quote: str(obj(x).quote, 600), author: str(obj(x).author, 120), role: str(obj(x).role, 120) }),
			(t) => Boolean(t.quote)
		),
		hiring: {
			isHiring: hiring.isHiring === true,
			openRoles: Math.max(0, Math.min(999, Math.floor(Number(hiring.openRoles) || 0)))
		},
		socials: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, safeUrl(socials[k])])) as Record<
			SocialKey,
			string
		>,
		registration: {
			type: str(reg.type, 80),
			cin: str(reg.cin, 40),
			gstin: str(reg.gstin, 40),
			dpiit: str(reg.dpiit, 40),
			incorporatedOn: str(reg.incorporatedOn, 40)
		},
		graduateOutcome: str(r.graduateOutcome, 300),
		featured: r.featured === true
	};
}

/** What is missing before a profile can be sent for review. */
export function missingForReview(p: StartupProfileData): string[] {
	const missing: string[] = [];
	if (!p.name) missing.push('Startup name');
	if (!p.tagline) missing.push('Tagline');
	if (!p.sector) missing.push('Sector');
	if (!p.oneLiner) missing.push('One-liner');
	if (!p.logo.src) missing.push('Logo');
	if (p.layout === 'story' && p.milestones.length < 2) missing.push('At least two milestones');
	if (p.layout === 'one-pager' && p.traction.length === 0) missing.push('At least one traction figure');
	return missing;
}

// ---- pre-fill from the incubation application -----------------------------

const APPLICATION_STAGE: Record<string, string> = {
	Idea: 'Ideation',
	Prototype: 'Prototype',
	MVP: 'MVP',
	Revenue: 'Early revenue',
	Scaling: 'Growth'
};

const splitList = (v: unknown) =>
	str(v, 2000)
		.split(/[,\n]/)
		.map((s) => s.trim())
		.filter(Boolean);

/** A first draft from what the founder already told TIC in their application. */
export function profileFromApplication(
	answers: Record<string, unknown>,
	company: { name: string; website?: string | null; contactEmail?: string | null }
): StartupProfileData {
	const a = answers ?? {};
	const coFounders = Array.isArray(a.coFounders) ? (a.coFounders as Raw[]) : [];
	return sanitizeProfile({
		...emptyProfile(),
		name: company.name || a.startupName,
		oneLiner: str(a.productDescription, 300),
		summary: a.productDescription,
		industry: a.industry,
		stage: APPLICATION_STAGE[str(a.stage)] ?? '',
		foundingYear: a.yearFounded,
		hqLocation: a.location,
		website: company.website || a.website,
		contactEmail: company.contactEmail || a.email,
		problem: a.problem,
		solution: a.solution,
		targetMarket: a.targetCustomers,
		businessModel: a.revenueModel,
		teamSize: a.teamSize,
		techStack: splitList(a.techStack),
		partnerships: splitList(a.partnerships),
		founders: [
			{ name: a.fullName, role: a.role, bio: '', photo: '' },
			...coFounders.map((c) => ({ name: c.name, role: c.role, bio: '', photo: '' }))
		],
		socials: { linkedin: a.linkedin },
		incubation: { program: 'Incubation', duration: '', mentors: [] }
	});
}

export function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'startup'
	);
}

/** Which public groups a listed profile appears in. */
export function groupsFor(stage: ProfileStage, isVirtual: boolean): ProfileGroup[] {
	if (stage === 'graduated') return ['graduated'];
	if (stage === 'current') return isVirtual ? ['current', 'virtual'] : ['current'];
	return [];
}
