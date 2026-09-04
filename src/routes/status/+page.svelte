<script lang="ts">
	// 'wont-do' is a decision, not a gap: something considered and deliberately
	// rejected, with the reason in its note. It is left out of the denominators
	// below, so a checklist is never permanently short of 100% because of a call
	// that was made on purpose.
	type Status = 'done' | 'in-progress' | 'todo' | 'wont-do';

	type Item = { name: string; path?: string; status: Status; note?: string };

	type Milestone = { date: string; title: string; status: Status; note: string };

	// Dated from the repository's own history, newest first. Add new entries at
	// the top; the sort below keeps the order right if one lands out of place.
	const milestones: Milestone[] = [
		{
			date: '2026-09-04',
			title: 'Storage console + safe deletes',
			status: 'done',
			note: "A storage console at /tic-admin/storage walks every bucket through the storage API — Supabase keeps files in S3 and only their metadata in Postgres — and marks each object in use or unused by looking for its path across the content sections, the email templates, and the application and resume records, so a real person's document is never mislabelled as safe to delete. A delete is refused with 409 while something still points at the file. Alongside it, one ConfirmDialog host mounted in the root layout replaces every window.confirm() in the app, built on <dialog> so showModal() supplies the focus trap and Esc-to-dismiss."
		},
		{
			date: '2026-09-01',
			title: 'Hardening schema live',
			status: 'done',
			note: 'The two migrations behind the last round — company inbox grants, the Postgres rate limiter, delivery feedback, newsletter — were written but never applied, so every feature resting on them was reporting green against a schema that did not have them. Both are pushed and verified against the live project: the limiter refuses the 16th write in an hour, a forged webhook is rejected and a real bounce suppresses the address, the newsletter stores what it collects, and none of the four new tables is readable by an anonymous client.'
		},
		{
			date: '2026-09-01',
			title: 'Search, social and drafts',
			status: 'done',
			note: 'Every route now has its own description, canonical and social card, read from the copy already on the page — app.html had been serving the homepage title and a homepage canonical on all 37. The eight-step application survives a refresh. The footer newsletter stores what it collects instead of only claiming to. People cards take real photographs whenever they arrive.'
		},
		{
			date: '2026-09-01',
			title: 'Company applicant inbox',
			status: 'done',
			note: 'A verified company sees who applied to its own roles, with signed resume links and a CSV export. Password reset now has a page to land on, and Forgot password actually sends one.'
		},
		{
			date: '2026-08-31',
			title: 'Transactional email',
			status: 'in-progress',
			note: 'Console side is built — usage against the Resend plan, delivery log with previews, and a block editor for every template. Confirmation links now come back to /auth/callback on the origin the person signed up on. Bounce and complaint webhooks are live and suppress the address. Still to finish: a verified sending domain, which waits on DNS access.'
		},
		{
			date: '2026-08-31',
			title: 'Role applicants console',
			status: 'done',
			note: 'Applicant queue in the TIC admin — status tabs, per-role filter, signed resume links.'
		},
		{
			date: '2026-08-31',
			title: 'Opportunities · apply form',
			status: 'done',
			note: 'Two-column detail page. The Turnstile form now posts to /api/job-applications.'
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
			note: 'Public detail page for both seed and user-posted roles; apply panel writes to job_applications with the resume in a private bucket'
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
			name: 'TIC team admin · Role applicants',
			path: '/tic-admin/job-applications',
			status: 'done',
			note: 'Everyone who applied to a role: status tabs, per-role filter, full answers, 10-minute signed resume link, shortlist / sent on / decline'
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
			name: 'TIC team admin · Storage',
			path: '/tic-admin/storage',
			status: 'done',
			note: 'What every bucket holds and how much of the plan allowance is left. Walks the buckets through the storage API, since Supabase keeps files in S3 and only their metadata in Postgres, then marks each object in use or unused by looking for its path in the content sections, the email templates, and the application and resume records — so a private document belonging to a real person is never mislabelled as safe to delete. Thumbnails, a lightbox preview, and a guarded delete'
		},
		{
			name: 'TIC team admin · Email',
			path: '/tic-admin/email',
			status: 'done',
			note: 'Usage against the plan allowance, a 30-day trend, and the delivery log with a preview of the exact body each recipient got'
		},
		{
			name: 'TIC team admin · Email templates',
			path: '/tic-admin/email/templates',
			status: 'done',
			note: 'Block editor — fifteen components behind a + palette, live preview, variable insertion, per-template on/off, test send, reset to bundled copy'
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
		},
		{
			name: 'Auth callback',
			path: '/auth/callback',
			status: 'done',
			note: 'Where every link in an auth email lands — picks the session out of the URL and forwards to the right dashboard'
		},
		{
			name: 'Set a new password',
			path: '/auth/reset-password',
			status: 'done',
			note: 'The end of a recovery link. Forgot password on the sign-in screen sends one; an admin can send one too'
		},
		{
			name: 'Company · applicants',
			path: '/opportunities/job-posting-admin/applicants',
			status: 'done',
			note: "A verified company's own applicants, with status tabs, a per-role filter, signed resume links and a CSV export"
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
			name: 'Seo (per-page metadata)',
			status: 'done',
			note: "Rendered once from the root layout. Description, canonical, Open Graph and Twitter card for every route, with the description read from the page's own hero copy. It does not emit a title — the pages own that"
		},
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
		},
		{
			name: 'ConfirmDialog (app-wide)',
			status: 'done',
			note: 'One modal host mounted in the root layout, replacing every window.confirm() in the app. Built on <dialog> so showModal() supplies the focus trap, the inert background and Esc-to-dismiss that made the native one safe. askConfirm() returns a promise, since a custom dialog cannot block the thread the way confirm() did — the one call site that relied on blocking, the unsaved-changes guard in the content editor, cancels the navigation and replays it after the answer'
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
			status: 'done',
			note: 'Every form on the site now persists what it collects. The footer newsletter was the last holdout — it called preventDefault and then said "we\'ll be in touch", which was not true; it posts to /api/newsletter and only thanks you once the row is written'
		},
		{
			name: 'SEO metadata',
			status: 'done',
			note: "app.html carried a hardcoded description, canonical and social block, which was worse than none: it put a second static title ahead of every page's real one, so every server-rendered page and every crawler saw the homepage title, and the canonical named the homepage on all 37 pages. One Seo component in the root layout owns it now, with descriptions read from each section's own hero copy so editing a page updates its search snippet. Consoles, auth, /apply, /application and /status are noindex, matching robots.txt"
		},
		{
			name: 'Prerender flags',
			status: 'wont-do',
			note: "Decided against. The root layout loads every page's copy from site_content, so a prerendered page freezes its text at build time and the content editor silently stops working on it; a prerendered route is also served without touching hooks.server.ts, so page_views would go dark exactly where traffic matters. SSR with the in-process content cache already makes these a map lookup"
		},
		{
			name: 'Avatar fields on JSON',
			status: 'done',
			note: 'Every person and track carries an avatar { src, alt }, editable in the content console like any other field. A card renders the photo when there is one and keeps the plain circle when there is not, so the pages work before the photographs arrive'
		},
		{
			name: 'Real content (logos, photos, bios)',
			status: 'in-progress',
			note: 'Partner logos, event photos, people photos, startup logos — placeholders today'
		},
		{
			name: 'Application draft persistence',
			status: 'done',
			note: 'The eight-step form autosaves to localStorage, keyed per account so a shared machine keeps two founders apart, and restores the step and the answers on return. Uploads and the consent boxes are deliberately excluded — a File cannot be serialised, and consent restored from storage was never actually given'
		}
	];

	// Right-hand rail. Dated from supabase/migrations and the server routes they
	// belong to, so a migration landing is what moves a node here.
	const backend: Milestone[] = [
		{
			date: '2026-09-04',
			title: 'Editable media',
			status: 'done',
			note: 'Media in site content is uploadable, not just its alt text. The public site-assets bucket landed in 20260904000000_site_assets, so /api/tic-admin/content/assets (admin-only, service-role) now stores a file and hands back its public URL; the content editor shows a preview and an upload button wherever a field reads as an image, and resolveMedia() lets an uploaded URL and a legacy bundled key coexist while content migrates. First surface: the Partners logos, which the home association marquee now mirrors, so one edit updates both. What is left is content rather than plumbing — the remaining {alt}-only placeholders (events, incubation, startups) still need pictures, and video is a separate bucket and player.'
		},
		{
			date: '2026-09-01',
			title: 'Backups + real domain status',
			status: 'done',
			note: 'pnpm backup takes the tables and every storage object — the half a database backup never covers, because Supabase keeps files in S3 and only their metadata in Postgres. pnpm restore --dry-run is the restore drill. The email console stopped guessing at the sending domain and now reports what Resend actually says, with the DNS records still missing.'
		},
		{
			date: '2026-09-01',
			title: 'Hardening + delivery feedback',
			status: 'done',
			note: "Per-IP rate limits in Postgres on every public write and on the admin login. Resend bounces and complaints come back through a Svix-signed webhook and suppress the address. An RLS policy and a column grant open job_applications to the company that posted the role. Fixed alongside: an ilike pattern on the signup receipt that could match somebody else's account, a timing-variable compare on the bootstrap password, and uploaded documents that survived the account that owned them."
		},
		{
			date: '2026-08-31',
			title: 'Transactional email',
			status: 'in-progress',
			note: 'email_templates and email_log, both service-role only. A message is stored as blocks and its HTML compiled on save, so nobody edits markup to change a sentence. Sends go through Resend over its REST API; every attempt is logged with the rendered body, including one blocked by a missing key, a spent plan allowance or a suppressed recipient. Auth mail now carries an emailRedirectTo of its own, so a confirmation link lands on /auth/callback rather than the project Site URL. Not finished: mail still leaves from the Resend sandbox sender, because the sending domain cannot be verified without DNS access.'
		},
		{
			date: '2026-08-31',
			title: 'Role applications',
			status: 'done',
			note: 'job_applications + a private resume bucket. /api/job-applications re-verifies Turnstile, resolves the role server-side and writes the row; the TIC console reviews the queue.'
		},
		{
			date: '2026-08-30',
			title: 'Server-side admin session',
			status: 'done',
			note: 'Admins sign in with their own credentials; the server checks the role and issues a signed httpOnly cookie. +layout.server.ts guards every console route, and pnpm doctor checks the environment.'
		},
		{
			date: '2026-08-29',
			title: 'Editable site content',
			status: 'done',
			note: 'site_content is read per request with content.json as the fallback, so a bad edit cannot take the site down. value is json rather than jsonb — jsonb sorted the keys and reordered the editor.'
		},
		{
			date: '2026-08-29',
			title: 'Audit trail + traffic',
			status: 'done',
			note: 'Triggers on companies / jobs / applications / profiles record the actor and a before/after, whatever the client. hooks.server.ts writes one page_views row per HTML GET; page_impressions() splits humans from crawlers.'
		},
		{
			date: '2026-08-29',
			title: 'Admin accounts',
			status: 'done',
			note: "profiles.role gained 'admin', with is_admin() and admin_count() as the gate. The first account bootstraps once from TIC_ADMIN_PASSWORD, after which that password stops working."
		},
		{
			date: '2026-08-29',
			title: 'Schema + RLS',
			status: 'done',
			note: 'profiles, companies, jobs and applications, every one behind RLS. Signup is an on_auth_user_created trigger, so the client never inserts a profile, and a job is only public once its company is verified.'
		},
		{
			date: '2026-07-13',
			title: 'Turnstile verification',
			status: 'done',
			note: 'The secret key never leaves the server. Every gated form checks its token against Cloudflare through /api/turnstile or, for a write, inside the submit route itself.'
		}
	];

	const backendTimeline = [...backend].sort((a, b) => b.date.localeCompare(a.date));

	// Postgres side: every table is RLS-on, and the note says who may read it.
	const data: Item[] = [
		{
			name: 'profiles',
			status: 'done',
			note: 'One row per auth user, written by the signup trigger; role is founder / company / admin and only the service role can change it'
		},
		{
			name: 'companies',
			status: 'done',
			note: 'Job-portal accounts; status (pending / verified / rejected) is outside the authenticated grants, so only the console moves it'
		},
		{
			name: 'jobs',
			status: 'done',
			note: 'Company postings; public read only while the company is verified, insert and update only by the owner'
		},
		{
			name: 'applications',
			status: 'done',
			note: 'The 8-step incubation application; own rows only, with status / review_note reserved for the reviewer'
		},
		{
			name: 'job_applications',
			status: 'done',
			note: 'Applications to a role. The applicant has no account, so every write is service-role; reads are service-role plus one policy that gives a verified company its own applicants, with review_note held back by a column grant'
		},
		{
			name: 'newsletter_subscribers',
			status: 'done',
			note: 'Footer signups, one row per address case-folded. Service-role only and audited — a subscriber list is personal data, and who removed someone from it is worth being able to answer'
		},
		{
			name: 'rate_limits',
			status: 'done',
			note: 'Fixed-window counters for the public write routes. In Postgres rather than in memory because the app is serverless — a per-instance map resets on every cold start'
		},
		{
			name: 'email_events',
			status: 'done',
			note: 'Delivery feedback from Resend — what happened after a message left. Deduplicated on (provider_id, type, occurred_at), because a webhook that did not get a 2xx is retried'
		},
		{
			name: 'email_suppressions',
			status: 'done',
			note: 'Addresses that hard-bounced or filed a spam complaint; checked before every non-test send, and liftable from the console'
		},
		{
			name: 'site_content',
			status: 'done',
			note: 'Editable copy for every public page, read on the server and merged over content.json'
		},
		{
			name: 'email_templates',
			status: 'done',
			note: 'Subject, block list and compiled body per message, overriding the copy bundled in emailTemplates.ts; service-role only and audited'
		},
		{
			name: 'email_log',
			status: 'done',
			note: 'One row per send attempt with the rendered subject and body — sent / failed / blocked; it is also what the usage meter counts against the plan'
		},
		{
			name: 'audit_log',
			status: 'done',
			note: 'Trigger-written history with actor and before/after; RLS on with no policies, so nothing but the service role sees it'
		},
		{
			name: 'page_views',
			status: 'done',
			note: 'One row per HTML page view, admin routes flagged; aggregated by the page_impressions(since) function'
		},
		{
			name: 'Storage · application-documents',
			status: 'done',
			note: 'Private bucket, one folder per user; the console reads it through 10-minute signed URLs'
		},
		{
			name: 'Storage · job-applications',
			status: 'done',
			note: 'Private bucket of resumes, one folder per role; uploaded by the submit route, deleted with the row, and readable by the company that owns the role through a policy on the folder name'
		},
		{
			name: 'Storage · email-assets',
			status: 'done',
			note: 'Public bucket for pictures and documents inside an email — mail clients fetch an image unauthenticated, so a signed URL would break after delivery; admin-only to write'
		},
		{
			name: 'Storage · site-assets',
			status: 'done',
			note: 'Public bucket for images uploaded from the content editor; 5 MB cap, PNG/JPEG/GIF/WebP/SVG only, and no write policies, so the service-role route is the only way in — anon writes are refused'
		},
		{
			name: 'Helper functions',
			status: 'done',
			note: 'slugify, touch_updated_at, is_company_verified, is_admin, admin_count, audit_actor, page_impressions, company_owns_job_slug, rate_limit_hit, rate_limit_sweep'
		}
	];

	// Everything the browser is allowed to ask the server to do.
	const endpoints: Item[] = [
		{
			name: 'POST /api/newsletter',
			status: 'done',
			note: 'Footer subscribe. Per-IP limited and validated; a repeat address is a plain success rather than an error, so the form cannot be used to find out who is already on the list'
		},
		{
			name: 'GET / DELETE /api/tic-admin/newsletter',
			status: 'done',
			note: 'The subscriber list for export, and removal on request. Both audited'
		},
		{
			name: 'POST /api/turnstile',
			status: 'done',
			note: 'Verifies a widget token against Cloudflare with the secret key'
		},
		{
			name: 'POST /api/job-applications',
			status: 'done',
			note: 'Public role application: Turnstile, server-side role lookup, resume upload, insert; a repeat email returns 409 rather than a second row'
		},
		{
			name: 'DELETE /api/company-account',
			status: 'done',
			note: 'A company closing its own account — RLS can drop the row, but only the service role can delete the auth user behind it'
		},
		{
			name: 'GET / POST / DELETE /api/tic-admin-login',
			status: 'done',
			note: 'Session state, sign-in, first-admin bootstrap and sign-out; refuses to bootstrap while the admin count cannot be read'
		},
		{
			name: 'PATCH / DELETE /api/tic-admin/companies',
			status: 'done',
			note: 'Verify, reject with a reason, or delete an account and its auth user'
		},
		{
			name: 'PATCH / DELETE /api/tic-admin/applications',
			status: 'done',
			note: 'Move an incubation application through review; delete removes its documents first'
		},
		{
			name: 'GET / PATCH / POST / DELETE /api/tic-admin/job-applications',
			status: 'done',
			note: 'Shortlist, mark sent on, decline; GET returns the full records for the CSV export, POST clears a whole role, and every delete removes the resume from the bucket first'
		},
		{
			name: 'DELETE /api/tic-admin/jobs',
			status: 'done',
			note: 'Take down a company-posted role'
		},
		{
			name: 'PATCH / PUT / POST / DELETE /api/tic-admin/users',
			status: 'done',
			note: 'Role changes, suspend, password-reset mail, delete, and creating a further admin'
		},
		{
			name: 'GET /api/tic-admin/activity',
			status: 'done',
			note: 'Paged audit entries and page impressions over a 7d / 30d / all window'
		},
		{
			name: 'PUT / DELETE /api/tic-admin/content',
			status: 'done',
			note: 'Save a content section, or reset it to the bundled default; both are audited with a before and after'
		},
		{
			name: 'GET / PUT / POST / DELETE /api/tic-admin/email',
			status: 'done',
			note: 'Page the delivery log or read one rendered message, save a template, send a test, reset a template to the bundled copy'
		},
		{
			name: 'POST /api/tic-admin/email/assets',
			status: 'done',
			note: 'Uploads a picture or document for an image or file block; the body is compiled from blocks server-side, never taken from the browser'
		},
		{
			name: 'GET / DELETE /api/tic-admin/storage',
			status: 'done',
			note: 'Signs a ten-minute link to one object in a private bucket, and removes an object. A delete is refused with 409 while a content section, an email template, an application or a resume record still points at the file — the console asks a second, blunter question and retries with force, so removing something in use stays possible but never accidental'
		},
		{
			name: 'POST /api/tic-admin/content/assets',
			status: 'done',
			note: 'Uploads an image for a media field in the content editor into the public site-assets bucket; admin-only, returns the public URL saved into the section'
		},
		{
			name: 'DELETE /api/tic-admin/email/suppressions',
			status: 'done',
			note: 'Lifts a bounce or complaint suppression so the address can be written to again; audited like every other admin action'
		},
		{
			name: 'POST /api/resend-webhook',
			status: 'done',
			note: 'Delivery feedback from Resend, Svix-signed. Verifies the HMAC and the timestamp before parsing, records the event, and suppresses the address on a permanent bounce or a complaint'
		},
		{
			name: 'hooks.server.ts',
			status: 'done',
			note: 'Visitor cookie + page-view logging, handed to waitUntil so the write never delays a response'
		},
		{
			name: 'requireAdmin() guard',
			status: 'done',
			note: 'Reads the session cookie and returns a service-role client tagged x-actor-id, which is how an audit row names a person'
		},
		{
			name: 'resendDomains.ts',
			status: 'done',
			note: "Asks Resend for the sending domain's verification state and the DNS records it still wants, instead of inferring it from whether the From address contains resend.dev — an address on an unverified domain looks fine by that test and is refused at send time"
		},
		{
			name: 'scripts/backup.js · scripts/restore.js',
			status: 'done',
			note: 'Tables to NDJSON, every storage object to disk, and a manifest recording row counts, checksums and what that backup can put back. restore.js upserts the standalone tables and re-uploads storage; --dry-run is the drill'
		},
		{
			name: 'withinLimit() rate limiter',
			status: 'done',
			note: 'Fixed-window counters in Postgres, on the role application, the signup receipt, the Turnstile check and the admin login. Fails open — a counter that cannot be read must not lock people out of a form'
		}
	];

	const backendTodo: Item[] = [
		{
			name: 'Email deliverability',
			status: 'in-progress',
			note: "The webhook is live: a bounce or a complaint arrives Svix-signed, is recorded once and takes the address out of circulation, and a suppressed address is refused before the next send rather than after. Verified end to end against the deployed schema — a forged, stale or tampered payload is rejected, a valid one suppresses, a replay is deduplicated. What is left is not code. Mail still goes out as onboarding@resend.dev, the shared sandbox sender that only delivers to the address owning the API key, because iitgtic.com's DNS is not ours to edit yet and the domain's verification records cannot be published"
		},
		{
			name: 'Company-side applicant inbox',
			status: 'done',
			note: "A verified company reads the applicants for roles it posted at /opportunities/job-posting-admin/applicants — contact details, answers and a signed resume link. TIC's review notes are held back by a column grant, and there is no write path, so a status stays TIC's to set"
		},
		{
			name: 'Rate limiting on public writes',
			status: 'done',
			note: 'Per-IP fixed windows in Postgres on the role application, signup receipt, Turnstile check and admin login, alongside Turnstile and one-application-per-email'
		},
		{
			name: 'Resume retention',
			status: 'done',
			note: "CSV export per role on both sides, and a console action that clears a whole role, resumes first. Deliberately no scheduled purge — deleting people's documents on a timer is only noticed once it has already run"
		},
		{
			name: 'Backups + restore drill',
			status: 'in-progress',
			note: 'pnpm backup is now complete: a real pg_dump of the schema and the data — 45 tables, 21 RLS policies, auth.users included — alongside an NDJSON copy of every table and every storage object, the half a database backup never covers since Supabase keeps files in S3 and only their metadata in Postgres. It calls pg_dump directly rather than through supabase db dump, which runs it inside Docker and so fails on a machine that has pg_dump but no daemon. pnpm restore --dry-run passes: the backup verifies against its manifest and the target is reachable. Left: rehearse the real restore once into a scratch project, which needs a project to throw away first'
		}
	];

	const open = (items: Item[]) => items.filter((i) => i.status !== 'wont-do');

	const all = open([...routes, ...components, ...infra, ...data, ...endpoints, ...backendTodo]);
	const done = all.filter((i) => i.status === 'done').length;
	const total = all.length;
	const pct = Math.round((done / total) * 100);

	// The checklist hangs off the same rail as the milestones, one node per group.
	type Group = { title: string; items: Item[]; done: number; state: Status | 'pending' };

	function toGroups(entries: { title: string; items: Item[] }[]): Group[] {
		return entries.map((g) => {
			const counted = open(g.items);
			const done = counted.filter((i) => i.status === 'done').length;
			return { ...g, done, state: done === counted.length ? 'done' : 'pending' };
		});
	}

	const groups = toGroups([
		{ title: 'Routes', items: routes },
		{ title: 'Components', items: components },
		{ title: 'Infrastructure & remaining', items: infra }
	]);

	const backendGroups = toGroups([
		{ title: 'Tables, storage & functions', items: data },
		{ title: 'Server routes', items: endpoints },
		{ title: 'Remaining', items: backendTodo }
	]);

	function tally(items: Item[]) {
		const counted = open(items);
		const done = counted.filter((i) => i.status === 'done').length;
		return `${done} / ${counted.length} done`;
	}

	const frontendTally = tally([...routes, ...components, ...infra]);
	const backendTally = tally([...data, ...endpoints, ...backendTodo]);
