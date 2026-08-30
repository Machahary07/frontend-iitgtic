<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import type { PageData } from './$types';

	// Everything here arrives from +page.server.ts, so the section renders on the
	// first paint instead of flashing empty while the browser fetches.
	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const companies = $derived(data.companies);
	const applications = $derived(data.applications);

	const pending = $derived(companies.filter((c) => c.status === 'pending'));
	const verified = $derived(companies.filter((c) => c.status === 'verified'));
	const rejected = $derived(companies.filter((c) => c.status === 'rejected'));
	const userJobs = $derived(data.jobs);
	const newApplications = $derived(applications.filter((a) => a.status === 'submitted'));

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Overview</title>
</svelte:head>

<AdminShell
		brand="TIC Team Admin"
		brandSub="Internal"
		navItems={TIC_ADMIN_NAV}
		title="Overview"
		eyebrow="Dashboard"
		user={adminName}
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
			<div class="stat">
				<p class="stat__label">New applications</p>
				<p class="stat__value">{newApplications.length}</p>
				<a href={resolve('/tic-admin/applications')} class="stat__link">Review →</a>
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
								<p class="row__meta">
									{company.email} · {new Date(company.createdAt).toLocaleDateString()}
								</p>
							</div>
							<a href="/tic-admin/companies" class="row__cta">Review</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="panel">
			<header class="panel__head">
				<h2>New applications</h2>
				<a href={resolve('/tic-admin/applications')} class="panel__more">All applications →</a>
			</header>
			{#if newApplications.length === 0}
				<p class="empty">No applications waiting for review.</p>
			{:else}
				<ul class="rows">
					{#each newApplications.slice(0, 5) as application (application.id)}
						<li class="row">
							<div class="row__main">
								<p class="row__title">{application.startup_name || 'Untitled startup'}</p>
								<p class="row__meta">
									{application.full_name || application.email} · {new Date(
										application.created_at
									).toLocaleDateString()}
								</p>
							</div>
							<a
								href={resolve('/tic-admin/applications/[id]', { id: application.id })}
								class="row__cta">Open</a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.stats {
		display: grid;
		// Five tiles: an even five-up on wide screens beats 4 + 1 orphaned.
		grid-template-columns: repeat(5, 1fr);
		gap: 14px;
		margin-bottom: 28px;

		@include breakpoint-down($bp-lg) {
			grid-template-columns: repeat(3, 1fr);
		}

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
