// CEO website revision (Urmi Buragohain, 21 Sept 2026) — the content and data
// side. Layout is built separately; this adds the fields it renders from and
// sweeps the copy.
//
//   node scripts/content-patch.js scripts/patches/2026-09-26-ceo-revision.js [--apply]
//
// Figures marked `verified: false` are the CEO's, pending confirmation from TIC;
// the homepage shows only verified items, so they can sit here safely until then.

const home = {
	proof: {
		eyebrow: 'IITG-TIC at a glance',
		items: [
			{
				value: 'Since 2009',
				label: 'One of the first technology incubators in the North-East',
				verified: true
			},
			{
				value: 'TDB · MeitY · MSME',
				label: 'Supported and recognised by the Government of India',
				verified: true
			},
			{
				value: 'GENESIS',
				label: "Implementing partner for MeitY's startup programme in the North-East",
				verified: true
			},
			{
				value: '120+',
				label: 'Startups affiliated with the centre',
				verified: false
			},
			{
				value: '₹600 Cr+',
				label: 'Aggregate valuation of those startups',
				verified: false
			}
		]
	},
	why: {
		eyebrow: 'Why IITG-TIC',
		headlineLead: 'Not a generic incubator.',
		headlineEmphasis: 'An IIT, in the Northeast, built for DeepTech.',
		items: [
			{
				id: 'iitg',
				title: 'Why IIT Guwahati',
				heading: 'A research university behind every venture.',
				body: "Incubated teams build next to one of India's leading technical institutes — its faculty as mentors, its labs and testing facilities for building and validating product, and its students as the first hires. That depth is hard to find outside a campus like this one."
			},
			{
				id: 'deeptech',
				title: 'Why DeepTech',
				heading: 'Hard problems need patient builders.',
				body: "Ventures built on science — energy, materials, electronics, biotech, robotics — take longer to reach market and need labs, IP and technical judgement that a general-purpose incubator can't offer. That is exactly what an IIT is built to provide."
			},
			{
				id: 'northeast',
				title: 'Why the Northeast',
				heading: 'The next innovation economy is being built here.',
				body: "IITG-TIC has anchored the region's startup ecosystem since 2009 and implements MeitY's GENESIS programme across the North-East. Founders from the region shouldn't have to leave it to build — and its challenges, from energy to agriculture, are worth building for."
			}
		]
	},
	journey: {
		eyebrow: 'From lab to market',
		headlineLead: "We don't just support startups.",
		headlineEmphasis: 'We connect them to an ecosystem.',
		intro:
			"IIT Guwahati sits at the centre of the Northeast's innovation economy. IITG-TIC is how a founder or researcher reaches all of it — each step opening access to the next.",
		steps: [
			{
				title: 'Research',
				access: 'IITG faculty & expertise',
				body: "Work with faculty from across the institute's departments — as mentors, collaborators and technical reviewers.",
				href: '/incubation/technical'
			},
			{
				title: 'Technology',
				access: 'Labs & testing facilities',
				body: 'Electronics, biotechnology, machining and fabrication labs to turn a prototype into a product.',
				href: '/incubation/infrastructure'
			},
			{
				title: 'Incubation',
				access: 'Programme, workspace & talent',
				body: "In-house or virtual incubation, workspace in the Technology Complex, and IIT Guwahati's students as your first team.",
				href: '/incubation/support'
			},
			{
				title: 'Capital',
				access: 'Grants, seed funds & investors',
				body: 'Soft loans, government schemes such as SISFS and GENESIS, and introductions to investors.',
				href: '/incubation/funding'
			},
			{
				title: 'Industry',
				access: 'Pilots & corporate partners',
				body: 'Validation and pilot projects with industry and PSU partners — a working prototype becomes a tested product with a reference customer.',
				href: '/partners'
			},
			{
				title: 'Markets',
				access: 'Government & ecosystem networks',
				body: 'Programmes, showcases and government networks that take ventures from the region to national and global markets.',
				href: '/programs'
			}
		]
	},
	pathways: {
		eyebrow: 'How can we work together?',
		headlineLead: 'Whoever you are,',
		headlineEmphasis: "there's a way in.",
		items: [
			{
				id: 'founder',
				audience: 'I am a Founder',
				body: 'Incubate your DeepTech venture at IIT Guwahati — in-house or virtually — with access to labs, faculty, capital and markets.',
				ctaLabel: 'Apply for incubation',
				href: '/apply'
			},
			{
				id: 'researcher',
				audience: 'I am a Researcher',
				body: 'Take technology out of the lab and into a company. We work with faculty, scholars and students turning research into ventures.',
				ctaLabel: 'See how incubation works',
				href: '/incubation'
			},
			{
				id: 'investor',
				audience: 'I am an Investor',
				body: 'Meet DeepTech ventures built on IIT Guwahati research, from the Northeast and beyond.',
				ctaLabel: 'Explore the portfolio',
				href: '/incubated-startups'
			},
			{
				id: 'corporate',
				audience: 'I am a Corporate',
				body: 'Run pilots, set innovation challenges or partner on CSR with startups solving problems in your sector.',
				ctaLabel: 'Partner with us',
				href: '/contact'
			},
			{
				id: 'student',
				audience: 'I am a Student',
				body: 'Join events and workshops, intern at an incubated startup, or start building an idea of your own.',
				ctaLabel: 'Find opportunities',
				href: '/opportunities'
			},
			{
				id: 'government',
				audience: 'I am a Government / Ecosystem Partner',
				body: "Work with us on programmes and schemes that grow the Northeast's innovation economy.",
				ctaLabel: 'Talk to us',
				href: '/contact'
			}
		]
	},
	stories: {
		eyebrow: 'Built at IITG-TIC',
		headlineLead: 'Founder stories',
		headlineEmphasis: 'from the centre.',
		intro: 'What they built, what the centre brought to it, and where they are now.',
		ctaLabel: 'See all startups',
		href: '/incubated-startups'
	}
};

