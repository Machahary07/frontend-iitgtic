<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { isTicAdminAuthed, logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { getAllCompanies, type CompanyAccount } from '$lib/utils/companyAuth';
	import { getAllJobs, type AnyJob } from '$lib/utils/jobPostings';

	const navItems = [
		{ label: 'Overview', href: '/tic-admin' },
		{ label: 'Companies', href: '/tic-admin/companies' },
		{ label: 'Posted jobs', href: '/tic-admin/jobs' },
		{ separator: true as const },
		{ label: 'Home page', href: '/tic-admin/home-page' }
	];

	let mounted = $state(false);
	let companies = $state<CompanyAccount[]>([]);
	let jobs = $state<AnyJob[]>([]);

	onMount(() => {
		if (!isTicAdminAuthed()) {
			goto('/tic-admin/login');
			return;
		}
		companies = getAllCompanies();
		jobs = getAllJobs();
		mounted = true;
	});

	const pending = $derived(companies.filter((c) => c.status === 'pending'));
	const verified = $derived(companies.filter((c) => c.status === 'verified'));
	const rejected = $derived(companies.filter((c) => c.status === 'rejected'));
	const userJobs = $derived(jobs.filter((j) => j.source === 'user'));

	function handleLogout() {
		logoutTicAdmin();
		goto('/tic-admin/login');
	}
</script>

<svelte:head>
	<title>TIC Admin · Overview</title>
</svelte:head>

{#if mounted}
	<AdminShell
		brand="TIC Team Admin"
		brandSub="Internal"
		{navItems}
		title="Overview"
		eyebrow="Dashboard"
		user="TIC Team"
		onLogout={handleLogout}
	>
		<div class="stats">
			<div class="stat">
				<p class="stat__label">Pending companies</p>
				<p class="stat__value">{pending.length}</p>
				<a href="/tic-admin/companies" class="stat__link">Review →</a>
			</div>
			<div class="stat">
				<p class="stat__label">Verified companies</p>
				<p class="stat__value">{verified.length}</p>
			</div>
			<div class="stat">
				<p class="stat__label">Rejected</p>
				<p class="stat__value">{rejected.length}</p>
			</div>
			<div class="stat">
				<p class="stat__label">User-posted jobs</p>
				<p class="stat__value">{userJobs.length}</p>
				<a href="/tic-admin/jobs" class="stat__link">View all →</a>
			</div>
		</div>

		<section class="panel">
			<header class="panel__head">
				<h2>Recent pending signups</h2>
				<a href="/tic-admin/companies" class="panel__more">All companies →</a>
			</header>
			{#if pending.length === 0}
				<p class="empty">No companies waiting for verification.</p>
			{:else}
				<ul class="rows">
					{#each pending.slice(0, 5) as company (company.id)}
						<li class="row">
							<div class="row__main">
								<p class="row__title">{company.companyName}</p>
								<p class="row__meta">{company.email} · {new Date(company.createdAt).toLocaleDateString()}</p>
							</div>
							<a href="/tic-admin/companies" class="row__cta">Review</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</AdminShell>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 28px;

		@include breakpoint-down($bp-md) {
			grid-template-columns: repeat(2, 1fr);
		}

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	.stat {
		padding: 16px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: $font-family-base;
	}

	.stat__label {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #666;
	}

	.stat__value {
		margin: 0;
		font-size: 28px;
		font-weight: $font-weight-bold;
		color: #111;
		letter-spacing: -0.02em;
	}

	.stat__link {
		margin-top: 4px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #2050d4;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	.panel {
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		overflow: hidden;
	}

	.panel__head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 18px;
		border-bottom: 1px solid #eef0f3;

		h2 {
			margin: 0;
			font-size: 14px;
			font-weight: $font-weight-semibold;
			color: #111;
			font-family: $font-family-base;
		}
	}

	.panel__more {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #2050d4;
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	.empty {
		margin: 0;
		padding: 24px 18px;
		font-size: 13px;
		color: #777;
		text-align: center;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 12px 18px;
		border-bottom: 1px solid #f1f2f4;

		&:last-child {
			border-bottom: 0;
		}
	}

	.row__main {
		flex: 1;
		min-width: 0;
	}

	.row__title {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.row__meta {
		margin: 2px 0 0;
		font-size: 12px;
		color: #777;
	}

	.row__cta {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #fff;
		background: #111;
		padding: 6px 12px;
		border-radius: 6px;
		text-decoration: none;

		&:hover {
			background: #000;
		}
	}
</style>
