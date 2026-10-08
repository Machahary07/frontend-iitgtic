<script lang="ts">
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import Clock from '@lucide/svelte/icons/clock';
	import CheckCircle from '@lucide/svelte/icons/circle-check';
	import XCircle from '@lucide/svelte/icons/circle-x';
	import UserSearch from '@lucide/svelte/icons/user-search';
	import Users from '@lucide/svelte/icons/users';
	import FileText from '@lucide/svelte/icons/file-text';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const company = $derived(data.company);

	const APPLICATION_LABEL: Record<string, string> = {
		submitted: 'Submitted — waiting for review',
		'under-review': 'Under review by TIC',
		accepted: 'Accepted',
		rejected: 'Not accepted'
	};

	const tiles = $derived([
		{
			label: 'Live roles',
			value: data.jobs.live,
			icon: CheckCircle,
			tone: 'good',
			href: resolve('/founder/jobs'),
			cta: 'Manage'
		},
		{
			label: 'Closed roles',
			value: data.jobs.closed,
			icon: Clock,
			tone: 'warn',
			href: resolve('/founder/jobs'),
			cta: 'Review'
		},
		{
			label: 'Removed by TIC',
			value: data.jobs.removed,
			icon: XCircle,
			tone: 'bad',
			href: resolve('/founder/jobs'),
			cta: 'See why'
		},
		{
			label: 'Applicants',
			value: data.applicants.total,
			icon: UserSearch,
			tone: 'violet',
			href: resolve('/founder/applicants'),
			cta: 'Open'
		},
		{
			label: 'Team members',
			value: data.team.approved,
			icon: Users,
			tone: 'info',
			href: resolve('/founder/users'),
			cta: 'Manage'
		},
		{
			label: 'Team waiting on TIC',
			value: data.team.pending,
			icon: Clock,
			tone: 'warn',
			href: resolve('/founder/users'),
			cta: 'View'
		}
	]);

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Founder Console · Overview</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Overview"
	eyebrow="Dashboard"
>
	{#if company && company.status !== 'verified'}
		<div class="note" class:note--stop={company.status === 'rejected'} role="status">
			<p class="note__title">
				{company.status === 'pending'
					? `${company.companyName} is waiting to be verified`
					: `${company.companyName} was not verified`}
			</p>
			<p>
				{#if company.status === 'pending'}
					Roles you write are saved and queued, and go live once TIC verifies the company and
					approves the posting. Your incubation application is unaffected.
				{:else}
					Posting is closed for this account.
					{#if company.rejectionReason}Reason given: {company.rejectionReason}{/if}
				{/if}
			</p>
		</div>
	{/if}

	<div class="tiles">
		{#each tiles as tile (tile.label)}
			{@const Icon = tile.icon}
			<div
				class="tile"
				style="--tile-bg: var(--admin-tone-{tile.tone}-bg); --tile-fg: var(--admin-tone-{tile.tone}-fg);"
			>
				<span class="tile__icon"><Icon size={17} strokeWidth={1.9} /></span>
				<p class="tile__label">{tile.label}</p>
				<p class="tile__value">{tile.value}</p>
				<a class="tile__link" href={tile.href}
					>{tile.cta} <ArrowRight size={13} strokeWidth={2} /></a
				>
			</div>
		{/each}
	</div>

	<section class="panel">
		<h2 class="panel__title">Incubation application</h2>
		{#if data.application}
			<div class="row">
				<span class="row__icon"><FileText size={16} strokeWidth={1.9} /></span>
				<div class="row__body">
					<p class="row__name">{data.application.startupName || 'Your application'}</p>
					<p class="row__sub">
						{APPLICATION_LABEL[data.application.status] ?? data.application.status} · submitted
						{formatDate(data.application.createdAt)}
					</p>
				</div>
				<a class="btn" href={resolve('/founder/application')}>Open</a>
			</div>
		{:else}
			<p class="empty">
				No application submitted yet. The eight-step form lives in this console now, and saves a
				draft as you go.
			</p>
			<a class="btn-primary" href={resolve('/founder/application')}>Start the application</a>
		{/if}
	</section>

	<section class="panel">
		<h2 class="panel__title">What needs TIC sign-off</h2>
		<p class="lede">
			A TIC admin approves each of these before it takes effect. Job postings go live straight
			away.
		</p>
		<ul class="rules">
			<li>
				<span class="rules__icon"><Users size={15} strokeWidth={1.9} /></span> Anyone you add to your
				team
			</li>
			<li>
				<span class="rules__icon"><FileText size={15} strokeWidth={1.9} /></span> Changes to your
				company name, website or contact details{#if data.profileChangePending}<em>
						— one is waiting now</em
					>{/if}
			</li>
		</ul>
	</section>
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.note {
		@include admin-panel;
		padding: 16px 18px;
		margin-bottom: 18px;
		border-left: 3px solid admin-tone-fg('warn');
		display: flex;
		flex-direction: column;
		gap: 5px;
		max-width: 78ch;

		p {
			margin: 0;
			font-size: 13px;
			line-height: 1.6;
			color: $admin-ink-2;
		}

		&--stop {
			border-left-color: admin-tone-fg('bad');
		}
	}

	.note__title {
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	// Six tiles: one row on wide screens, then three-up and two-up so the rows
	// below never end ragged.
	.tiles {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 14px;
		margin-bottom: 18px;

		@media (max-width: #{$bp-lg}) {
			grid-template-columns: repeat(3, 1fr);
		}

		@media (max-width: #{$bp-md}) {
			grid-template-columns: repeat(2, 1fr);
		}

		@media (max-width: #{$bp-xs}) {
			grid-template-columns: 1fr;
		}
	}

	.tile {
		@include admin-panel;
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tile__icon {
		@include admin-icon-tile('neutral', 34px);
		background: var(--tile-bg);
		color: var(--tile-fg);
		margin-bottom: 8px;
	}

	.tile__label {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.tile__value {
		margin: 0;
		font-size: 30px;
		font-weight: $font-weight-bold;
		letter-spacing: -0.03em;
		color: $admin-ink;
		line-height: 1.1;
	}

	.tile__link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 8px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		text-decoration: none;
		@include admin-focus-ring($admin-accent);
	}

	.panel {
		@include admin-panel;
		padding: 20px;
		margin-bottom: 18px;
	}

	.panel__title {
		@include admin-section-title;
		margin: 0 0 10px;
	}

	.lede {
		margin: 0 0 14px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 70ch;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
	}

	.row__icon {
		@include admin-icon-tile('good', 34px);
	}

	.row__body {
		flex: 1;
		min-width: 0;
	}

	.row__name {
		@include admin-cell-name;
	}

	.row__sub {
		@include admin-cell-sub;
	}

	.empty {
		margin: 0 0 14px;
		font-size: 13px;
		color: $admin-ink-2;
		line-height: 1.6;
		max-width: 70ch;
	}

	.rules {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;

		li {
			display: flex;
			align-items: center;
			gap: 10px;
			font-size: 13px;
			color: $admin-ink-2;
		}

		em {
			color: admin-tone-fg('warn');
			font-style: normal;
			font-weight: $font-weight-semibold;
		}
	}

	.rules__icon {
		@include admin-icon-tile('neutral', 28px);
		flex: none;
	}

	.btn {
		@include admin-btn-base;
		text-decoration: none;
	}

	.btn-primary {
		@include admin-btn-primary;
		text-decoration: none;
		align-self: flex-start;
		display: inline-flex;
	}
</style>
