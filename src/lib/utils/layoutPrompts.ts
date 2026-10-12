// A prompt a founder can paste into ChatGPT to write their public profile for
// one layout. It carries what they have already filled in (or what TIC pre-filled
// from their application), names the exact fields the layout shows — with the
// editor's own labels, so the answer pastes straight back — and asks for the
// images that layout needs at the end.

import { PROFILE_LAYOUTS, type ProfileLayout, type StartupProfileData } from '$lib/utils/startupProfile';

type Field = { label: string; ask: string };

// Every layout leads with these; the long About is the heart of each page.
const CORE: Field[] = [
	{ label: 'Tagline', ask: 'one short line, at most 10 words' },
	{ label: 'One-liner', ask: 'one sentence: what we do, for whom' },
	{
		label: 'About your startup',
		ask: '4 to 6 full paragraphs, 400–900 words in all, separated by blank lines — the story of the company, the product, who it serves and where it is going. Readers here like detail, so write generously.'
	},
	{ label: 'Problem', ask: '1–2 paragraphs' },
	{ label: 'Solution', ask: '1–2 paragraphs' }
];

const FIELDS: Record<ProfileLayout, Field[]> = {
	classic: [
		...CORE,
		{ label: 'Target market', ask: 'one paragraph' },
		{ label: 'Key features', ask: '5–9 items, one per line' },
		{ label: 'Numbers', ask: '3–4 rows as "figure | what it counts", only figures given below' },
		{ label: 'Milestones', ask: 'one per line as "year | title | one or two sentences", oldest first' },
		{ label: 'Achievements and awards', ask: 'one per line, only ones given below' }
	],
	story: [
		...CORE,
		{ label: 'Headline', ask: 'one striking sentence of at most 12 words for the top of the page, ideally a before-and-after' },
		{
			label: 'Milestones',
			ask: '4–7 stops, oldest first, each as "year | title | 2–4 sentences". Make the last one or two the plans still ahead, and say so'
		},
		{ label: 'What you built', ask: 'one paragraph' },
		{ label: 'What TIC contributed', ask: 'one paragraph — leave a placeholder if not given' },
		{ label: 'Where you are now', ask: 'one paragraph' },
		{ label: 'Numbers', ask: '3–4 rows as "figure | what it counts", only figures given below' },
		{ label: 'Testimonials', ask: 'one quote as "quote | who said it | their role", only if given below' }
	],
	'one-pager': [
		...CORE,
		{ label: 'Summary', ask: 'one paragraph of at most 80 words an investor reads first' },
		{ label: 'Numbers', ask: '4 rows as "figure | what it counts | growth note", only figures given below' },
		{ label: 'Target market', ask: 'one paragraph' },
		{ label: 'Market size', ask: 'one or two sentences, only if a figure is given below' },
		{ label: 'Business model', ask: 'one paragraph: how the company earns' },
		{ label: 'Raising now', ask: 'one line, e.g. "Pre-Series A · ₹5 Cr", only if given below' },
		{ label: 'Grants', ask: 'one per line, only ones given below' },
		{ label: 'Milestones', ask: 'one per line as "year | title", the last one being what is next' }
	],
	showcase: [
		...CORE,
		{
			label: 'Key features',
			ask: '3–6 short headlines, one per line — each will sit beside a photo, so each should describe something a camera can show'
		},
		{ label: 'Target market', ask: 'one paragraph: who it is for' },
		{ label: 'Business model', ask: 'one paragraph: how it pays' },
		{ label: 'Numbers', ask: '3–4 rows as "figure | what it counts", only figures given below' },
		{ label: 'Testimonials', ask: 'one quote as "quote | who said it | their role", only if given below' }
	],
	lab: [
		...CORE,
		{
			label: 'Technology readiness level',
			ask: 'a number from 1 to 9 with one line on why, based only on what is given below'
		},
		{ label: 'Specifications', ask: '3–8 rows as "what it measures | value", only facts given below' },
		{ label: 'Patents and IP', ask: 'one per line with status (filed / granted), only ones given below' },
		{ label: 'Tech stack', ask: 'one per line' },
		{ label: 'Partnerships', ask: 'research and industry partners, one per line, only ones given below' },
		{ label: 'Impact so far', ask: 'one paragraph' },
		{ label: 'SDGs', ask: 'the 1–4 UN Sustainable Development Goals it serves, one per line as "SDG n · name"' }
	]
};

