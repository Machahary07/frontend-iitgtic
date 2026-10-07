<script lang="ts">
	import {
		APPLICATION_SECTIONS,
		DOCUMENT_LABELS,
		formatAnswer
	} from '$lib/utils/applicationSchema';
	import type { ApplicationDetail, ApplicationStatus } from '$lib/utils/applications';

	// A submitted application, read-only, as the founder sent it. Rendered by the
	// console's application page once the startup in view has applied — the form
	// itself only ever starts empty, so it cannot show what was submitted.

	interface Props {
		application: ApplicationDetail;
		documents: { field: string; name: string; size: number; url: string | null }[];
	}

	let { application, documents }: Props = $props();

	const STATUS: Record<ApplicationStatus, { label: string; tone: string }> = {
		submitted: { label: 'Submitted', tone: 'neutral' },
		'under-review': { label: 'Under review', tone: 'warn' },
		accepted: { label: 'Accepted', tone: 'good' },
		rejected: { label: 'Not accepted', tone: 'bad' }
	};

	const status = $derived(STATUS[application.status] ?? STATUS.submitted);

	// Documents are step 7 but carry links rather than answers, so the answer
	// sections are rendered either side of them — same split as the admin view.
	const sectionsBeforeDocuments = APPLICATION_SECTIONS.filter((s) => s.step < 7);
	const sectionsAfterDocuments = APPLICATION_SECTIONS.filter((s) => s.step > 7);

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

{#snippet answerSection(section: (typeof APPLICATION_SECTIONS)[number])}
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
{/snippet}

<div class="record">
	<header class="head">
		<div class="head__text">
			<p class="head__name">{application.startup_name || 'Your application'}</p>
			<p class="head__meta">
				Submitted {formatDate(application.created_at)} by {application.full_name ||
					application.email}
				{#if application.reviewed_at}· Updated {formatDate(application.reviewed_at)}{/if}
			</p>
		</div>
		<span class="badge badge--{status.tone}">{status.label}</span>
	</header>

	{#if application.applicant_message && application.status !== 'submitted'}
		<div class="note">
			<span class="note__label">Note from TIC</span>
			<p>{application.applicant_message}</p>
		</div>
	{/if}

	{#each sectionsBeforeDocuments as section (section.step)}
		{@render answerSection(section)}
	{/each}

	<section class="card">
		<h2 class="card__title"><span class="card__step">Step 7</span> Documents</h2>
		{#if documents.length === 0}
			<p class="none">No documents were attached.</p>
		{:else}
			<ul class="docs">
				{#each documents as doc (doc.field)}
					<li class="doc">
						<div class="doc__meta">
							<span class="doc__label">{DOCUMENT_LABELS[doc.field] ?? doc.field}</span>
							<span class="doc__name">
								{doc.name}
								{#if doc.size}· {fmtSize(doc.size)}{/if}
							</span>
						</div>
						{#if doc.url}
							<!-- Absolute signed Supabase Storage URL, not an app route. -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="doc__open" href={doc.url} target="_blank" rel="noopener noreferrer">Open</a>
						{:else}
							<span class="doc__missing">File missing</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="none docs__note">
				Document links expire after 10 minutes. Reload the page for fresh ones.
			</p>
		{/if}
	</section>

	{#each sectionsAfterDocuments as section (section.step)}
		{@render answerSection(section)}
	{/each}
</div>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.record {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 900px;
	}

	.head,
	.card,
	.note {
		@include admin-panel;
		padding: 20px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.head__name {
		margin: 0;
		font-size: 18px;
		font-weight: $font-weight-bold;
		color: $admin-ink;
	}

	.head__meta {
		@include admin-cell-sub;
	}

	.badge {
		@include admin-badge;

		&--warn {
			@include admin-badge-tone('warn');
		}
		&--good {
			@include admin-badge-tone('good');
		}
		&--bad {
			@include admin-badge-tone('bad');
		}
	}

	.note {
		border-left: 3px solid admin-tone-fg('info');

		p {
			margin: 6px 0 0;
			font-size: 13px;
			line-height: 1.6;
			color: $admin-ink-2;
			white-space: pre-wrap;
		}
	}

	.note__label {
		@include admin-field-label;
	}

	.card__title {
		@include admin-section-title;
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 0 0 14px;
	}

	.card__step {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.answers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin: 0;

		@media (max-width: #{$bp-sm}) {
			grid-template-columns: 1fr;
		}
	}

	.answer {
		min-width: 0;

		&--long {
			grid-column: 1 / -1;
		}

		dt {
			@include admin-field-label;
		}

		dd {
			margin: 0;
			font-size: 13px;
			line-height: 1.6;
			color: $admin-ink;
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
		gap: 10px;
	}

	.doc {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
	}

	.doc__meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.doc__label {
		@include admin-cell-name;
	}

	.doc__name {
		@include admin-cell-sub;
		overflow-wrap: anywhere;
	}

	.doc__open {
		@include admin-btn-small;
		flex: none;
		text-decoration: none;
	}

	.doc__missing {
		flex: none;
		font-size: 12px;
		color: admin-tone-fg('bad');
	}

	.none {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.docs__note {
		margin-top: 10px;
	}
</style>
