<script lang="ts">
	type Status = 'done' | 'in-progress' | 'todo';

	type Item = { name: string; path?: string; status: Status; note?: string };

	type Milestone = { date: string; title: string; status: Status; note: string };

	// Dated from the repository's own history, newest first. Add new entries at
	// the top; the sort below keeps the order right if one lands out of place.
	const milestones: Milestone[] = [
		{
			date: '2026-08-31',
			title: 'Opportunities · apply form',
			status: 'in-progress',
			note: 'Two-column detail page. Turnstile form, UI only — nothing stored yet.'
		},
		{
			date: '2026-08-30',
			title: 'Opportunities page refresh',
			status: 'done',
			note: 'New hero wording. Roles in a two-column grid. Deploys pinned to main.'
		},
		{
			date: '2026-08-30',
			title: 'TIC admin v2',
			status: 'done',
			note: 'Server-side login, per-admin sessions, route guard, doctor script.'
		},
		{
			date: '2026-08-29',
			title: 'TIC admin v1',
			status: 'done',
			note: 'Admin console, Supabase schema, audit triggers, page-view logging.'
		},
		{
			date: '2026-08-28',
			title: 'Status page',
			status: 'done',
			note: 'Build checklist across routes, components and infrastructure.'
		},
		{
			date: '2026-07-13',
			title: 'Turnstile verification',
			status: 'done',
			note: 'Bot checks on signup, login and admin. Admin auth moved server-side.'
		},
		{
			date: '2026-07-13',
			title: 'Initial build',
			status: 'done',
			note: 'SvelteKit app, design system, components, all public routes.'
		}
	];

	// Stable sort: entries sharing a date keep the order they are written in.
	const timeline = [...milestones].sort((a, b) => b.date.localeCompare(a.date));

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	const routes: Item[] = [
		{
			name: 'Home',
			path: '/',
			status: 'done',
			note: 'Intro hero + association marquee + editorial hero slider wired to events data'
		},
		{
			name: 'About',
			path: '/about',
			status: 'done',
			note: 'Hero + 6-card grid linking to about sub-pages'
		},
		{
			name: 'About · What Happens',
			path: '/about/what-happens',
			status: 'done',
			note: 'Long-form story with inline section callouts to Team / Mentors / Incubation / Governance'
		},
		{
			name: 'About · Governing Body',
			path: '/about/governing-body',
			status: 'done',
			note: 'Seven-member directing body with avatar placeholders'
		},
		{
			name: 'About · TIC Team',
			path: '/about/team',
			status: 'done'
		},
		{
			name: 'About · Mentors',
			path: '/about/mentors',
			status: 'done'
		},
		{
			name: 'About · FAQ',
			path: '/about/faq',
			status: 'done'
		},
		{
			name: 'About · Blog',
			path: '/about/blog',
			status: 'done',
			note: 'Index + dynamic [slug] post pages with block-typed body and inline image placeholders'
		},
		{
			name: 'Incubation',
			path: '/incubation',
			status: 'done',
			note: 'Hero + 5-pillar grid'
		},
		{
			name: 'Incubation · Pillar pages',
			path: '/incubation/support',
			status: 'done',
			note: 'support / infrastructure / funding / technical / residence — scrollspy + image-per-section layout'
		},
		{
			name: 'Incubated Startups',
			path: '/incubated-startups',
			status: 'done',
			note: 'Current / Virtual / Graduated cohort pages + dynamic per-startup detail pages'
		},
		{
			name: 'Events & Workshops',
			path: '/events',
			status: 'done',
			note: 'Upcoming + past sections; dynamic [slug] event pages; home slider derives from this data'
		},
		{
			name: 'Partners',
			path: '/partners',
			status: 'done',
			note: 'Grid of partner tiles linking to official sites'
		},
		{
			name: 'Opportunities',
			path: '/opportunities',
			status: 'done',
			note: 'Cohort hiring board with type filters; merges seed + user-posted jobs'
		},
		{
			name: 'Opportunities · Role detail',
			path: '/opportunities/[id]',
			status: 'done',
			note: 'Public detail page for both seed and user-posted roles'
		},
		{
			name: 'Job-posting admin',
			path: '/opportunities/job-posting-admin',
			status: 'done',
			note: 'Company login (Turnstile-gated) + dashboard; status-gated (pending / verified / rejected) banner'
		},
		{
			name: 'Job-posting · Signup',
			path: '/opportunities/job-posting-admin/signup',
			status: 'done',
			note: 'Creates pending account (Turnstile-gated); shows "TIC team will verify" confirmation card'
		},
		{
			name: 'Job-posting · Edit / create',
			path: '/opportunities/job-posting-admin/edit/new',
			status: 'done',
			note: 'edit/[id] handles both new and existing; verified-only (redirects otherwise)'
		},
		{
			name: 'Job-posting · Account settings',
			path: '/opportunities/job-posting-admin/admin-settings',
			status: 'done',
			note: 'Profile, password change, delete account'
		},
		{
			name: 'TIC team admin · Login',
			path: '/tic-admin/login',
			status: 'done',
			note: 'Individual admin accounts via Supabase Auth + Turnstile; first-run setup creates admin #1'
		},
		{
			name: 'TIC team admin · Overview',
			path: '/tic-admin',
			status: 'done',
			note: 'Stat tiles for pending / verified / rejected / jobs; recent pending signups list'
		},
		{
			name: 'TIC team admin · Companies',
			path: '/tic-admin/companies',
			status: 'done',
			note: 'Tabbed table; approve / reject (with reason) / delete / revert'
		},
		{
			name: 'TIC team admin · Posted jobs',
			path: '/tic-admin/jobs',
			status: 'done',
			note: 'All seed + company-posted jobs; company-posted roles can be removed here'
		},
		{
			name: 'TIC team admin · Applications',
			path: '/tic-admin/applications',
			status: 'done',
			note: 'Review queue with status tabs, full 8-step answers, signed document links, accept / reject / delete'
		},
		{
			name: 'TIC team admin · Users',
			path: '/tic-admin/users',
			status: 'done',
			note: 'All accounts with role, last sign-in and status; role changes, suspend, password reset, delete'
		},
		{
			name: 'TIC team admin · Activity',
			path: '/tic-admin/activity',
			status: 'done',
			note: 'Trigger-written audit log with before/after diffs, plus a per-page impressions grid (views / visitors / bots)'
		},
		{
			name: 'TIC team admin · Content',
			path: '/tic-admin/content',
			status: 'done',
			note: 'Every section of the public site editable from the console — nested objects, reorderable lists, reset to default'
		},
		{
			name: 'TIC content editor (other pages)',
			status: 'done',
			note: 'All 18 sections live in site_content; content.json is now only the fallback'
		},
		{
			name: 'Apply',
			path: '/apply',
			status: 'done',
			note: 'Full sign-up form with field validation + Turnstile; creates a Supabase Auth user + profiles row'
		},
		{
			name: 'Application',
			path: '/application',
			status: 'done',
			note: '8-step wizard; submits to public.applications with documents in Supabase Storage, reviewable at /tic-admin/applications'
		},
		{
			name: 'Login',
			path: '/login',
			status: 'done',
			note: 'Turnstile-gated Supabase Auth sign-in'
		}
	];

	const components: Item[] = [
		{ name: 'Navbar (desktop + mobile menu)', status: 'done' },
		{ name: 'EventBar (top scrolling announcement strip)', status: 'done' },
		{ name: 'Footer', status: 'done' },
		{ name: 'PageLoader', status: 'done' },
		{ name: 'PageShell', status: 'done' },
		{ name: 'CallToAction (apply banner)', status: 'done' },
		{ name: 'ScrollSpyNav', status: 'done' },
		{ name: 'HomeIntroHero', status: 'done' },
		{ name: 'HomeAssociationMarquee', status: 'done' },
		{ name: 'HomeHeroSlider (events-driven)', status: 'done' },
		{ name: 'EventCalendar', status: 'done' },
		{ name: 'BrandIcon', status: 'done' },
		{
			name: 'Turnstile (captcha widget)',
			status: 'done',
			note: 'Cloudflare Turnstile with server-side token verification via /api/turnstile'
		},
		{ name: 'TextReveal', status: 'done' },
		{ name: 'LinkReveal', status: 'done' },
		{ name: 'ButtonReveal', status: 'done' },
		{
			name: 'AdminShell (dashboard layout)',
			status: 'done',
			note: 'Shared light-theme shell — sidebar nav + topbar; used by TIC + company admins'
		}
	];

	const infra: Item[] = [
		{
			name: 'Content schema (content.json)',
			status: 'done',
			note: 'Single source of truth for every page; CMS-ready'
		},
		{
			name: 'CMS integration guide',
			status: 'done',
			note: '.claude/CMS.md — schemas, validation rules, image conventions'
		},
		{
			name: 'Application form reference',
			status: 'done',
			note: '.claude/APPLICATION_FORM.md — all 38 questions + types + required flags'
		},
		{
			name: 'Company auth',
			status: 'done',
			note: 'companyAuth.ts — Supabase Auth + public.companies; status workflow (pending → verified → rejected)'
		},
		{
			name: 'Job-posting storage',
			status: 'done',
			note: 'jobPostings.ts — public.jobs CRUD; RLS hides jobs from unverified companies and blocks them from posting'
		},
		{
			name: 'Supabase schema + RLS',
			status: 'done',
			note: 'supabase/migrations — profiles, companies, jobs, applications, site_content, audit_log, page_views'
		},
		{
			name: 'Content management',
			status: 'done',
			note: 'site_content table + schema-driven editor; the site reads it per request with content.json as fallback'
		},
		{
			name: 'TIC admin auth',
			status: 'done',
			note: 'Per-admin Supabase Auth accounts; the server verifies the role and issues a signed httpOnly session'
		},
		{
			name: 'Audit trail',
			status: 'done',
			note: 'Postgres triggers on companies / jobs / applications / profiles record actor + before/after, service-role only'
		},
		{
			name: 'Page-visit logging',
			status: 'done',
			note: 'hooks.server.ts writes one row per HTML page view; page_impressions() aggregates views, human visitors and bot hits'
		},
		{
			name: 'Turnstile verification',
			status: 'done',
			note: 'turnstile.ts + /api/turnstile — gates user login / apply, company login / signup, TIC admin login'
		},
		{
			name: 'User session',
			status: 'done',
			note: 'userSession.ts — Supabase Auth session + public.profiles, read by the application wizard'
		},
		{
			name: 'Server-rendered admin',
			status: 'done',
			note: '+layout.server.ts gates every /tic-admin route and load functions supply the data, so navigation never flashes an empty screen'
		},
		{
			name: 'Admin layout isolation',
			status: 'done',
			note: 'Root layout hides Navbar / Footer / EventBar on /tic-admin and /opportunities/job-posting-admin'
		},
		{
			name: 'Real auth backend',
			status: 'done',
			note: 'Supabase Auth for founders and companies; RLS on every table; TIC admin writes via service-role routes'
		},
		{
			name: 'Form submit handlers',
			status: 'in-progress',
			note: 'Login, apply, application, job posting and content editing all persist; newsletter still preventDefault'
		},
		{
			name: 'SEO metadata',
			status: 'todo',
			note: 'Only <title> per page — need meta description, OG/Twitter cards, canonicals'
		},
		{
			name: 'Prerender flags',
			status: 'todo',
			note: 'Static pages still SSR — add export const prerender = true where safe'
		},
		{
			name: 'Avatar fields on JSON',
			status: 'todo',
			note: 'governing-body / team / mentors use placeholder circles; no avatar: {alt} field yet'
		},
		{
			name: 'Real content (logos, photos, bios)',
			status: 'todo',
			note: 'Partner logos, event photos, people photos, startup logos — placeholders today'
		},
		{
			name: 'Application draft persistence',
			status: 'todo',
			note: 'Refresh still loses progress; submitted applications persist, in-progress ones do not'
		}
	];

	const all = [...routes, ...components, ...infra];
	const done = all.filter((i) => i.status === 'done').length;
	const total = all.length;
	const pct = Math.round((done / total) * 100);

	// Right-hand rail. Placeholder shape only — titles and dates are stand-ins so
	// the layout can be judged before the real backend history is written.
	const backend: Milestone[] = [
		{
			date: '2026-08-31',
			title: 'Backend milestone one',
			status: 'in-progress',
			note: 'Placeholder note. Replace with real detail.'
		},
		{
			date: '2026-08-30',
			title: 'Backend milestone two',
			status: 'done',
			note: 'Placeholder note. Replace with real detail.'
		},
		{
			date: '2026-08-29',
			title: 'Backend milestone three',
			status: 'done',
			note: 'Placeholder note. Replace with real detail.'
		},
		{
			date: '2026-08-28',
			title: 'Backend milestone four',
			status: 'todo',
			note: 'Placeholder note. Replace with real detail.'
		},
		{
			date: '2026-07-13',
			title: 'Backend milestone five',
			status: 'done',
			note: 'Placeholder note. Replace with real detail.'
		}
	];

	const backendTimeline = [...backend].sort((a, b) => b.date.localeCompare(a.date));

	// The checklist hangs off the same rail as the milestones, one node per group.
	const groups = [
		{ title: 'Routes', items: routes },
		{ title: 'Components', items: components },
		{ title: 'Infrastructure & remaining', items: infra }
	].map((g) => {
		const done = g.items.filter((i) => i.status === 'done').length;
		return { ...g, done, state: done === g.items.length ? 'done' : 'pending' };
	});
