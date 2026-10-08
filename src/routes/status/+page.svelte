<script lang="ts">
	type Left = { title: string; note: string };
	type Area = { title: string; note: string };
	type Release = { date: string; version: string; note: string };

	// What still stands between the build and launch. Remove a row when it ships.
	const left: Left[] = [
		{
			title: 'Backend on a VPS',
			note: 'Move the server off Vercel onto our own VPS.'
		},
		{
			title: 'Self-hosted Supabase',
			note: 'Database, auth and storage on our own server, with the data moved across.'
		},
		{
			title: 'iitgtic.com + real email',
			note: 'Connect the domain, and send all mail from official @iitgtic.com addresses.'
		}
	];

	const shipped: Area[] = [
		{
			title: 'Public website',
			note: 'Every page live, editable from the console, with SEO on each route.'
		},
		{
			title: 'Founder console',
			note: 'Startups, eight-step application, team, applicants, settings, account.'
		},
		{
			title: 'TIC admin console',
			note: 'Approvals, companies, users, content, storage, activity, settings.'
		},
		{
			title: 'Job board',
			note: 'TIC and startups post roles live; one apply form; removal with reason.'
		},
		{
			title: 'Application review',
			note: 'Six-stage chain, 0–100 scores, Meet screening calls, CEO view.'
		},
		{ title: 'Email', note: 'Branded templates, block editor, delivery log, bounce handling.' },
		{
			title: 'Admin assistant',
			note: 'Reads the console, drafts edits and sends, behind approval.'
		},
		{
			title: 'Security',
			note: 'RLS everywhere, rate limits, Turnstile, signed sessions, audit trail.'
		},
		{ title: 'Backups', note: 'Tables and every storage file, with a restore dry-run.' }
	];

	// Newest first. Add new releases at the top.
	const releases: Release[] = [
		{
			date: '9 Oct',
			version: 'v36',
			note: 'Job board: live posting, TIC / Incubatees tabs, new apply page'
		},
		{ date: '8 Oct', version: 'v34', note: 'Score gate on every hand-off, role-based overview' },
		{
			date: '8 Oct',
			version: 'v33',
			note: 'Coordinator evaluation, applicant invite, staff settings'
		},
		{ date: '8 Oct', version: 'v32', note: '0–100 step scores, scores in decision emails' },
		{ date: '8 Oct', version: 'v31', note: 'Type-to-confirm account delete, test suite' },
		{ date: '8 Oct', version: 'v30', note: 'Founder settings, account-deleted emails' },
		{ date: '6 Oct', version: 'v28', note: 'Review chain roles, branded email templates' },
		{ date: '30 Sep', version: 'v27', note: 'New home hero' },
		{ date: '9 Sep', version: '—', note: 'Admin assistant' },
		{ date: '4 Sep', version: '—', note: 'Storage console' }
	];
</script>

<svelte:head>
	<title>Project Status</title>
</svelte:head>

<section class="status">
	<header>
		<p class="eyebrow">Project status</p>
		<h1>Built. <span>{left.length} things left.</span></h1>
	</header>

	<section class="block">
		<h2>Left to do</h2>
		<ol class="left">
			{#each left as item, i (item.title)}
				<li>
					<span class="num">{String(i + 1).padStart(2, '0')}</span>
					<div>
						<h3>{item.title}</h3>
						<p>{item.note}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section class="block">
		<h2>Done</h2>
		<ul class="shipped">
			{#each shipped as area (area.title)}
				<li>
					<h3><span class="tick" aria-hidden="true"></span>{area.title}</h3>
					<p>{area.note}</p>
				</li>
			{/each}
		</ul>
	</section>

	<section class="block">
		<h2>Recent releases</h2>
		<ul class="releases">
			{#each releases as r (r.date + r.note)}
				<li>
					<span class="date">{r.date}</span>
					<span class="ver">{r.version}</span>
					<span>{r.note}</span>
				</li>
			{/each}
		</ul>
	</section>
</section>

<style lang="scss">
	@use '$styles/variables' as *;

	.status {
		max-width: 1100px;
		margin: 0 auto;
		padding: calc(var(--event-bar-height, 40px) + 64px + #{$space-9}) $space-8 $space-10;
		font-family: $font-family-base;
		color: $color-fg;

		@media (max-width: $bp-sm) {
			padding: calc(var(--page-shell-top, 100px) + #{$space-6}) $space-4 $space-8;
		}
	}

	ul,
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	header {
		margin-bottom: $space-10;

		@media (max-width: $bp-sm) {
			margin-bottom: $space-8;
		}
	}

	.eyebrow {
		font-size: $font-size-md;
		font-weight: $font-weight-bold;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: $space-4;
	}

	h1 {
		font-size: clamp(2.75rem, 8vw, 6rem);
		font-weight: $font-weight-black;
		line-height: 0.95;
		letter-spacing: -0.03em;

		span {
			display: block;
			color: $color-primary-green;
		}
	}

	.block {
		margin-bottom: $space-10;

		@media (max-width: $bp-sm) {
			margin-bottom: $space-8;
		}
	}

	h2 {
		font-size: $font-size-md;
		font-weight: $font-weight-bold;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding-bottom: $space-4;
		border-bottom: 3px solid $color-fg;
	}

	h3 {
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: $font-weight-black;
		letter-spacing: -0.01em;
		line-height: 1.1;
	}

	p {
		font-size: $font-size-lg;
		line-height: 1.5;
		color: $color-muted;
		margin-top: $space-2;
	}

	.left li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: $space-6;
		align-items: baseline;
		padding: $space-6 0;
		border-bottom: 1px solid $color-border;

		@media (max-width: $bp-sm) {
			gap: $space-4;
			padding: $space-5 0;
		}
	}

	.num {
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: $font-weight-black;
		color: $color-primary-green;
		font-variant-numeric: tabular-nums;
	}

	.shipped {
		display: grid;
		grid-template-columns: 1fr 1fr;
		column-gap: $space-8;

		@media (max-width: $bp-sm) {
			grid-template-columns: 1fr;
		}

		li {
			padding: $space-5 0;
			border-bottom: 1px solid $color-border;
		}

		h3 {
			font-size: $font-size-2xl;
			display: flex;
			align-items: center;
			gap: $space-3;
		}

		p {
			font-size: $font-size-md;
		}
	}

	.tick {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: $color-primary-green;
	}

	.releases li {
		display: grid;
		grid-template-columns: 5rem 3.5rem 1fr;
		gap: $space-4;
		padding: $space-4 0;
		border-bottom: 1px solid $color-border;
		font-size: $font-size-lg;
		align-items: baseline;

		@media (max-width: $bp-xs) {
			grid-template-columns: 4rem 3rem 1fr;
			gap: $space-3;
			font-size: $font-size-md;
		}
	}

	.date {
		color: $color-muted;
		font-variant-numeric: tabular-nums;
	}

	.ver {
		font-weight: $font-weight-black;
	}
</style>
