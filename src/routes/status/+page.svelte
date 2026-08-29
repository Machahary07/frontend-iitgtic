<script lang="ts">
	type Status = 'done' | 'in-progress' | 'todo';

	type Item = { name: string; path?: string; status: Status; note?: string };

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
</script>

<svelte:head>
	<title>Project Status</title>
</svelte:head>

<section class="status">
	<header>
		<h1>Project Status</h1>
		<p class="progress">{done} / {total} done · {pct}%</p>
	</header>

	<div class="columns">
		<div class="column">
			<h2>Routes</h2>
			<ul>
				{#each routes as item}
					<li class={item.status}>
						<span class="badge">{item.status}</span>
						{#if item.path}
							<a href={item.path}>{item.name}</a>
						{:else}
							<span>{item.name}</span>
						{/if}
						{#if item.note}<span class="note">— {item.note}</span>{/if}
					</li>
				{/each}
			</ul>
		</div>

		<div class="column">
			<h2>Components</h2>
			<ul>
				{#each components as item}
					<li class={item.status}>
						<span class="badge">{item.status}</span>
						<span>{item.name}</span>
						{#if item.note}<span class="note">— {item.note}</span>{/if}
					</li>
				{/each}
			</ul>

			<h2 class="infra-heading">Infrastructure &amp; remaining</h2>
			<ul>
				{#each infra as item}
					<li class={item.status}>
						<span class="badge">{item.status}</span>
						<span>{item.name}</span>
						{#if item.note}<span class="note">— {item.note}</span>{/if}
					</li>
				{/each}
			</ul>
		</div>
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

	h2 {
		font-size: $font-size-xl;
		margin: 0 0 $space-4;
		border-bottom: 1px solid #ddd;
		padding-bottom: $space-2;
	}

	.infra-heading {
		margin-top: $space-7;
	}

	.progress {
		opacity: 0.7;
		margin: 0;
	}

	.columns {
		display: grid;
		grid-template-columns: 1fr;
		gap: $space-8;

		@media (min-width: $bp-sm) {
			grid-template-columns: 1fr 1fr;
		}
	}

	.column {
		min-width: 0;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: $space-3;
		padding: $space-2 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.badge {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 8px;
		border-radius: 3px;
		font-family: monospace;
		flex-shrink: 0;
		min-width: 90px;
		text-align: center;
	}

	li.done .badge {
		background: #d4f4dd;
		color: #1a6b2f;
	}

	li.in-progress .badge {
		background: #fff4cc;
		color: #7a5a00;
	}

	li.todo .badge {
		background: #f0f0f0;
		color: #555;
	}

	.note {
		opacity: 0.6;
		font-size: 0.9em;
		flex-basis: 100%;
		padding-left: calc(90px + #{$space-3});

		@media (max-width: $bp-xs) {
			padding-left: 0;
		}
	}

	a {
		color: inherit;
	}
</style>