</script>

<svelte:head>
	<title>Project Status</title>
</svelte:head>

{#snippet chevron()}
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
{/snippet}

{#snippet milestoneNode(m: Milestone)}
	<li class="node {m.status}">
		<span class="node__dot" aria-hidden="true"></span>
		<details class="drop">
			<summary>
				<time class="node__date" datetime={m.date}>{formatDate(m.date)}</time>
				<span class="node__title">{m.title}</span>
				<span class="badge">{m.status}</span>
				{@render chevron()}
			</summary>
			<p class="node__note">{m.note}</p>
		</details>
	</li>
{/snippet}

{#snippet groupNode(g: Group)}
	<li class="node group {g.state}">
		<span class="node__dot" aria-hidden="true"></span>
		<details class="drop">
			<summary>
				<span class="node__title">{g.title}</span>
				<span class="badge">{g.state}</span>
				<span class="node__count">{g.done}/{g.items.length}</span>
				{@render chevron()}
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
{/snippet}

<section class="status">
	<header>
		<h1>Project Status</h1>
		<p class="progress">{done} / {total} done · {pct}%</p>
	</header>

	<div class="rails">
		<section class="rail">
			<h2 class="rail__title">Frontend</h2>
			<p class="section-sub">{frontendTally} · newest first. Open a node for detail.</p>

			<ol class="timeline">
				{#each timeline as m (m.date + m.title)}
					{@render milestoneNode(m)}
				{/each}

				{#each groups as g (g.title)}
					{@render groupNode(g)}
				{/each}
			</ol>
		</section>

		<section class="rail">
			<h2 class="rail__title">Backend</h2>
			<p class="section-sub">{backendTally} · dated from the migration that landed it.</p>

			<ol class="timeline">
				{#each backendTimeline as m (m.date + m.title)}
					{@render milestoneNode(m)}
				{/each}

				{#each backendGroups as g (g.title)}
					{@render groupNode(g)}
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

	.item.wont-do {
		opacity: 0.65;

		.item__dot {
			background: transparent;
			box-shadow: inset 0 0 0 1px #9a9a9a;
		}
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
