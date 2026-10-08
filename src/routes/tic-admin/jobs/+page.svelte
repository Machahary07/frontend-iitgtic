<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import { isExpired, type JobOwner, type JobStatus } from '$lib/utils/jobPostings';
	import type { PageData } from './$types';

	// Two tabs over one table. TIC: the centre's own roles, run end to end here.
	// Incubatees: every startup's roles, read-only apart from taking one down with
	// a reason — and only a count of who applied, since the applicants are the
	// startup's.

	let { data }: { data: PageData } = $props();

	type JobRow = {
		id: string;
		owner: JobOwner;
		slug: string;
		role: string;
		company: string;
		location: string;
		type: string;
		work_mode: string;
		sector: string;
		pay: string;
		closes_on: string | null;
		max_applicants: number;
		posted: string;
		description: string;
		status: JobStatus;
		removed_reason: string | null;
	};

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const jobs = $derived(data.jobs as JobRow[]);
	const counts = $derived(data.counts as Record<string, { total: number; bytes: number }>);

	function fmtSize(bytes: number) {
		if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	let tab = $state<JobOwner>('tic');
	const shown = $derived(jobs.filter((j) => j.owner === tab));
	// What this tab's resumes cost in storage, all roles together.
	const tabBytes = $derived(shown.reduce((sum, j) => sum + (counts[j.id]?.bytes ?? 0), 0));
	const ticCount = $derived(jobs.filter((j) => j.owner === 'tic').length);
	const incubateeCount = $derived(jobs.filter((j) => j.owner === 'incubatee').length);

	function standing(job: JobRow): { label: string; tone: string } {
		if (job.status === 'removed') return { label: 'Removed', tone: 'bad' };
		if (job.status === 'closed') return { label: 'Closed', tone: 'neutral' };
		if (isExpired(job.closes_on)) return { label: 'Past closing date', tone: 'warn' };
		return { label: 'Live', tone: 'good' };
	}

	let openId = $state('');
	let reasons = $state<Record<string, string>>({});
	let busy = $state('');

	async function call(method: string, query: string, body?: object) {
		const res = await fetch(`/api/tic-admin/jobs${query}`, {
			method,
			headers: body ? { 'content-type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined
		});
		const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
		if (!res.ok || !out.ok) {
			showToast(out.error ?? 'That did not go through.', 'err');
			return false;
		}
		return true;
	}

	async function run(id: string, work: () => Promise<boolean>, done: string) {
		if (busy) return;
		busy = id;
		try {
			if (!(await work())) return;
			showToast(done, 'ok');
			await invalidateAll();
		} finally {
			busy = '';
		}
	}

	function setOpen(job: JobRow, open: boolean) {
		run(
			job.id,
			() => call('PATCH', '', { id: job.id, action: open ? 'reopen' : 'close' }),
			open ? 'Role reopened.' : 'Role closed.'
		);
	}

	async function deleteJob(job: JobRow) {
		const ok = await askConfirm({
			title: `Delete "${job.role}"?`,
			body: 'The role is deleted for good. Responses already received stay in Job responses.',
			confirmLabel: 'Delete role',
			tone: 'danger'
		});
		if (!ok) return;
		run(job.id, () => call('DELETE', `?id=${job.id}`), 'Role deleted.');
	}

	async function removeJob(job: JobRow) {
		const reason = reasons[job.id]?.trim();
		if (!reason) {
			showToast('Write a reason first — the startup reads it.', 'err');
			return;
		}
		const ok = await askConfirm({
			title: `Remove "${job.role}"?`,
			body: `It comes off the board, and ${job.company} is emailed the reason.`,
			confirmLabel: 'Remove role',
			tone: 'danger'
		});
		if (!ok) return;
		run(
			job.id,
			() => call('PATCH', '', { id: job.id, action: 'remove', reason }),
			'Role removed. The startup was emailed.'
		);
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
		() => shown,
		() => [tab]
	);
</script>

<svelte:head>
	<title>TIC Admin · Job postings</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Job postings"
	eyebrow="Opportunities"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="btn-primary" href={resolve('/tic-admin/jobs/[id]', { id: 'new' })}>Post a job</a>
	{/snippet}

	<div class="tabs">
		<button class="tab" class:tab--active={tab === 'tic'} onclick={() => (tab = 'tic')}>
			TIC <span class="tab__count">{ticCount}</span>
		</button>
		<button class="tab" class:tab--active={tab === 'incubatee'} onclick={() => (tab = 'incubatee')}>
			Incubatees <span class="tab__count">{incubateeCount}</span>
		</button>
	</div>

	<p class="note">
		{#if tab === 'tic'}
			The centre's own roles, on the TIC jobs board. A role is live once posted; responses land in
			<a href={resolve('/tic-admin/job-applications')}>Job responses</a>.
		{:else}
			Roles startups posted themselves. Their applicants are theirs — you see how many applied, not
			who. Remove a role only with a reason; the startup reads it in their console and by email.
		{/if}
		Resumes here use <strong>{fmtSize(tabBytes)}</strong> of storage; each role takes at most 200 PDFs
		of 2 MB, and they are deleted 90 days after the role ends.
	</p>

	<div class="panel">
		{#if shown.length === 0}
			<p class="empty">
				{tab === 'tic'
					? 'No TIC roles yet. Post the first one.'
					: 'No startup has posted a role yet.'}
			</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Role</th>
							{#if tab === 'incubatee'}<th>Startup</th>{/if}
							<th>Type</th>
							<th>Status</th>
							<th>{tab === 'tic' ? 'Responses' : 'Applied'}</th>
							<th>Posted</th>
							<th class="actions-col"></th>
						</tr>
					</thead>
					<tbody>
						{#each pager.rows as job (job.id)}
							{@const st = standing(job)}
							{@const count = counts[job.id] ?? { total: 0, bytes: 0 }}
							<tr>
								<td>
									<p class="cell__name">{job.role}</p>
									<p class="cell__sub">{job.location}{job.sector ? ` · ${job.sector}` : ''}</p>
								</td>
								{#if tab === 'incubatee'}
									<td><p class="cell__name">{job.company}</p></td>
								{/if}
								<td>
									<p class="cell__sub cell__sub--ink">{job.type}</p>
									<p class="cell__sub">{job.work_mode}</p>
								</td>
								<td>
									<span class="badge badge--{st.tone}">{st.label}</span>
									{#if job.closes_on && job.status === 'open'}
										<p class="cell__sub">Closes {fmtDate(job.closes_on)}</p>
									{/if}
								</td>
								<td>
									{#if tab === 'tic'}
										<a
											class="link"
											href="{resolve('/tic-admin/job-applications')}?role={encodeURIComponent(
												job.slug
											)}"
										>
											{count.total}
										</a>
										<span class="cell__sub"> / {job.max_applicants}</span>
									{:else}
										<p class="cell__name">
											{count.total}<span class="cell__sub"> / {job.max_applicants}</span>
										</p>
									{/if}
									{#if count.bytes > 0}<p class="cell__sub">{fmtSize(count.bytes)}</p>{/if}
								</td>
								<td><p class="cell__sub">{fmtDate(job.posted)}</p></td>
								<td class="actions-col">
									<div class="actions">
										{#if st.label === 'Live'}
											<a
												class="link"
												href={resolve('/opportunities/[id]', { id: job.slug })}
												target="_blank"
												rel="noopener noreferrer">View</a
											>
										{/if}
										{#if tab === 'tic'}
											<a class="link" href={resolve('/tic-admin/jobs/[id]', { id: job.id })}>Edit</a
											>
											<button
												class="link"
												disabled={busy === job.id}
												onclick={() => setOpen(job, job.status === 'closed')}
											>
												{job.status === 'closed' ? 'Reopen' : 'Close'}
											</button>
											<button
												class="link link--danger"
												disabled={busy === job.id}
												onclick={() => deleteJob(job)}
											>
												Delete
											</button>
										{:else}
											<button
												class="link"
												aria-expanded={openId === job.id}
												onclick={() => (openId = openId === job.id ? '' : job.id)}
											>
												{openId === job.id ? 'Hide' : 'Details'}
											</button>
										{/if}
									</div>
								</td>
							</tr>

							{#if tab === 'incubatee' && openId === job.id}
								<tr class="detail-row">
									<td colspan="7">
										<div class="detail">
											<dl>
												<div>
													<dt>Location</dt>
													<dd>{job.location}</dd>
												</div>
												<div>
													<dt>Work mode</dt>
													<dd>{job.work_mode}</dd>
												</div>
												{#if job.pay}
													<div>
														<dt>Pay</dt>
														<dd>{job.pay}</dd>
													</div>
												{/if}
												{#if job.closes_on}
													<div>
														<dt>Closing date</dt>
														<dd>{fmtDate(job.closes_on)}</dd>
													</div>
												{/if}
												{#if job.sector}
													<div>
														<dt>Sector</dt>
														<dd>{job.sector}</dd>
													</div>
												{/if}
											</dl>
											<p class="description">{job.description}</p>

											{#if job.status === 'removed'}
												<p class="removed">
													Removed: {job.removed_reason || 'no reason recorded.'}
												</p>
											{:else}
												<div class="remove">
													<input
														type="text"
														placeholder="Reason for removing — the startup reads this"
														value={reasons[job.id] ?? ''}
														oninput={(e) =>
															(reasons = { ...reasons, [job.id]: e.currentTarget.value })}
													/>
													<button
														class="btn btn--danger"
														disabled={busy === job.id}
														onclick={() => removeJob(job)}
													>
														Remove role
													</button>
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination {pager} noun="roles" />
		{/if}
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.btn-primary {
		@include admin-btn-primary;
		text-decoration: none;
		display: inline-flex;
	}

	.tabs {
		@include admin-tabs;
		margin-bottom: 14px;
	}

	.tab {
		@include admin-tab;
	}

	.tab__count {
		@include admin-tab-count;
	}

	.note {
		margin: 0 0 16px;
		max-width: 76ch;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;

		a {
			color: $admin-accent;
			font-weight: $font-weight-semibold;
			text-decoration: none;
		}
	}

	.panel {
		@include admin-panel;
		overflow: hidden;
	}

	.empty {
		@include admin-empty;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		@include admin-table(760px);
	}

	thead th {
		@include admin-thead;
	}

	tbody td {
		@include admin-td;
	}

	.cell__name {
		@include admin-cell-name;
	}

	.cell__sub {
		@include admin-cell-sub;

		&--ink {
			color: $admin-ink;
		}
	}

	.badge {
		@include admin-badge;

		&--good {
			@include admin-badge-tone('good');
		}
		&--warn {
			@include admin-badge-tone('warn');
		}
		&--bad {
			@include admin-badge-tone('bad');
		}
		&--neutral {
			background: $admin-sunken;
			color: $admin-ink-2;
		}
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.actions {
		display: inline-flex;
		gap: 12px;
		align-items: center;
	}

	.link {
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		text-decoration: none;
		cursor: pointer;
		@include admin-focus-ring($admin-accent);

		&--danger {
			color: admin-tone-fg('bad');
		}

		&:disabled {
			cursor: default;
			opacity: 0.5;
		}
	}

	.detail-row td {
		background: $admin-sunken;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 4px 0 8px;
		white-space: normal;
	}

	dl {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 12px;
		margin: 0;

		dt {
			@include admin-field-label;
		}

		dd {
			margin: 2px 0 0;
			font-size: 13px;
			color: $admin-ink;
		}
	}

	.description {
		margin: 0;
		max-width: 80ch;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		white-space: pre-wrap;
	}

	.removed {
		margin: 0;
		font-size: 13px;
		color: admin-tone-fg('bad');
	}

	.remove {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;

		input {
			@include admin-input;
			flex: 1 1 260px;
		}
	}

	.btn {
		@include admin-btn-base;

		&--danger {
			color: admin-tone-fg('bad');
		}
	}
</style>