</script>

<svelte:head>
	<title>Project Status</title>
</svelte:head>

<section class="status">
	<header>
		<h1>Project Status</h1>
		<p class="progress">{done} / {total} done · {pct}%</p>
	</header>

	<div class="rails">
		<section class="rail">
			<h2 class="rail__title">Frontend</h2>
			<p class="section-sub">Newest first. Open a node for detail.</p>

			<ol class="timeline">
				{#each timeline as m (m.date + m.title)}
					<li class="node {m.status}">
						<span class="node__dot" aria-hidden="true"></span>
						<details class="drop">
							<summary>
								<time class="node__date" datetime={m.date}>{formatDate(m.date)}</time>
								<span class="node__title">{m.title}</span>
								<span class="badge">{m.status}</span>
								<svg
									class="chev"
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
							</summary>
							<p class="node__note">{m.note}</p>
						</details>
					</li>
				{/each}

				{#each groups as g (g.title)}
					<li class="node group {g.state}">
						<span class="node__dot" aria-hidden="true"></span>
						<details class="drop">
							<summary>
								<span class="node__title">{g.title}</span>
								<span class="badge">{g.state}</span>
								<span class="node__count">{g.done}/{g.items.length}</span>
								<svg
									class="chev"
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
							</summary>
							<ul class="items">
								{#each g.items as item (item.name)}
									<li class="item {item.status}">
										<span class="item__dot" aria-hidden="true"></span>
										{#if item.path}
											<a href={item.path}>{item.name}</a>
										{:else}
											<span>{item.name}</span>
										{/if}
										{#if item.note}<span class="item__note">{item.note}</span>{/if}
									</li>
								{/each}
							</ul>
						</details>
					</li>
				{/each}
			</ol>
		</section>

		<section class="rail">
			<h2 class="rail__title">Backend</h2>
			<p class="section-sub">Placeholder — structure only, content to follow.</p>

			<ol class="timeline">
				{#each backendTimeline as m (m.date + m.title)}
					<li class="node {m.status}">
						<span class="node__dot" aria-hidden="true"></span>
						<details class="drop">
							<summary>
								<time class="node__date" datetime={m.date}>{formatDate(m.date)}</time>
								<span class="node__title">{m.title}</span>
								<span class="badge">{m.status}</span>
								<svg
									class="chev"
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
							</summary>
							<p class="node__note">{m.note}</p>
						</details>
					</li>
				{/each}
			</ol>
		</section>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;

	.status {
		max-width: 1200px;
		margin: 0 auto;
		padding: calc(var(--event-bar-height, 40px) + 64px + #{$space-8}) $space-8 $space-8;
		font-family: $font-family-serif;

		@media (max-width: $bp-sm) {
			padding: calc(var(--page-shell-top, 100px) + #{$space-6}) $space-4 $space-6;
		}
	}

	header {
		margin-bottom: $space-8;
		text-align: left;
	}

	h1 {
		font-size: $font-size-3xl;
		margin: 0 0 $space-2;
	}

	.progress {
		opacity: 0.7;
		margin: 0;
	}

	.rails {
		display: grid;
		grid-template-columns: 1fr;
		gap: $space-8;

		@media (min-width: $bp-md) {
			grid-template-columns: 1fr 1fr;
			gap: $space-7;
		}
	}

	.rail {
		min-width: 0;
	}

	.rail__title {
		margin: 0 0 $space-1;
		font-size: $font-size-lg;
	}

	.section-sub {
		margin: 0 0 $space-5;
		opacity: 0.55;
		font-size: 0.85em;
	}

	ul,
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.node {
		position: relative;
		padding: 0 0 $space-3 $space-5;
		border-left: 1px solid #e4e4e4;

		&:last-child {
			padding-bottom: 0;
			border-left-color: transparent;
		}
	}

	.node__dot {
		position: absolute;
		left: -5px;
		top: 8px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #fff;
		border: 2px solid #c4c4c4;
	}

	.node.done .node__dot {
		background: #1a6b2f;
		border-color: #1a6b2f;
	}

	.node.in-progress .node__dot {
		background: #fff4cc;
		border-color: #b8860b;
	}

	.node.group .node__dot {
		border-radius: 2px;
	}

	.node.pending .node__dot {
		background: #fff4cc;
		border-color: #b8860b;
	}

	summary {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: $space-3;
		padding: 2px 0;
		cursor: pointer;
		list-style: none;

		&::-webkit-details-marker {
			display: none;
		}

		&:hover .node__title {
			text-decoration: underline;
		}
	}

	.chev {
		flex: none;
		margin-left: -4px;
		align-self: center;
		color: #9a9a9a;
		transition: transform $transition-fast;
	}

	details[open] > summary .chev {
		transform: rotate(180deg);
	}

	.node__date {
		font-family: monospace;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.5;
		flex: none;
		min-width: 82px;
	}

	.node__title {
		font-size: 1rem;
	}

	.node__note {
		margin: $space-1 0 $space-2;
		max-width: 68ch;
		opacity: 0.65;
		font-size: 0.9em;
		line-height: 1.55;
	}

	.badge {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 7px;
		border-radius: 3px;
		font-family: monospace;
		flex-shrink: 0;
	}

	.done .badge {
		background: #d4f4dd;
		color: #1a6b2f;
	}

	.in-progress .badge {
		background: #fff4cc;
		color: #7a5a00;
	}

	.todo .badge {
		background: #f0f0f0;
		color: #555;
	}

	.pending .badge {
		background: #fff4cc;
		color: #7a5a00;
	}

	.node__count {
		font-family: monospace;
		font-size: 0.7rem;
		opacity: 0.5;
		flex: none;
	}

	.items {
		margin: $space-2 0 $space-3;
	}

	.item {
		position: relative;
		padding: 3px 0 3px $space-4;
		font-size: 0.9em;
		line-height: 1.5;
	}

	.item__dot {
		position: absolute;
		left: 2px;
		top: 10px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #c4c4c4;
	}

	.item.done .item__dot {
		background: #1a6b2f;
	}

	.item.in-progress .item__dot {
		background: #b8860b;
	}

	.item__note {
		opacity: 0.5;
		font-size: 0.9em;

		&::before {
			content: ' — ';
		}
	}

	a {
		color: inherit;
	}
</style>
