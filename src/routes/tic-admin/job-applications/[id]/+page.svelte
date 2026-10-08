<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { adminDeleteJobApplication, type JobApplicationDetail } from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const applicant = $derived(data.application as unknown as JobApplicationDetail);
	const resumeUrl = $derived(data.resumeUrl);

	async function remove() {
		const confirmed = await askConfirm({
			title: `Permanently delete ${applicant.full_name}'s application?`,
			body: 'The resume is deleted with it. This cannot be undone.',
			confirmLabel: 'Delete application',
			tone: 'danger'
		});
		if (!confirmed) return;
		const ok = await adminDeleteJobApplication(applicant.id);
		if (ok) goto(resolve('/tic-admin/job-applications'));
		else showToast('Could not delete the application.', 'err');
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}

	function fmtDate(iso: string | null) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
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

	function fmtSize(bytes: number | undefined) {
		if (!bytes) return '';
		if (bytes < 1024) return '< 1 KB';
		const kb = bytes / 1024;
		return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>{applicant.full_name} · TIC Admin</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title={applicant.full_name}
	eyebrow="Role applicant"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="btn" href={resolve('/tic-admin/job-applications')}>← All applicants</a>
	{/snippet}

	<div class="layout">
		<div class="main">
			<section class="card">
				<header class="card__head">
					<h2>Applied for</h2>
				</header>
				<dl class="answers">
					<div class="answer">
						<dt>Role</dt>
						<dd>{applicant.job_role}</dd>
					</div>
					<div class="answer">
						<dt>Company</dt>
						<dd>{applicant.job_company}</dd>
					</div>
					<div class="answer">
						<dt>Posting</dt>
						<dd>
							<a class="link" href={resolve('/opportunities/[id]', { id: applicant.job_slug })}>
								{applicant.job_slug}
							</a>
						</dd>
					</div>
					<div class="answer">
						<dt>Earliest start</dt>
						<dd>{fmtDate(applicant.start_date)}</dd>
					</div>
					{#if applicant.onsite_ok}
						<div class="answer">
							<dt>On-site</dt>
							<dd>Confirmed they can work on-site</dd>
						</div>
					{/if}
				</dl>
			</section>

			<section class="card">
				<header class="card__head">
					<h2>Applicant</h2>
				</header>
				<dl class="answers">
					<div class="answer">
						<dt>Full name</dt>
						<dd>{applicant.full_name}</dd>
					</div>
					<div class="answer">
						<dt>Email</dt>
						<dd><a class="link" href="mailto:{applicant.email}">{applicant.email}</a></dd>
					</div>
					<div class="answer">
						<dt>Phone</dt>
						<dd>{applicant.phone || '—'}</dd>
					</div>
					<div class="answer">
						<dt>Current role or institution</dt>
						<dd>{applicant.applicant_role || '—'}</dd>
					</div>
					<div class="answer answer--long">
						<dt>Portfolio or LinkedIn</dt>
						<dd>
							{#if applicant.portfolio_link}
								<!-- The applicant's own link, not an app route, so resolve() does not apply. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									class="link"
									href={applicant.portfolio_link}
									target="_blank"
									rel="noopener noreferrer nofollow">{applicant.portfolio_link}</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{:else}
								—
							{/if}
						</dd>
					</div>
					<div class="answer answer--long">
						<dt>Why this role</dt>
						<dd>{applicant.why}</dd>
					</div>
				</dl>
			</section>

			<section class="card">
				<header class="card__head">
					<h2>Resume</h2>
				</header>
				{#if !applicant.resume?.name}
					<p class="none">No resume was attached.</p>
				{:else}
					<div class="doc">
						<div class="doc__meta">
							<span class="doc__label">{applicant.resume.name}</span>
							<span class="doc__name">{fmtSize(applicant.resume.size)}</span>
						</div>
						{#if resumeUrl}
							<!-- Absolute signed Supabase Storage URL, not an app route,
							     so resolve() does not apply. -->
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a class="btn" href={resumeUrl} target="_blank" rel="noopener noreferrer">Open</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{:else}
							<span class="doc__missing">File missing</span>
						{/if}
					</div>
					<p class="docs__note">
						The link is signed and expires after 10 minutes. Reload the page for a fresh one.
					</p>
				{/if}
			</section>
		</div>

		<aside class="side">
			<div class="card card--sticky">
				<header class="card__head">
					<h2>Application</h2>
				</header>

				<dl class="meta">
					<div>
						<dt>Applied</dt>
						<dd>{fmtDateTime(applicant.created_at)}</dd>
					</div>
					<div>
						<dt>Consent to share</dt>
						<dd>{applicant.consent ? 'Given' : 'Not given'}</dd>
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
			margin: 0;
			font-size: 15px;
			font-weight: $font-weight-semibold;
			color: #111;
		}
	}

	.card--sticky .card__head {
		margin-bottom: 0;
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

	.link {
		color: #2050d4;
		text-decoration: none;
	}

	.none {
		margin: 0;
		font-size: 13px;
		color: $admin-ink-3;
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
		overflow-wrap: anywhere;
	}

	.doc__name {
		font-size: 12px;
		color: $admin-ink-3;
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

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
			background: #fff;
		}
	}

	.delete {
		margin-top: 4px;
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
