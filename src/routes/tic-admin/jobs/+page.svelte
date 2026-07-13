<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { isTicAdminAuthed, logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { getAllJobs, type AnyJob } from '$lib/utils/jobPostings';
	import { getAllCompanies, type CompanyAccount } from '$lib/utils/companyAuth';

	const navItems = [
		{ label: 'Overview', href: '/tic-admin' },
		{ label: 'Companies', href: '/tic-admin/companies' },
		{ label: 'Posted jobs', href: '/tic-admin/jobs' },
		{ separator: true as const },
		{ label: 'Home page', href: '/tic-admin/home-page' }
	];

	type Filter = 'all' | 'user' | 'seed';

	let mounted = $state(false);
	let jobs = $state<AnyJob[]>([]);
	let companies = $state<CompanyAccount[]>([]);
	let filter = $state<Filter>('all');

	onMount(() => {
		if (!isTicAdminAuthed()) {
			goto('/tic-admin/login');
			return;
		}
		jobs = getAllJobs();
		companies = getAllCompanies();
		mounted = true;
	});

	const filtered = $derived(filter === 'all' ? jobs : jobs.filter((j) => j.source === filter));
	const counts = $derived({
		all: jobs.length,
		user: jobs.filter((j) => j.source === 'user').length,
		seed: jobs.filter((j) => j.source === 'seed').length
	});

	function companyStatus(companyId: string): CompanyAccount['status'] | null {
		if (!companyId) return null;
		return companies.find((c) => c.id === companyId)?.status ?? null;
	}

	function handleLogout() {
		logoutTicAdmin();
		goto('/tic-admin/login');
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

{#if mounted}
	<AdminShell
		brand="TIC Team Admin"
		brandSub="Internal"
		{navItems}
		title="Posted jobs"
		eyebrow="Opportunities"
		user="TIC Team"
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
			Read-only view. To remove a company-posted job, the posting company must delete it from their
			dashboard, or you can delete the company from <a href="/tic-admin/companies">Companies</a>.
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
										<a class="link" href="/opportunities/{job.slug}" target="_blank" rel="noopener noreferrer">View →</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</AdminShell>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;

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
		border: 1px solid #e6e8ec;
		border-radius: 999px;
		cursor: pointer;

		&:hover {
			background: #f6f7f9;
		}

		&--active {
			color: #fff;
			background: #111;
			border-color: #111;

			&:hover {
				background: #000;
			}
		}
	}

	.tab__count {
		font-size: 11px;
		opacity: 0.7;
	}

	.note {
		margin: 0 0 16px;
		font-size: 12px;
		color: #666;
		padding: 10px 12px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-left: 3px solid #2050d4;
		border-radius: 6px;

		a {
			color: #2050d4;
			text-decoration: none;

			&:hover {
				text-decoration: underline;
			}
		}
	}

	.panel {
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		overflow: hidden;
	}

	.empty {
		margin: 0;
		padding: 40px 18px;
		text-align: center;
		font-size: 13px;
		color: #777;
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
		color: #666;
		background: #fafbfc;
		border-bottom: 1px solid #eef0f3;
	}

	tbody td {
		padding: 12px 14px;
		border-bottom: 1px solid #f1f2f4;
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
		color: #777;
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

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.link {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #2050d4;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}
</style>
