<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import ButtonReveal from '$lib/components/ButtonReveal.svelte';
	import { loadUserSession } from '$lib/utils/userSession';
	import {
		getApplication,
		signMyDocument,
		type ApplicationDetail,
		type ApplicationStatus
	} from '$lib/utils/applications';
	import { APPLICATION_SECTIONS, DOCUMENT_LABELS, formatAnswer } from '$lib/utils/applicationSchema';

	let loading = $state(true);
	let notFound = $state(false);
	let application = $state<ApplicationDetail | null>(null);
	let documentLinks = $state<Record<string, { name: string; size: number; url: string | null }>>(
		{}
	);

	onMount(async () => {
		const s = await loadUserSession();
		if (!s.id) {
			goto(resolve('/login'));
			return;
		}

		const id = page.params.id;
		const found = id ? await getApplication(id) : null;
		if (!found) {
			notFound = true;
			loading = false;
			return;
		}
		application = found;

		const links: Record<string, { name: string; size: number; url: string | null }> = {};
		for (const [field, entry] of Object.entries(found.documents ?? {})) {
			if (!entry?.path) continue;
			links[field] = { name: entry.name, size: entry.size, url: await signMyDocument(entry.path) };
		}
		documentLinks = links;
		loading = false;
	});

	function printPdf() {
		window.print();
	}

	const STATUS: Record<ApplicationStatus, { label: string; tone: string }> = {
		submitted: { label: 'Submitted', tone: 'neutral' },
		'under-review': { label: 'Under review', tone: 'amber' },
		accepted: { label: 'Accepted', tone: 'green' },
		rejected: { label: 'Declined', tone: 'red' }
	};

	// Documents are step 7 but live in their own column, so the answer sections are
	// rendered either side of them — same split as the admin review page.
	const sectionsBeforeDocuments = APPLICATION_SECTIONS.filter((s) => s.step < 7);
	const sectionsAfterDocuments = APPLICATION_SECTIONS.filter((s) => s.step > 7);
	const documentFields = $derived(Object.keys(documentLinks));

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function fmtSize(bytes: number) {
		if (!bytes) return '';
		if (bytes < 1024) return '< 1 KB';
		const kb = bytes / 1024;
		return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>{application?.startup_name || 'Application'} · IITG TIC</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="detail">
	<div class="detail__inner">
		{#if loading}
			<p class="detail__status" role="status">Loading your application…</p>
		{:else if notFound}
			<div class="empty">
				<h1 class="empty__title">Application not found</h1>
				<p class="empty__body">
					We couldn't find this application on your account. It may have been removed, or the link
					belongs to a different account.
				</p>
				<LinkReveal href="/account" text="Back to your applications" class="inline-link" />
			</div>
		{:else if application}
			<div class="topbar no-print">
				<LinkReveal href="/account" text="← Your applications" class="inline-link" />
				<ButtonReveal text="Download PDF" class="download" onclick={printPdf} />
			</div>

			<header class="sheet-head">
				<h1>{application.startup_name || 'Untitled application'}</h1>
				<div class="sheet-head__meta">
					<span class="pill pill--{STATUS[application.status].tone}">
						<span class="pill__dot" aria-hidden="true"></span>
						{STATUS[application.status].label}
					</span>
					<span class="meta">
						Submitted {formatDate(application.created_at)}
						{#if application.reviewed_at}· Updated {formatDate(application.reviewed_at)}{/if}
					</span>
				</div>
			</header>

			{#if application.review_note && application.status !== 'submitted'}
				<div class="note">
					<span class="note__label">Note from the reviewer</span>
					<p>{application.review_note}</p>
				</div>
			{/if}

			{#each sectionsBeforeDocuments as section (section.step)}
				<section class="card">
					<h2 class="card__title">
						<span class="card__step">Step {section.step}</span>
						{section.title}
					</h2>
					<dl class="answers">
						{#each section.fields as field (field.key)}
							<div class="answer" class:answer--long={field.long}>
								<dt>{field.label}</dt>
								<dd>{formatAnswer(application.answers[field.key])}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}

			<section class="card">
				<h2 class="card__title"><span class="card__step">Step 7</span> Documents</h2>
				{#if documentFields.length === 0}
					<p class="none">No documents were attached.</p>
				{:else}
					<ul class="docs">
						{#each documentFields as field (field)}
							<li class="doc">
								<div class="doc__meta">
									<span class="doc__label">{DOCUMENT_LABELS[field] ?? field}</span>
									<span class="doc__name">
										{documentLinks[field].name}
										{#if documentLinks[field].size}· {fmtSize(documentLinks[field].size)}{/if}
									</span>
								</div>
								{#if documentLinks[field].url}
									<!-- Absolute signed Supabase Storage URL, not an app route. -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a
										class="doc__open no-print"
										href={documentLinks[field].url}
										target="_blank"
										rel="noopener noreferrer">Open</a
									>
								{:else}
									<span class="doc__missing">File missing</span>
								{/if}
							</li>
						{/each}
					</ul>
					<p class="docs__note no-print">
						Document links are signed and expire after 10 minutes. Reload the page for fresh ones.
					</p>
				{/if}
			</section>

			{#each sectionsAfterDocuments as section (section.step)}
				<section class="card">
					<h2 class="card__title">
						<span class="card__step">Step {section.step}</span>
						{section.title}
					</h2>
					<dl class="answers">
						{#each section.fields as field (field.key)}
							<div class="answer" class:answer--long={field.long}>
								<dt>{field.label}</dt>
								<dd>{formatAnswer(application.answers[field.key])}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.detail {
		min-height: 100svh;
		background: $color-accent-blue;
		color: $color-white;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) 0 $space-8;
		display: flex;
		justify-content: center;

		@include breakpoint-down($bp-sm) {
			padding-top: calc(var(--page-shell-top, 100px) + #{$space-6});
		}
	}

	.detail__inner {
		width: 100%;
		max-width: 720px;
		padding-inline: $space-6;

		@include breakpoint-down($bp-sm) {
			padding-inline: $space-4;
		}
	}

	.detail__status {
		margin: 0;
		color: rgba($color-white, 0.85);
	}

	:global(.inline-link) {
		color: $color-white;
		font-weight: $font-weight-semibold;
	}

	.empty {
		&__title {
			margin: 0 0 $space-2;
			font-size: $font-size-2xl;
			font-weight: $font-weight-bold;
		}
		&__body {
			margin: 0 0 $space-4;
			color: rgba($color-white, 0.85);
			line-height: 1.6;
		}
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-4;
		margin-bottom: $space-6;
		font-size: $font-size-sm;
	}

	:global(button.button-reveal.download) {
		padding: 9px 22px;
		border: 1px solid $color-black;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-xs;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
	}

	.sheet-head {
		margin-bottom: $space-6;

		h1 {
			margin: 0 0 $space-3;
			font-size: $font-size-3xl;
			font-weight: $font-weight-bold;
			letter-spacing: $letter-spacing-tight;
		}
	}

	.sheet-head__meta {
		display: flex;
		align-items: center;
		gap: $space-3;
		flex-wrap: wrap;
	}

	.meta {
		font-size: $font-size-xs;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-white, 0.7);
	}

	.note {
		margin-bottom: $space-6;
		padding: $space-4;
		background: rgba($color-white, 0.1);
		border-left: 2px solid rgba($color-white, 0.6);

		p {
			margin: 4px 0 0;
			line-height: 1.6;
			color: rgba($color-white, 0.92);
		}
	}

	.note__label {
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-white, 0.7);
	}

	.card {
		margin-bottom: $space-4;
		padding: $space-5;
		border: 1px solid rgba($color-white, 0.25);
	}

	.card__title {
		display: flex;
		align-items: baseline;
		gap: $space-2;
		margin: 0 0 $space-4;
		font-size: $font-size-lg;
		font-weight: $font-weight-semibold;
	}

	.card__step {
		font-size: $font-size-xs;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-white, 0.6);
	}

	.answers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $space-4;
		margin: 0;

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.answer {
		min-width: 0;

		&--long {
			grid-column: 1 / -1;
		}

		dt {
			font-size: $font-size-xs;
			font-weight: $font-weight-semibold;
			letter-spacing: $letter-spacing-wide;
			text-transform: uppercase;
			color: rgba($color-white, 0.7);
			margin-bottom: 4px;
		}

		dd {
			margin: 0;
			font-size: $font-size-sm;
			line-height: 1.6;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}
	}

	.docs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: $space-3;
	}

	.doc {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-3;
		padding-bottom: $space-3;
		border-bottom: 1px solid rgba($color-white, 0.15);

		&:last-child {
			border-bottom: 0;
			padding-bottom: 0;
		}
	}

	.doc__meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.doc__label {
		font-size: $font-size-sm;
		font-weight: $font-weight-semibold;
	}

	.doc__name {
		font-size: $font-size-xs;
		color: rgba($color-white, 0.7);
		overflow-wrap: anywhere;
	}

	.doc__open {
		flex-shrink: 0;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: $color-white;
		border: 1px solid rgba($color-white, 0.5);
		padding: 5px 14px;
		text-decoration: none;
	}

	.doc__missing {
		flex-shrink: 0;
		font-size: $font-size-xs;
		color: #ff8a8a;
	}

	.none,
	.docs__note {
		margin: 0;
		font-size: $font-size-xs;
		color: rgba($color-white, 0.7);
	}

	.docs__note {
		margin-top: $space-3;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		flex-shrink: 0;
		padding: 4px 12px;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		background: rgba($color-white, 0.1);
		border: 1px solid rgba($color-white, 0.18);
		border-radius: 999px;
	}

	.pill__dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}
	.pill--neutral .pill__dot {
		background: rgba($color-white, 0.7);
	}
	.pill--amber .pill__dot {
		background: #ffd257;
	}
	.pill--green .pill__dot {
		background: #5fdc82;
	}
	.pill--red .pill__dot {
		background: #ff8a8a;
	}

	// --- Print: a clean black-on-white record ------------------------------
	// The app chrome (EventBar / Navbar / Footer / dialogs) renders as siblings
	// of <main> under the display:contents wrapper in app.html, so hiding every
	// sibling that is not <main> leaves only this page on the printed page, with
	// no blank pages from off-flow content.
	@media print {
		:global(body > div > *:not(main)) {
			display: none !important;
		}

		.no-print {
			display: none !important;
		}

		.detail {
			display: block;
			min-height: 0;
			padding: 0;
			background: #fff;
			color: #111;
		}

		.detail__inner {
			max-width: none;
			padding: 0;
		}

		.sheet-head h1 {
			color: #111;
		}

		.meta,
		.card__step,
		.answer dt,
		.doc__name,
		.note__label,
		.none {
			color: #555;
		}

		.answer dd,
		.doc__label,
		.note p {
			color: #111;
		}

		.card {
			border-color: #ccc;
			break-inside: avoid;
			page-break-inside: avoid;
		}

		.note {
			background: #f4f4f4;
			border-left-color: #999;
		}

		.doc {
			border-bottom-color: #ddd;
		}

		.pill {
			background: transparent;
			border-color: #999;
			color: #111;
		}

		.pill--amber .pill__dot {
			background: #b8860b;
		}
		.pill--green .pill__dot {
			background: #1a6b2f;
		}
		.pill--red .pill__dot {
			background: #c0392b;
		}
		.pill--neutral .pill__dot {
			background: #777;
		}
	}
</style>