const IMAGES: Record<ProfileLayout, string[]> = {
	classic: ['Logo — square, at least 400 × 400, PNG with a plain or transparent background', 'A photo of each founder — square or portrait'],
	story: [
		'Logo — square, at least 400 × 400',
		'Cover photo — wide landscape, at least 2000 px across, the founders or product in a real setting; it sits behind the headline, so keep the middle calm',
		'One photo per milestone — 4:3, showing that moment',
		'A portrait of each founder — 4:5'
	],
	'one-pager': ['Logo — square, at least 400 × 400', 'A headshot of each founder — square'],
	showcase: [
		'Logo — square, at least 400 × 400',
		'Cover photo — 2400 × 1200, the product in use, no text on it',
		'One photo per key feature — 16:10, showing exactly that feature',
		'3 or more extra photos for the gallery — 4:3, in the field, with customers, at work',
		'A portrait of each founder — 4:5'
	],
	lab: [
		'Logo — square, at least 400 × 400',
		'Technical image — square: a device render, cross-section, prototype on the bench or lab setup',
		'A photo of each researcher or founder — square'
	]
};

/** The fields of a profile that have something in them, as plain lines. */
function knownFacts(p: StartupProfileData): string {
	const lines: string[] = [];
	const add = (label: string, value: string | undefined | null) => {
		if (value && value.trim()) lines.push(`- ${label}: ${value.trim()}`);
	};
	add('Name', p.name);
	add('Tagline', p.tagline);
	add('One-liner', p.oneLiner);
	add('Sector', p.sector);
	add('Industry', p.industry);
	add('Stage', p.stage);
	add('Founded', p.foundingYear);
	add('Headquarters', p.hqLocation);
	add('Team size', p.teamSize);
	add('Website', p.website);
	add('About', p.description);
	add('Problem', p.problem);
	add('Solution', p.solution);
	add('Target market', p.targetMarket);
	add('Market size', p.marketSize);
	add('Business model', p.businessModel);
	add('Raising', p.raising);
	add('Summary', p.summary);
	add('Key features', p.features.join('; '));
	add('Numbers', p.traction.map((t) => `${t.value} ${t.label}${t.note ? ` (${t.note})` : ''}`).join('; '));
	add('Capital raised', p.funding.raised);
	add('Grants', p.funding.grants.join('; '));
	add('Founders', p.founders.map((f) => [f.name, f.role, f.bio].filter(Boolean).join(', ')).join('; '));
	add('Mentors', p.incubation.mentors.join('; '));
	add('Milestones', p.milestones.map((m) => `${m.year} ${m.event}${m.text ? ` — ${m.text}` : ''}${m.upcoming ? ' (planned)' : ''}`).join('; '));
	add('What they built', p.founderStory.whatTheyBuilt);
	add('What TIC contributed', p.founderStory.whatTicContributed);
	add('Where they are now', p.founderStory.whereTheyAreNow);
	add('Achievements', p.achievements.join('; '));
	add('Press', p.mediaMentions.map((m) => `${m.title}${m.outlet ? ` (${m.outlet})` : ''}`).join('; '));
	add('Partnerships', [...p.partnerships, ...p.supportedBy].join('; '));
	add('Tech stack', p.techStack.join('; '));
	add('Patents and IP', p.ipPatents.join('; '));
	add('Specifications', p.specs.map((s) => `${s.label}: ${s.value}`).join('; '));
	add('Technology readiness level', p.trl && `TRL ${p.trl}`);
	add('Impact', p.impactCreated);
	add('SDGs', p.sdgAlignment.join('; '));
	add('Testimonials', p.testimonials.map((t) => `"${t.quote}" — ${[t.author, t.role].filter(Boolean).join(', ')}`).join('; '));
	return lines.length ? lines.join('\n') : '- (nothing filled in yet)';
}

export function layoutPrompt(profile: StartupProfileData, layout: ProfileLayout): string {
	const name = profile.name || 'our startup';
	const info = PROFILE_LAYOUTS.find((l) => l.value === layout)!;
	const fields = FIELDS[layout].map((f, i) => `${i + 1}. ${f.label} — ${f.ask}`).join('\n');
	const images = IMAGES[layout].map((img) => `- ${img}`).join('\n');

	return `You are helping ${name}, a startup incubated at the Technology Incubation Centre, IIT Guwahati (TIC IITG), write its public profile page on the TIC website.

The page uses the "${info.label}" layout: ${info.hint}

WHAT WE KNOW ABOUT ${name.toUpperCase()}
${knownFacts(profile)}

WRITE THESE FIELDS, IN THIS ORDER
${fields}

RULES
- Use only the facts above. Never invent numbers, customers, awards, funding, partners, patents or dates. Where something is needed but not given, write [ASK FOUNDER: what is missing] instead.
- Indian English, warm and confident, plain words. No buzzwords, no exclamation marks, no emojis.
- Start each field with its name as a heading exactly as written above, then put the text in its own code block so it can be copied in one click.
- For lists, put one item per line. For rows, keep the "|" separators.

AT THE END
Add a section titled "Images you'll need" listing each image this layout uses, with the size, what it should show and one or two ideas specific to ${name}:
${images}`;
}
