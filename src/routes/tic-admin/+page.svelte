<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import Clock from '@lucide/svelte/icons/clock';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import FileText from '@lucide/svelte/icons/file-text';
	import UserSearch from '@lucide/svelte/icons/user-search';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
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
	const jobApplicants = $derived(data.jobApplications);
	const newApplicants = $derived(jobApplicants.filter((a) => a.status === 'new'));

	// The six headline counts, described once so the tile markup stays a loop.
	// `tone` picks a tint from the shared admin palette.
	const tiles = $derived([
		{
			label: 'Pending companies',
			value: pending.length,
			tone: 'warn',
			icon: Clock,
			href: '/tic-admin/companies',
			cta: 'Review'
		},
		{ label: 'Verified companies', value: verified.length, tone: 'good', icon: BadgeCheck },
		{ label: 'Rejected', value: rejected.length, tone: 'bad', icon: CircleX },
		{
			label: 'User-posted jobs',
			value: userJobs.length,
			tone: 'info',
			icon: Briefcase,
			href: '/tic-admin/jobs',
			cta: 'View all'
		},
		{
			label: 'New applications',
			value: newApplications.length,
			tone: 'good',
			icon: FileText,
			href: resolve('/tic-admin/applications'),
			cta: 'Review'
		},
		{
			label: 'New role applicants',
			value: newApplicants.length,
			tone: 'violet',
			icon: UserSearch,
			href: resolve('/tic-admin/job-applications'),
			cta: 'Review'
		}
	]);

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
		{#each tiles as tile (tile.label)}
			{@const Icon = tile.icon}
			<div
				class="stat"
				style="--tile-bg: var(--admin-tone-{tile.tone}-bg); --tile-fg: var(--admin-tone-{tile.tone}-fg);"
			>
				<span class="stat__icon"><Icon size={17} strokeWidth={1.9} /></span>
				<p class="stat__label">{tile.label}</p>
				<p class="stat__value">{tile.value}</p>
				{#if tile.href}
					<a href={tile.href} class="stat__link">
						{tile.cta}
						<ArrowRight size={13} strokeWidth={2.2} />
					</a>
				{/if}
			</div>
		{/each}
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
			<h2>New role applicants</h2>
			<a href={resolve('/tic-admin/job-applications')} class="panel__more">All applicants →</a>
		</header>
		{#if newApplicants.length === 0}
			<p class="empty">No one is waiting on a role application.</p>
		{:else}
			<ul class="rows">
				{#each newApplicants.slice(0, 5) as applicant (applicant.id)}
					<li class="row">
						<div class="row__main">
							<p class="row__title">{applicant.full_name}</p>
							<p class="row__meta">
								{applicant.job_role} · {applicant.job_company} · {new Date(
									applicant.created_at
								).toLocaleDateString()}
							</p>
						</div>
						<a
							href={resolve('/tic-admin/job-applications/[id]', { id: applicant.id })}
							class="row__cta">Open</a
						>
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
	@use '$styles/admin' as *;

	.stats {
		display: grid;
		// Six tiles: an even three-up on wide screens keeps two tidy rows.
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: 28px;

		@include breakpoint-down($bp-md) {
			grid-template-columns: repeat(2, 1fr);
		}

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	.stat {
		@include admin-card;
		padding: 18px;
		gap: 8px;
	}

	.stat__icon {
		@include admin-icon-tile('neutral', 36px);
		background: var(--tile-bg);
		color: var(--tile-fg);
		margin-bottom: 2px;
	}

	.stat__label {
		margin: 0;
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: $admin-ink-2;
	}

	.stat__value {
		margin: 0;
		font-size: 34px;
		font-weight: $font-weight-bold;
		color: $admin-ink;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.stat__link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 6px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		text-decoration: none;
		@include admin-focus-ring($admin-accent);
	}

	.panel {
		@include admin-panel;
		margin-bottom: 18px;

		&:last-of-type {
			margin-bottom: 0;
		}
	}

	.panel__head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 18px 20px;
		border-bottom: 1px solid $admin-line-soft;

		h2 {
			@include admin-section-title;
		}
	}

	.panel__more {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		text-decoration: none;
		white-space: nowrap;
		@include admin-focus-ring($admin-accent);
	}

	.empty {
		@include admin-empty;
		padding: 32px 18px;
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
		padding: 14px 20px;
		border-bottom: 1px solid $admin-line-soft;

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
		color: $admin-ink;
	}

	.row__meta {
		margin: 2px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.row__cta {
		flex: none;
		padding: 7px 14px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $color-white;
		background: $admin-ink;
		border: 1px solid $admin-ink;
		border-radius: $admin-radius-pill;
		text-decoration: none;
		@include admin-focus-ring;

		&:active {
			transform: translateY(0.5px);
		}
	}
</style>
