<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { seedJobs, type AnyJob } from '$lib/utils/jobPostings';
	import type { CompanyAccount } from '$lib/utils/companyAuth';
	import { adminDeleteJob } from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	type Filter = 'all' | 'user' | 'seed';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const companies = $derived(data.companies as CompanyAccount[]);

	// Seed posts live in content.json rather than the database, so the admin list
	// is the union — the same thing the public Opportunities page shows.
	const jobs = $derived<AnyJob[]>(
		[
			...data.jobs.map((row) => ({
				id: row.id,
				slug: row.slug,
				companyId: row.company_id,
				role: row.role,
				company: row.company,
				companySlug: row.company_slug,
				location: row.location,
				type: row.type,
				sector: row.sector,
				posted: row.posted,
				description: row.description,
				applyLink: row.apply_link,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				source: 'user' as const
			})),
			...seedJobs()
		].sort((a, b) => (a.posted < b.posted ? 1 : a.posted > b.posted ? -1 : 0))
	);

	let filter = $state<Filter>('all');

	const filtered = $derived(filter === 'all' ? jobs : jobs.filter((j) => j.source === filter));
	const counts = $derived({
		all: jobs.length,
		user: jobs.filter((j) => j.source === 'user').length,
		seed: jobs.filter((j) => j.source === 'seed').length
	});

	async function removeJob(id: string, role: string) {
		const ok = await askConfirm({
			title: `Remove "${role}"?`,
			body: 'The posting disappears from Opportunities immediately.',
			confirmLabel: 'Take down',
			tone: 'danger'
		});
		if (!ok) return;
		await adminDeleteJob(id);
		await invalidateAll();
	}

	function companyStatus(companyId: string): CompanyAccount['status'] | null {
		if (!companyId) return null;
		return companies.find((c) => c.id === companyId)?.status ?? null;
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
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
	<title>TIC Admin · Posted jobs</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	title="Posted jobs"
	eyebrow="Opportunities"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="tabs">
		<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
			All <span class="tab__count">{counts.all}</span>
		</button>
		<button class="tab" class:tab--active={filter === 'user'} onclick={() => (filter = 'user')}>
			Company-posted <span class="tab__count">{counts.user}</span>
		</button>
		<button class="tab" class:tab--active={filter === 'seed'} onclick={() => (filter = 'seed')}>
			Seed <span class="tab__count">{counts.seed}</span>
		</button>
	</div>

	<p class="note">
		Seed roles come from <code>content.json</code> and can only be changed in the codebase. Company-posted
		roles can be removed here, or by the company from its own dashboard.
	</p>

	<div class="panel">
		{#if filtered.length === 0}
			<p class="empty">No jobs in this view.</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Role</th>
							<th>Company</th>
							<th>Type</th>
							<th>Posted</th>
							<th>Source</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as job (job.id)}
							<tr>
								<td>
									<p class="cell__name">{job.role}</p>
									<p class="cell__sub">{job.location} · {job.sector}</p>
								</td>
								<td>
									<p class="cell__name">{job.company}</p>
									{#if job.source === 'user'}
										{@const status = companyStatus(job.companyId)}
										{#if status}
											<span class="badge badge--{status}">{status}</span>
										{/if}
									{/if}
								</td>
								<td><p class="cell__sub">{job.type}</p></td>
								<td><p class="cell__sub">{fmtDate(job.posted)}</p></td>
								<td>
									<span class="src src--{job.source}">{job.source}</span>
								</td>
								<td class="actions-col">
									<div class="actions">
										<a
											class="link"
											href="/opportunities/{job.slug}"
											target="_blank"
											rel="noopener noreferrer">View →</a
										>
										{#if job.source === 'user'}
											<button class="btn btn--danger" onclick={() => removeJob(job.id, job.role)}>
												Remove
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

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 14px;
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

	.note {
		margin: 0 0 16px;
		font-size: 12px;
		color: $admin-ink-2;
		padding: 10px 12px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-left: 3px solid #2050d4;
		border-radius: $admin-radius-sm;
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

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-family: $font-family-base;
		font-size: 13px;
		min-width: 720px;
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

	.badge {
		display: inline-block;
		margin-top: 4px;
		padding: 2px 8px;
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-radius: 999px;

		&--pending {
			background: #fff4d4;
			color: #6a4f00;
		}

		&--verified {
			background: #d6f5e1;
			color: #0e6b2c;
		}

		&--rejected {
			background: #fde0e0;
			color: #9a1515;
		}
	}

	.src {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-radius: 999px;

		&--user {
			background: #e0e9ff;
			color: #1d3da3;
		}

		&--seed {
			background: #f0f0f0;
			color: #555;
		}
	}

	.actions {
		display: inline-flex;
		align-items: center;
		gap: 10px;
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
		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
		}
	}

	.note code {
		font-size: 11px;
		background: $admin-line-soft;
		padding: 1px 5px;
		border-radius: 3px;
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.link {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #2050d4;
		text-decoration: none;
	}
</style>
