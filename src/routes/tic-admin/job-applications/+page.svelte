<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import Select from '$lib/components/Select.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminClearJobApplicants,
		adminExportJobApplications,
		adminResumeLinks,
		type JobApplicationSummary
	} from '$lib/utils/ticAdmin';
	import { downloadCsv, stampedFileName, toCsv } from '$lib/utils/csv';
	import { downloadResumesZip } from '$lib/utils/resumeZip';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const applicants = $derived(data.jobApplications as unknown as JobApplicationSummary[]);

	// Job postings links here with ?role=<slug> to open one role's responses.
	let role = $state(page.url.searchParams.get('role') ?? 'all');

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

	const filtered = $derived(byRole);

	let busy = $state('');

	// Every resume in the view as one zip, built in the browser from ten-minute
	// links — before the 90-day clear-out, this is how a role's resumes are kept.
	async function handleDownloadResumes() {
		busy = 'zip';
		try {
			const files = await adminResumeLinks(role === 'all' ? undefined : role);
			if (files.length === 0) {
				showToast('No resumes to download in this view.', 'info');
				return;
			}
			await downloadResumesZip(
				files,
				stampedFileName('resumes', role === 'all' ? 'all-roles' : roleLabel(role)).replace(
					/\.csv$/,
					''
				)
			);
		} catch {
			showToast('Could not build the zip. Try again.', 'err');
		} finally {
			busy = '';
		}
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
		const count = byRole.length;
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

	// A page at a time; back to the first page whenever the view changes.
	const pager = new Pager(
		() => filtered,
		() => [role]
	);
</script>

<svelte:head>
	<title>TIC Admin · Job responses</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Job responses"
	eyebrow="Opportunities"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="controls">
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
			<button class="btn" onclick={handleDownloadResumes} disabled={busy !== ''}>
				{busy === 'zip' ? 'Zipping…' : 'Download resumes'}
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
						</tr>
					</thead>
					<tbody>
						{#each pager.rows as applicant (applicant.id)}
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
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination {pager} noun="applicants" />
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

	.link {
		color: #2050d4;
		font-size: 12px;
		text-decoration: none;
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

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
			background: #fff;
		}
	}
</style>