const partnerCategories = [
	{
		id: 'government',
		title: 'Government & Public Institutions',
		description:
			'Ministries and public bodies whose schemes and recognition fund the centre and the startups it incubates.'
	},
	{
		id: 'industry',
		title: 'Industry & Corporate',
		description:
			'Companies and PSUs that open pilots, validation and market access for incubated startups.'
	},
	{
		id: 'academic',
		title: 'Academic & Ecosystem',
		description: 'Institutions and networks that bring research depth, mentorship and programmes.'
	},
	{
		id: 'capital',
		title: 'Investment & Capital',
		description: 'Funds and investors that back ventures built at the centre.'
	}
];

// Sector is a fixed list rather than free text so the portfolio can filter on
// it. Editable in the console under Incubated startups › Sectors.
const sectors = [
	'Clean Energy & Climate',
	'Agriculture & Food',
	'Health & Life Sciences',
	'Electronics & Semiconductors',
	'Robotics & Automation',
	'AI, Data & Software',
	'Advanced Materials & Manufacturing',
	'Water & Environment',
	'Mobility & Aerospace',
	'Education & Social Impact'
];

const partner = (name, category, enables) => [
	{ key: 'pages.partners', path: `partners[name=${name}].category`, add: category },
	{ key: 'pages.partners', path: `partners[name=${name}].enables`, add: enables }
];

const rename = (key, listPath, href, from, to) => ({
	key,
	path: `${listPath}[href=${href}].label`,
	from,
	to
});

// The five incubation pages, reframed from what the centre gives to what a
// founder gets access to. Slugs and URLs stay as they are.
const incubationTitles = [
	['support', 'Incubation Support', 'Incubation Programme'],
	['infrastructure', 'Infrastructure Support', 'Labs & Infrastructure'],
	['funding', 'Funding Support', 'Access to Capital'],
	['technical', 'Technical Support', 'Faculty & Technical Expertise'],
	['residence', 'Residence Support', 'Campus Residence']
];

