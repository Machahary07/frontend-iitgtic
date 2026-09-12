<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import Select from '$lib/components/Select.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminClearJobApplicants,
		adminExportJobApplications,
		adminSetJobApplicationStatus,
		type JobApplicationStatus,
		type JobApplicationSummary
	} from '$lib/utils/ticAdmin';
	import { downloadCsv, stampedFileName, toCsv } from '$lib/utils/csv';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';

	type Filter = 'all' | JobApplicationStatus;

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const applicants = $derived(data.jobApplications as unknown as JobApplicationSummary[]);

	let filter = $state<Filter>('new');
	let role = $state('all');

	// One entry per role that has been applied to, so the queue can be worked
	// company by company rather than in one undifferentiated list.
	const roles = $derived([...new Set(applicants.map((a) => a.job_slug))].sort());

	function roleLabel(slug: string) {
		const match = applicants.find((a) => a.job_slug === slug);
		return match ? `${match.job_role} · ${match.job_company}` : slug;
	}

	const byRole = $derived(
		role === 'all' ? applicants : applicants.filter((a) => a.job_slug === role)
	);

	const filtered = $derived(filter === 'all' ? byRole : byRole.filter((a) => a.status === filter));

	const counts = $derived({
		all: byRole.length,
		new: byRole.filter((a) => a.status === 'new').length,
		shortlisted: byRole.filter((a) => a.status === 'shortlisted').length,
		forwarded: byRole.filter((a) => a.status === 'forwarded').length,
		rejected: byRole.filter((a) => a.status === 'rejected').length
	});

	let busy = $state('');

	async function setStatus(id: string, status: JobApplicationStatus) {
		await adminSetJobApplicationStatus(id, status);
		await invalidateAll();
	}

	// The whole record, not the summary the table renders — the point of an
	// export is the free-text answers and the contact details.
	async function handleExport() {
		busy = 'export';
		try {
			const rows = await adminExportJobApplications(role === 'all' ? undefined : role);
			if (rows.length === 0) {
				showToast('Nothing to export in this view.', 'info');
				return;
			}

			const csv = toCsv(
				[
					'Applied',
					'Name',
					'Email',
					'Phone',
					'Role',
					'Company',
					'Source',
					'Currently',
					'Earliest start',
					'On site',
					'Portfolio',
					'Status',
					'Review note',
					'Reviewed',
					'Why'
				],
				rows.map((r) => [
					fmtDate(r.created_at),
					r.full_name,
					r.email,
					r.phone,
					r.job_role,
					r.job_company,
					r.job_source,
					r.applicant_role,
					r.start_date ?? '',
					r.onsite_ok,
					r.portfolio_link,
					r.status,
					r.review_note ?? '',
					r.reviewed_at ? fmtDate(r.reviewed_at) : '',
					r.why
				])
			);

			downloadCsv(
				stampedFileName('applicants', role === 'all' ? 'all-roles' : roleLabel(role)),
				csv
			);
			showToast(`Exported ${rows.length} applicant${rows.length === 1 ? '' : 's'}.`);
		} finally {
			busy = '';
		}
	}

	// Retention is a decision, not a schedule. Confirmed twice because it takes
	// the resumes with it and there is no undo.
	async function handleClearRole() {
		if (role === 'all') return;
		const count = counts.all;
		const label = roleLabel(role);

		const ok = await askConfirm({
			title: `Delete all ${count} applicant${count === 1 ? '' : 's'} for "${label}"?`,
			body: 'Their resumes go too. This cannot be undone — export first if you need a record.',
			confirmLabel: 'Delete all',
			tone: 'danger'
		});
		if (!ok) return;

		busy = 'clear';
		try {
			const deleted = await adminClearJobApplicants(role);
			if (deleted === null) {
				showToast('Could not clear that role. Nothing was deleted.', 'err');
				return;
			}
			showToast(`Deleted ${deleted} applicant${deleted === 1 ? '' : 's'} and their resumes.`);
			role = 'all';
			await invalidateAll();
		} finally {
			busy = '';
		}
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>TIC Admin · Role applicants</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Role applicants"
	eyebrow="Opportunities"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="controls">
		<div class="tabs">
			<button class="tab" class:tab--active={filter === 'new'} onclick={() => (filter = 'new')}>
				New <span class="tab__count">{counts.new}</span>
			</button>
			<button
				class="tab"
				class:tab--active={filter === 'shortlisted'}
				onclick={() => (filter = 'shortlisted')}
			>
				Shortlisted <span class="tab__count">{counts.shortlisted}</span>
			</button>
			<button
				class="tab"
				class:tab--active={filter === 'forwarded'}
				onclick={() => (filter = 'forwarded')}
			>
				Sent on <span class="tab__count">{counts.forwarded}</span>
			</button>
			<button
				class="tab"
				class:tab--active={filter === 'rejected'}
				onclick={() => (filter = 'rejected')}
			>
				Declined <span class="tab__count">{counts.rejected}</span>
			</button>
			<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
				All <span class="tab__count">{counts.all}</span>
			</button>
		</div>

		{#if roles.length > 1}
			<div class="picker">
				<span class="picker__label">Role</span>
				<div class="picker__control">
					<Select
						id="admin-applicants-role"
						bind:value={role}
						options={[
							{ value: 'all', label: 'Every role' },
							...roles.map((slug) => ({ value: slug, label: roleLabel(slug) }))
						]}
						size="sm"
						ariaLabel="Filter applicants by role"
					/>
				</div>
			</div>
		{/if}

		<div class="retention">
			<button class="btn" onclick={handleExport} disabled={busy !== ''}>
				{busy === 'export' ? 'Exporting…' : 'Export CSV'}
			</button>
			{#if role !== 'all'}
				<button class="btn btn--danger" onclick={handleClearRole} disabled={busy !== ''}>
					{busy === 'clear' ? 'Clearing…' : 'Clear this role'}
				</button>
			{/if}
		</div>
	</div>

	<div class="panel">
		{#if filtered.length === 0}
			{#if applicants.length === 0}
				<div class="empty-state">
					<p class="empty-state__title">No one has applied yet</p>
					<p class="empty-state__body">
						Applications sent from a role on <a href={resolve('/opportunities')}>Opportunities</a>
						land here, resume attached, the moment they are submitted.
					</p>
				</div>
			{:else}
				<p class="empty">No applicants in this view.</p>
			{/if}
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Applicant</th>
							<th>Role</th>
							<th>Applied</th>
							<th>Status</th>
							<th class="actions-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as applicant (applicant.id)}
							<tr>
								<td>
									<p class="cell__name">{applicant.full_name}</p>
									<p class="cell__sub">{applicant.email}</p>
									<p class="cell__sub">
										<a
											class="link"
											href={resolve('/tic-admin/job-applications/[id]', { id: applicant.id })}
										>
											Open application →
										</a>
									</p>
								</td>
								<td>
									<p class="cell__name">{applicant.job_role}</p>
									<p class="cell__sub">{applicant.job_company}</p>
								</td>
								<td><p class="cell__sub">{fmtDate(applicant.created_at)}</p></td>
								<td>
									<span class="badge badge--{applicant.status}">{applicant.status}</span>
									{#if applicant.review_note}
										<p class="cell__reason">{applicant.review_note}</p>
									{/if}
								</td>
								<td class="actions-col">
									<div class="actions">
										{#if applicant.status !== 'shortlisted'}
											<button class="btn" onclick={() => setStatus(applicant.id, 'shortlisted')}>
												Shortlist
											</button>
										{/if}
										{#if applicant.status !== 'forwarded'}
											<button
												class="btn btn--primary"
												onclick={() => setStatus(applicant.id, 'forwarded')}
											>
												Sent on
											</button>
										{/if}
										{#if applicant.status !== 'rejected'}
											<button
												class="btn btn--danger"
												onclick={() => setStatus(applicant.id, 'rejected')}
											>
												Decline
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.tabs {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 13px;
		font-weight: $font-weight-medium;
		color: #555;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: 999px;
		cursor: pointer;
		&--active {
			color: #fff;
			background: #111;
			border-color: #111;
		}
	}

	.tab__count {
		font-size: 11px;
		opacity: 0.7;
	}

	.picker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: $font-family-base;
	}

	.picker__control {
		min-width: 230px;
	}

	.picker__label {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-2;
	}

	.retention {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.panel {
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		overflow: hidden;
	}

	.empty {
		margin: 0;
		padding: 40px 18px;
		text-align: center;
		font-size: 13px;
		color: $admin-ink-3;
	}

	.empty-state {
		padding: 48px 24px;
		text-align: center;
	}

	.empty-state__title {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.empty-state__body {
		margin: 0 auto;
		max-width: 400px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-3;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-family: $font-family-base;
		font-size: 13px;
		min-width: 760px;
	}

	thead th {
		text-align: left;
		padding: 10px 14px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-2;
		background: $admin-sunken;
		border-bottom: 1px solid $admin-line-soft;
	}

	tbody td {
		padding: 12px 14px;
		border-bottom: 1px solid $admin-line-soft;
		vertical-align: top;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.cell__name {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.cell__sub {
		margin: 2px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.cell__reason {
		margin: 6px 0 0;
		font-size: 11px;
		color: $admin-ink-2;
		max-width: 220px;
	}

	.link {
		color: #2050d4;
		font-size: 12px;
		text-decoration: none;
	}

	.badge {
		display: inline-block;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-radius: 999px;

		&--new {
			background: #e2e8f5;
			color: #24427e;
		}

		&--shortlisted {
			background: #fff4d4;
			color: #6a4f00;
		}

		&--forwarded {
			background: #d6f5e1;
			color: #0e6b2c;
		}

		&--rejected {
			background: #fde0e0;
			color: #9a1515;
		}
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.actions {
		display: inline-flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.btn {
		padding: 6px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		&:disabled {
			opacity: 0.55;
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
</style>
