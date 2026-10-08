<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Clock from '@lucide/svelte/icons/clock';
	import Video from '@lucide/svelte/icons/video';
	import Send from '@lucide/svelte/icons/send';
	import Rocket from '@lucide/svelte/icons/rocket';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Users from '@lucide/svelte/icons/users';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Search from '@lucide/svelte/icons/search';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { PageData } from './$types';

	// Everything arrives from +page.server.ts, already cut to what this person's
	// role acts on ($lib/server/overview), so the page only lays it out.
	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const overview = $derived(data.overview);

	const ICONS = {
		inbox: Inbox,
		clock: Clock,
		video: Video,
		send: Send,
		rocket: Rocket,
		badge: BadgeCheck,
		users: Users,
		check: CircleCheck,
		x: CircleX,
		search: Search
	};

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Overview</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Overview"
	eyebrow="Dashboard"
	user={adminName}
	onLogout={handleLogout}
>
	<p class="intro">{overview.intro}</p>

	<div class="stats">
		{#each overview.tiles as tile (tile.label)}
			{@const Icon = ICONS[tile.icon]}
			<div
				class="stat"
				style="--tile-bg: var(--admin-tone-{tile.tone}-bg); --tile-fg: var(--admin-tone-{tile.tone}-fg);"
			>
				<span class="stat__icon"><Icon size={17} strokeWidth={1.9} /></span>
				<p class="stat__label">{tile.label}</p>
				<p class="stat__value">{tile.value}</p>
				{#if tile.href}
					<!-- Console paths built on the server. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={tile.href} class="stat__link">
						{tile.cta}
						<ArrowRight size={13} strokeWidth={2.2} />
					</a>
				{/if}
			</div>
		{/each}
	</div>

	{#each overview.lists as list (list.title)}
		<section class="panel">
			<header class="panel__head">
				<h2>{list.title}</h2>
				{#if list.more}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={list.more.href} class="panel__more">{list.more.label}</a>
				{/if}
			</header>
			{#if list.rows.length === 0}
				<p class="empty">{list.empty}</p>
			{:else}
				<ul class="rows">
					{#each list.rows as row (row.id + row.cta)}
						<li class="row">
							<div class="row__main">
								<p class="row__title">{row.title}</p>
								<p class="row__meta">{row.meta}</p>
							</div>
							{#if row.note}
								<span class="row__note" class:row__note--done={row.note === 'Scored'}
									>{row.note}</span
								>
							{/if}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={row.href} class="row__cta">{row.cta}</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;
	@use '$styles/admin' as *;

	.intro {
		margin: 0 0 16px;
		font-size: 13px;
		color: $admin-ink-2;
	}

	.stats {
		display: grid;
		// Each role has its own number of tiles; they share the row evenly.
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 16px;
		margin-bottom: 28px;

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

	.row__note {
		flex: none;
		padding: 3px 9px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		color: #6a4f00;
		background: #fff4d4;
		border-radius: $admin-radius-pill;

		&--done {
			color: #0e6b2c;
			background: #d6f5e1;
		}
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
