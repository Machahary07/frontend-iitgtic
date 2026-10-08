<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import { isExpired, type JobStatus } from '$lib/utils/jobPostings';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type JobRow = {
		id: string;
		slug: string;
		role: string;
		type: string;
		work_mode: string;
		location: string;
		sector: string;
		posted: string;
		closes_on: string | null;
		max_applicants: number;
		status: JobStatus;
		removed_reason: string | null;
	};

	const jobs = $derived(data.jobs as JobRow[]);
	const applied = $derived(data.applied as Record<string, number>);

	// What the board shows for each role, which is not always its stored status:
	// an open role past its closing date is off the board all the same.
	function state(job: JobRow): { label: string; tone: string } {
		if (job.status === 'removed') return { label: 'Removed by TIC', tone: 'bad' };
		if (job.status === 'closed') return { label: 'Closed', tone: 'neutral' };
		if (isExpired(job.closes_on)) return { label: 'Past closing date', tone: 'warn' };
		return { label: 'Live', tone: 'good' };
	}

	async function call(method: string, query: string, body?: object) {
		const res = await fetch(`/api/founder/jobs${query}`, {
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

	async function setOpen(job: JobRow, open: boolean) {
		const ok = await call('PATCH', '', {
			companyId: data.activeCompanyId,
			id: job.id,
			action: open ? 'reopen' : 'close'
		});
		if (!ok) return;
		showToast(open ? 'Role reopened.' : 'Role closed.', 'ok');
		await invalidateAll();
	}

	async function remove(job: JobRow) {
		const ok = await askConfirm({
			title: `Delete "${job.role}"?`,
			body: 'The role is deleted for good. Applicants you already have stay in your inbox.',
			confirmLabel: 'Delete role',
			tone: 'danger'
		});
		if (!ok) return;
		if (!(await call('DELETE', `?companyId=${data.activeCompanyId}&id=${job.id}`))) return;
		showToast('Role deleted.', 'ok');
		await invalidateAll();
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// A page at a time; back to the first page whenever the view changes.
	const pager = new Pager(
		() => jobs,
		() => []
	);
</script>

<svelte:head>
	<title>Founder Console · Job postings</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Job postings"
	eyebrow="Hiring"
	requiresVerifiedCompany
>
	{#snippet pageActions()}
		<a class="btn-primary" href={resolve('/founder/jobs/[id]', { id: 'new' })}>Post a role</a>
	{/snippet}

	<p class="lede">
		A role goes live on the Opportunities board the moment you post it, and stays up until you close
		it, its closing date passes, or TIC removes it. Everyone who applies lands in Applicants.
	</p>

	{#if jobs.length === 0}
		<div class="empty">
			<p>No roles yet.</p>
			<a class="btn-primary" href={resolve('/founder/jobs/[id]', { id: 'new' })}>
				Post your first role
			</a>
		</div>
	{:else}
		<div class="panel">
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Role</th>
							<th>Type</th>
							<th>Status</th>
							<th>Applied</th>
							<th>Posted</th>
							<th class="actions-col"></th>
						</tr>
					</thead>
					<tbody>
						{#each pager.rows as job (job.id)}
							{@const st = state(job)}
							<tr>
								<td>
									<p class="cell__name">{job.role}</p>
									<p class="cell__sub">{job.location}{job.sector ? ` · ${job.sector}` : ''}</p>
									{#if job.status === 'removed'}
										<p class="cell__note">TIC said: {job.removed_reason || 'No reason given.'}</p>
									{/if}
								</td>
								<td>
									<span class="type">{job.type}</span>
									<p class="cell__sub">{job.work_mode}</p>
								</td>
								<td>
									<span class="badge badge--{st.tone}">{st.label}</span>
									{#if job.closes_on && job.status === 'open'}
										<p class="cell__sub">Closes {formatDate(job.closes_on)}</p>
									{/if}
								</td>
								<td>
									<a class="link" href={resolve('/founder/applicants')}>{applied[job.id] ?? 0}</a>
									<span class="cell__sub"> / {job.max_applicants}</span>
								</td>
								<td><p class="cell__sub">{formatDate(job.posted)}</p></td>
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
										{#if job.status !== 'removed'}
											<a class="link" href={resolve('/founder/jobs/[id]', { id: job.id })}>Edit</a>
											<button type="button" class="link" onclick={() => setOpen(job, job.status === 'closed')}>
												{job.status === 'closed' ? 'Reopen' : 'Close'}
											</button>
										{/if}
										<button type="button" class="link link--danger" onclick={() => remove(job)}>
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination {pager} noun="roles" />
		</div>
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.lede {
		margin: 0 0 16px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 76ch;

	}

	.empty {
		@include admin-empty;
	}

	.panel {
		@include admin-panel;
		overflow: hidden;
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
	}

	.cell__note {
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 1.5;
		color: admin-tone-fg('bad');
		max-width: 46ch;
	}

	.type {
		@include admin-badge;
		background: $admin-sunken;
		color: $admin-ink-2;
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
	}

	.btn-primary {
		@include admin-btn-primary;
		text-decoration: none;
		display: inline-flex;
	}
</style>
