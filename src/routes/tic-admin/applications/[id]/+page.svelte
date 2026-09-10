<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminDeleteApplication,
		adminSetApplicationStatus,
		type ApplicationDetail,
		type ApplicationStatus
	} from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import {
		APPLICATION_SECTIONS,
		DOCUMENT_LABELS,
		formatAnswer
	} from '$lib/utils/applicationSchema';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const application = $derived(data.application as unknown as ApplicationDetail);
	const documentLinks = $derived(data.documentLinks);

	// The stored values are the source of truth until the reviewer starts typing.
	let messageDraft = $state<string | null>(null);
	let noteDraft = $state<string | null>(null);
	const applicantMessage = $derived(messageDraft ?? application.applicant_message ?? '');
	const reviewNote = $derived(noteDraft ?? application.review_note ?? '');

	let saving = $state(false);

	async function setStatus(status: ApplicationStatus) {
		saving = true;
		const ok = await adminSetApplicationStatus(
			application.id,
			status,
			applicantMessage,
			reviewNote
		);
		saving = false;
		if (!ok) {
			showToast('Could not save. Please try again.', 'err');
			return;
		}
		messageDraft = null;
		noteDraft = null;
		await invalidateAll();
		showToast(`Marked ${statusLabel(status)}.`);
	}

	async function remove() {
		const confirmed = await askConfirm({
			title: `Permanently delete ${application.startup_name || 'this application'}?`,
			body: 'The uploaded documents are deleted with it. This cannot be undone.',
			confirmLabel: 'Delete application',
			tone: 'danger'
		});
		if (!confirmed) return;
		const ok = await adminDeleteApplication(application.id);
		if (ok) goto(resolve('/tic-admin/applications'));
		else showToast('Could not delete the application.', 'err');
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	function statusLabel(status: ApplicationStatus) {
		return status === 'under-review' ? 'under review' : status;
	}

	function fmtDateTime(iso: string) {
		return new Date(iso).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function fmtSize(bytes: number) {
		if (!bytes) return '';
		if (bytes < 1024) return '< 1 KB';
		const kb = bytes / 1024;
		return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
	}

	const documentFields = $derived(Object.keys(documentLinks));

	// Documents are step 7, but they live in their own column rather than in
	// `answers`, so the section list is rendered either side of them.
	const sectionsBeforeDocuments = APPLICATION_SECTIONS.filter((s) => s.step < 7);
	const sectionsAfterDocuments = APPLICATION_SECTIONS.filter((s) => s.step > 7);
</script>

<svelte:head>
	<title
		>{application ? `${application.startup_name} · TIC Admin` : 'Application · TIC Admin'}</title
	>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title={application.startup_name || 'Untitled startup'}
	eyebrow="Application"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="btn" href={resolve('/tic-admin/applications')}>← All applications</a>
	{/snippet}

	<div class="layout">
		<div class="main">
			{#each sectionsBeforeDocuments as section (section.step)}
				<section class="card">
					<header class="card__head">
						<h2>
							<span class="card__step">Step {section.step}</span>
							{section.title}
						</h2>
					</header>
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
				<header class="card__head">
					<h2><span class="card__step">Step 7</span> Documents</h2>
				</header>
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
										{#if documentLinks[field].size}
											· {fmtSize(documentLinks[field].size)}
										{/if}
									</span>
								</div>
								{#if documentLinks[field].url}
									<!-- Absolute signed Supabase Storage URL, not an app route,
										     so resolve() does not apply. -->
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										class="btn"
										href={documentLinks[field].url}
										target="_blank"
										rel="noopener noreferrer">Open</a
									>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{:else}
									<span class="doc__missing">File missing</span>
								{/if}
							</li>
						{/each}
					</ul>
					<p class="docs__note">
						Links are signed and expire after 10 minutes. Reload the page for fresh ones.
					</p>
				{/if}
			</section>

			{#each sectionsAfterDocuments as section (section.step)}
				<section class="card">
					<header class="card__head">
						<h2>
							<span class="card__step">Step {section.step}</span>
							{section.title}
						</h2>
					</header>
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
		</div>

		<aside class="side">
			<div class="card card--sticky">
				<header class="card__head">
					<h2>Review</h2>
				</header>

				<div class="status-row">
					<span class="badge badge--{application.status}">{statusLabel(application.status)}</span>
					{#if application.reviewed_at}
						<span class="status-row__when">Last updated {fmtDateTime(application.reviewed_at)}</span
						>
					{/if}
				</div>

				<label class="field">
					<span>Message to applicant</span>
					<textarea
						value={applicantMessage}
						oninput={(e) => (messageDraft = (e.currentTarget as HTMLTextAreaElement).value)}
						rows="4"
						placeholder="Shown to the applicant and included in the decision email."
					></textarea>
				</label>

				<label class="field">
					<span>Internal note</span>
					<textarea
						value={reviewNote}
						oninput={(e) => (noteDraft = (e.currentTarget as HTMLTextAreaElement).value)}
						rows="3"
						placeholder="Private to the TIC team — never shown to the applicant."
					></textarea>
				</label>

				<div class="decision">
					<button class="btn btn--primary" disabled={saving} onclick={() => setStatus('accepted')}
						>Accept</button
					>
					<button class="btn" disabled={saving} onclick={() => setStatus('under-review')}
						>Mark under review</button
					>
					<button class="btn btn--danger" disabled={saving} onclick={() => setStatus('rejected')}
						>Reject</button
					>
				</div>

				<dl class="meta">
					<div>
						<dt>Applicant</dt>
						<dd>{application.full_name || '—'}</dd>
					</div>
					<div>
						<dt>Email</dt>
						<dd>{application.email}</dd>
					</div>
					<div>
						<dt>Submitted</dt>
						<dd>{fmtDateTime(application.created_at)}</dd>
					</div>
				</dl>

				<button class="btn btn--danger delete" onclick={remove}>Delete application</button>
			</div>
		</aside>
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 20px;
		align-items: start;
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.card {
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		padding: 20px;
		font-family: $font-family-base;
	}

	.card--sticky {
		position: sticky;
		top: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.card__head {
		margin-bottom: 14px;
		padding-bottom: 12px;
		border-bottom: 1px solid $admin-line-soft;

		h2 {
			display: flex;
			align-items: baseline;
			gap: 10px;
			margin: 0;
			font-size: 15px;
			font-weight: $font-weight-semibold;
			color: #111;
		}
	}

	.card--sticky .card__head {
		margin-bottom: 0;
	}

	.card__step {
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #999;
	}

	.answers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px 20px;
		margin: 0;
	}

	.answer {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;

		&--long {
			grid-column: 1 / -1;
		}

		dt {
			font-size: 10px;
			font-weight: $font-weight-semibold;
			letter-spacing: 0.07em;
			text-transform: uppercase;
			color: $admin-ink-3;
		}

		dd {
			margin: 0;
			font-size: 13px;
			line-height: 1.6;
			color: #111;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}
	}

	.none {
		margin: 0;
		font-size: 13px;
		color: $admin-ink-3;
	}

	.docs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.doc {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 12px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
	}

	.doc__meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.doc__label {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.doc__name {
		font-size: 12px;
		color: $admin-ink-3;
		overflow-wrap: anywhere;
	}

	.doc__missing {
		font-size: 12px;
		color: #a01515;
	}

	.docs__note {
		margin: 12px 0 0;
		font-size: 11px;
		color: #999;
	}

	.status-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.status-row__when {
		font-size: 11px;
		color: #999;
	}

	.badge {
		align-self: flex-start;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-radius: 999px;

		&--submitted {
			background: #e2e8f5;
			color: #24427e;
		}

		&--under-review {
			background: #fff4d4;
			color: #6a4f00;
		}

		&--accepted {
			background: #d6f5e1;
			color: #0e6b2c;
		}

		&--rejected {
			background: #fde0e0;
			color: #9a1515;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			font-size: 11px;
			font-weight: $font-weight-semibold;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: #444;
		}

		textarea {
			padding: 10px 12px;
			font: inherit;
			font-family: $font-family-base;
			font-size: 13px;
			color: #111;
			background: #fff;
			border: 1px solid $admin-line;
			border-radius: $admin-radius-sm;
			resize: vertical;

			&:focus {
				outline: none;
				border-color: #111;
				box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
			}
		}
	}

	.decision {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding-top: 14px;
		border-top: 1px solid $admin-line-soft;

		dt {
			font-size: 10px;
			font-weight: $font-weight-semibold;
			letter-spacing: 0.07em;
			text-transform: uppercase;
			color: $admin-ink-3;
		}

		dd {
			margin: 2px 0 0;
			font-size: 13px;
			color: #111;
			overflow-wrap: anywhere;
		}
	}

	.delete {
		align-self: flex-start;
	}

	.btn {
		display: inline-block;
		padding: 8px 14px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		text-align: center;
		text-decoration: none;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&--primary {
			color: #fff;
			background: #111;
			border-color: #111;
		}

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
			background: #fff;
		}
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.card--sticky {
			position: static;
		}
	}
</style>