export default [
	// ── New homepage sections ──────────────────────────────────────────────────
	{ key: 'home', path: '', add: home },

	// ── Partners: grouped by category, each saying what it enables ────────────
	{ key: 'pages.partners', path: 'categories', add: partnerCategories },
	...partner(
		'IIT Guwahati',
		'academic',
		'Host institute — faculty expertise, labs, research infrastructure and student talent for every incubated startup.'
	),
	...partner(
		'MeitY',
		'government',
		"Funded the centre's core infrastructure and soft-loan facility, and runs the GENESIS programme that IITG-TIC implements in the North-East."
	),
	...partner(
		'MSME',
		'government',
		'Recognises IITG-TIC as an approved Business Incubator under the Ministry of Micro, Small and Medium Enterprises.'
	),
	...partner(
		'Startup India',
		'government',
		'Startup India Seed Fund Scheme — seed grants and funding for DPIIT-recognised startups, given through IITG-TIC.'
	),
	...partner(
		'Technology Development Board',
		'government',
		'Grant assistance to IITG-TIC for supporting startup units, under the Ministry of Science & Technology.'
	),
	{
		key: 'pages.partners',
		path: 'hero.lede',
		from: "The centre's work is supported by a network across government, industry and academia — each contributing the capital, frameworks or recognition that make our incubation programmes possible.",
		to: 'IITG-TIC connects founders to a network across government, industry, academia and capital. Each partner opens a specific door — funding, pilots, technical expertise, market access, mentorship or programmes.'
	},

	// ── Startups: a fixed sector list for filtering ───────────────────────────
	{ key: 'pages.incubatedStartups', path: 'sectors', add: sectors },
	{
		key: 'pages.incubatedStartups',
		path: 'hero.intro',
		from: "Three views of the cohort — the teams currently inside the centre, the ones we support remotely on our virtual track, and the alumni that have graduated and moved on. Each list is small on purpose; we'd rather work deeply with a few than thinly with many.",
		to: "Three views of the portfolio — the teams currently inside the centre, the ones building remotely on our virtual track, and the alumni that have graduated and moved on. Each list is small on purpose; we'd rather work deeply with a few than thinly with many."
	},
	{
		key: 'pages.incubatedStartups',
		path: 'categories[slug=virtual].hero.headlineLead',
		from: 'Same support,',
		to: 'Same access,'
	},
	{
		key: 'pages.incubatedStartups',
		path: 'categories[slug=virtual].tagline',
		from: 'Founders we support remotely — same depth of engagement, none of the relocation.',
		to: 'Founders building remotely — the same access to labs, faculty and networks, none of the relocation.'
	},

	// ── "Support" → "access" ──────────────────────────────────────────────────
	{
		key: 'pages.about',
		path: 'hero.intro',
		from: 'IITG-TIC is the Technology Incubation Centre of IIT Guwahati — a home for researchers, students and founders to turn early-stage ideas into businesses worth backing. We pair entrepreneurs with multidisciplinary mentors, run technical and business support, and lower the risk around an idea so it can grow into a venture that stands on its own.',
		to: "IITG-TIC is IIT Guwahati's platform for building DeepTech ventures and strengthening the innovation economy of Northeast India. We connect researchers, students and founders to the institute's faculty, labs and talent — and through it to capital, industry, markets and government networks — so an idea from the lab can grow into a venture that stands on its own."
	},
	{
		key: 'pages.about',
		path: 'links[href=/about/what-happens].tagline',
		from: 'Know what happens inside the centre — the mission, the support, and the day-to-day work.',
		to: 'Know what happens inside the centre — the mission, what founders get access to, and the day-to-day work.'
	},
	{
		key: 'pages.whatHappens',
		path: 'sections[id=infrastructure].label',
		from: 'Infrastructure & Support',
		to: 'Infrastructure & Access'
	},
	{
		key: 'pages.whatHappens',
		path: 'sections[id=infrastructure].eyebrow',
		from: 'Infrastructure & Support',
		to: 'Infrastructure & Access'
	},
	{
		key: 'pages.whatHappens',
		path: 'sections[id=infrastructure].paragraphs.0',
		from: 'Technical support, business mentoring, and a soft-loan facility — subject to availability — are the key services of this centre. Spreading across an area of approximately 4,000 square metres within the Technology Complex of IIT Guwahati, IITG-TIC has the adequate infrastructure for this endeavour.',
		to: 'Access to technical expertise, business mentoring and a soft-loan facility — subject to availability — is at the heart of the centre. Spread across approximately 4,000 square metres within the Technology Complex of IIT Guwahati, IITG-TIC has the infrastructure to back it.'
	},
	{
		key: 'pages.whatHappens',
		path: 'sections[id=infrastructure].callout.text',
		from: 'Wondering what working out of this space actually looks like? Take a closer look at our incubation programmes and the support we offer.',
		to: 'Wondering what working out of this space actually looks like? Take a closer look at our incubation programmes and everything founders get access to.'
	},
	{
		key: 'pages.incubation',
		path: 'hero.headlineLead',
		from: 'Five forms of support,',
		to: 'Five kinds of access,'
	},
	...incubationTitles.map(([slug, from, to]) => ({
		key: 'pages.incubation',
		path: `links[slug=${slug}].title`,
		from,
		to
	})),
	{
		key: 'pages.incubation',
		path: 'links[slug=support].hero.eyebrow',
		from: 'Incubation · Programme support',
		to: 'Incubation · Programme'
	},
	{
		key: 'pages.incubation',
		path: 'links[slug=support].hero.lede',
		from: "IITG-TIC offers two ways to incubate — a fully equipped in-house programme inside our campus, and a digital track for founders who can't be physically here. The support stays the same; the geography is yours to choose.",
		to: "IITG-TIC offers two ways to incubate — a fully equipped in-house programme inside our campus, and a digital track for founders who can't be physically here. The access stays the same; the geography is yours to choose."
	},
	{
		key: 'pages.incubation',
		path: 'links[slug=infrastructure].sections.0.paragraphs.1',
		from: "Office furniture is provided. On-campus accommodation is offered subject to availability — see our residence-support page if you'll need it.",
		to: "Office furniture is provided. On-campus accommodation is offered subject to availability — see the Campus Residence page if you'll need it."
	},
	{
		key: 'pages.incubation',
		path: 'links[slug=technical].sections.1.paragraphs.0',
		from: 'Our mentors are faculty from IIT Guwahati. They provide full technical support — sitting in on architecture reviews, design reviews and code reviews as engineers, not as evaluators.',
		to: 'Our mentors are faculty from IIT Guwahati, and founders get their full technical depth — they sit in on architecture reviews, design reviews and code reviews as engineers, not as evaluators.'
	},
	{
		key: 'pages.incubation',
		path: 'links[slug=residence].sections.2.paragraphs.0',
		from: "If you'll need residence support to join a cohort, mention it in your application — it helps us plan early and gives us time to confirm availability.",
		to: "If you'll need campus residence to join a cohort, mention it in your application — it helps us plan early and gives us time to confirm availability."
	},
	...incubationTitles.map(([slug, from, to]) =>
		rename('nav', 'leftLinks.2.dropdown', `/incubation/${slug}`, from, to)
	),
	...incubationTitles
		.filter(([slug]) => ['support', 'funding', 'technical'].includes(slug))
		.map(([slug, from, to]) =>
			rename('footer', 'linkGroups.0.links', `/incubation/${slug}`, from, to)
		),
	{
		key: 'pages.programs',
		path: 'hero.intro',
		from: 'Everything the centre puts on for founders — the events and workshops that happen through the year, and the funding and support schemes a startup incubated here can apply to.',
		to: 'Everything the centre runs for founders — the events and workshops that happen through the year, and the government and institutional schemes that give incubated startups access to grants and early capital.'
	},
	{
		key: 'pages.programs',
		path: 'links[href=/events].tagline',
		from: 'Cohort sessions, demo days, clinics and workshops across the year.',
		to: 'Cohort sessions, pitch days, clinics and workshops across the year.'
	},
	{
		key: 'pages.programs',
		path: 'links[href=/schemes].tagline',
		from: 'Funding and support schemes open to startups incubated at the centre.',
		to: 'Grants, seed funding and schemes open to startups incubated at the centre.'
	},

	// ── Closing call to action and search snippet ─────────────────────────────
	{
		key: 'cta',
		path: 'apply.headlineLead',
		from: 'Have an idea worth building?',
		to: 'Building something hard?'
	},
	{
		key: 'cta',
		path: 'apply.headlineEmphasis',
		from: "Let's make it real.",
		to: 'Build it at IIT Guwahati.'
	},
	{
		key: 'seo',
		path: 'defaultDescription',
		from: 'The Technology Incubation Centre at IIT Guwahati — incubation, mentorship, funding access and workspace for deep-tech founders in the North-East.',
		to: "IIT Guwahati's platform for building DeepTech ventures in Northeast India — connecting founders and researchers to faculty, labs, talent, capital, industry and markets."
	},

	// ── Bring the fallback in line with the hero edited live on 24 Sept ───────
	{
		key: 'homeHero',
		path: 'intro.citation',
		from: "IIT Guwahati's platform for founders and researchers turning hard science into companies where technology, talent, capital, industry and markets are in one place.",
		to: "IIT Guwahati's incubator connecting founders and researchers to labs, faculty, talent, capital, industry and markets."
	},
	{ key: 'homeHero', path: 'intro.attribution', from: '— IITG TIC', to: '' }
];
