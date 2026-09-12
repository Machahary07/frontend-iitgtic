<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type JobRow = {
		id: string;
		slug: string;
		role: string;
		location: string;
		type: string;
		sector: string;
		status: 'pending' | 'approved' | 'rejected';
		review_note: string | null;
		submitted_at: string;
	};

	const jobs = $derived(data.jobs as JobRow[]);
	const pending = $derived(jobs.filter((j) => j.status === 'pending'));

	const STATUS: Record<string, { label: string; tone: string }> = {
		pending: { label: 'Waiting for TIC', tone: 'warn' },
		approved: { label: 'Live on the board', tone: 'good' },
		rejected: { label: 'Sent back', tone: 'bad' }
	};

	async function remove(job: JobRow) {
		const ok = await askConfirm({
			title: `Withdraw "${job.role}"?`,
			body:
				job.status === 'approved'
					? 'The role comes off the public board straight away. This cannot be undone.'
					: 'The role leaves the approval queue and is deleted. This cannot be undone.',
			confirmLabel: 'Withdraw role',
			tone: 'danger'
		});
		if (!ok) return;

		const res = await fetch(`/api/founder/jobs?id=${job.id}`, { method: 'DELETE' });
		if (!res.ok) {
			showToast('Could not withdraw the role.', 'err');
			return;
		}
		showToast('Role withdrawn.', 'ok');
		await invalidateAll();
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Founder Console · Job postings</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	title="Job postings"
	eyebrow="Hiring"
	requiresVerifiedCompany
>
	{#snippet pageActions()}
		<a class="btn-primary" href={resolve('/founder/jobs/[id]', { id: 'new' })}>Post a role</a>
	{/snippet}

	<p class="lede">
		A role you write here goes into TIC's approval queue. It appears on the public Opportunities
		board once an admin approves it, and an edit to a live role sends it back to the queue until
		that edit is approved too.
		{#if pending.length > 0}
			<strong>{pending.length} waiting right now.</strong>
		{/if}
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
							<th>Location</th>
							<th>Status</th>
							<th>Submitted</th>
							<th class="actions-col"></th>
						</tr>
					</thead>
					<tbody>
						{#each jobs as job (job.id)}
							<tr>
								<td>
									<p class="cell__name">{job.role}</p>
									<p class="cell__sub">{job.sector}</p>
									{#if job.status === 'rejected' && job.review_note}
										<p class="cell__note">TIC said: {job.review_note}</p>
									{/if}
								</td>
								<td><span class="type">{job.type}</span></td>
								<td><p class="cell__sub">{job.location}</p></td>
								<td>
									<span class="badge badge--{STATUS[job.status].tone}">
										{STATUS[job.status].label}
									</span>
								</td>
								<td><p class="cell__sub">{formatDate(job.submitted_at)}</p></td>
								<td class="actions-col">
									<div class="actions">
										{#if job.status === 'approved'}
											<a
												class="link"
												href={resolve('/opportunities/[id]', { id: job.slug })}
												target="_blank"
												rel="noopener noreferrer">View</a
											>
										{/if}
										<a class="link" href={resolve('/founder/jobs/[id]', { id: job.id })}>Edit</a>
										<button type="button" class="link link--danger" onclick={() => remove(job)}>
											Withdraw
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
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

		strong {
			color: admin-tone-fg('warn');
		}
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
