<script lang="ts">
	import { navigating, page } from '$app/state';
	import type { Snippet } from 'svelte';

	type NavItem = { label: string; href: string } | { separator: true };

	interface Props {
		brand: string;
		brandSub?: string;
		navItems: NavItem[];
		title: string;
		eyebrow?: string;
		user?: string | null;
		onLogout?: () => void;
		children: Snippet;
		actions?: Snippet;
	}

	let {
		brand,
		brandSub = '',
		navItems,
		title,
		eyebrow = '',
		user = null,
		onLogout,
		children,
		actions
	}: Props = $props();

	let mobileOpen = $state(false);

	const activeHref = $derived.by(() => {
		const path = page.url.pathname;
		let best = '';
		for (const item of navItems) {
			if ('separator' in item) continue;
			if (path === item.href || path.startsWith(item.href + '/')) {
				if (item.href.length > best.length) best = item.href;
			}
		}
		return best;
	});
</script>

<div class="shell">
	<aside class="sidebar" class:sidebar--open={mobileOpen}>
		<div class="brand">
			<a href="/" class="brand__logo">IITG TIC</a>
			<div class="brand__role">
				<span class="brand__role-title">{brand}</span>
				{#if brandSub}<span class="brand__role-sub">{brandSub}</span>{/if}
			</div>
		</div>

		<nav class="nav">
			{#each navItems as item}
				{#if 'separator' in item}
					<hr class="nav__sep" />
				{:else}
					<a
						href={item.href}
						class="nav__link"
						class:nav__link--active={activeHref === item.href}
						onclick={() => (mobileOpen = false)}
					>
						{item.label}
					</a>
				{/if}
			{/each}
		</nav>

		<div class="sidebar__foot">
			<a href="/" class="foot-link">← Back to public site</a>
		</div>
	</aside>

	<div class="main">
		<header class="topbar">
			<button
				type="button"
				class="hamburger"
				aria-label="Toggle navigation"
				onclick={() => (mobileOpen = !mobileOpen)}
			>
				<span></span><span></span><span></span>
			</button>

			<div class="topbar__title">
				{#if eyebrow}<p class="topbar__eyebrow">{eyebrow}</p>{/if}
				<h1>{title}</h1>
			</div>

			<div class="topbar__right">
				{#if actions}{@render actions()}{/if}
				{#if user}
					<div class="user">
						<span class="user__label">{user}</span>
						{#if onLogout}
							<button type="button" class="user__logout" onclick={onLogout}>Sign out</button>
						{/if}
					</div>
				{/if}
			</div>
		</header>

		{#if navigating.to}
			<div class="progress" role="status" aria-label="Loading page"></div>
		{/if}

		<div class="content">
			{#key page.url.pathname}
				<div class="content__inner">
					{@render children()}
				</div>
			{/key}
		</div>
	</div>

	{#if mobileOpen}
		<button
			type="button"
			class="backdrop"
			aria-label="Close navigation"
			onclick={() => (mobileOpen = false)}
		></button>
	{/if}
</div>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	:global(body:has(.shell)) {
		background: #f6f7f9;
	}

	.shell {
		display: grid;
		grid-template-columns: 240px 1fr;
		min-height: 100svh;
		background: #f6f7f9;
		color: #111;
		font-family: $font-family-base;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
		}
	}

	.sidebar {
		grid-column: 1;
		background: #fff;
		border-right: 1px solid #e6e8ec;
		display: flex;
		flex-direction: column;
		padding: 20px 18px;
		gap: 24px;
		position: sticky;
		top: 0;
		height: 100svh;

		@include breakpoint-down($bp-md) {
			position: fixed;
			top: 0;
			left: 0;
			width: 260px;
			z-index: 50;
			transform: translateX(-100%);
			transition: transform 0.22s ease;
			box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
		}

		&--open {
			@include breakpoint-down($bp-md) {
				transform: translateX(0);
			}
		}
	}

	.brand {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-bottom: 16px;
		border-bottom: 1px solid #eef0f3;
	}

	.brand__logo {
		font-family: $font-family-serif;
		font-weight: $font-weight-bold;
		font-size: 18px;
		color: #111;
		text-decoration: none;
		letter-spacing: -0.01em;
	}

	.brand__role {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.brand__role-title {
		font-size: 11px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #555;
	}

	.brand__role-sub {
		font-size: 12px;
		color: #888;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.nav__link {
		display: block;
		padding: 8px 10px;
		font-size: 13px;
		font-weight: $font-weight-medium;
		color: #444;
		text-decoration: none;
		border-radius: 6px;
		transition: background 0.12s ease, color 0.12s ease;

		&:hover {
			background: #f1f3f5;
			color: #111;
		}

		&--active {
			background: #111;
			color: #fff;

			&:hover {
				background: #111;
				color: #fff;
			}
		}
	}

	.nav__sep {
		margin: 10px 4px;
		border: 0;
		border-top: 1px solid #eef0f3;
	}

	.sidebar__foot {
		padding-top: 16px;
		border-top: 1px solid #eef0f3;
	}

	.foot-link {
		font-size: 12px;
		color: #666;
		text-decoration: none;

		&:hover {
			color: #111;
		}
	}

	.main {
		grid-column: 2;
		display: flex;
		flex-direction: column;
		min-width: 0;

		@include breakpoint-down($bp-md) {
			grid-column: 1;
		}
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 18px 32px;
		background: #fff;
		border-bottom: 1px solid #e6e8ec;
		position: sticky;
		top: 0;
		z-index: 5;

		@include breakpoint-down($bp-md) {
			padding: 14px 18px;
		}
	}

	.hamburger {
		display: none;
		flex-direction: column;
		gap: 4px;
		width: 32px;
		height: 32px;
		padding: 6px;
		background: transparent;
		border: 1px solid #e6e8ec;
		border-radius: 6px;
		cursor: pointer;

		span {
			display: block;
			width: 100%;
			height: 1.5px;
			background: #111;
		}

		@include breakpoint-down($bp-md) {
			display: flex;
		}
	}

	.topbar__title {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.topbar__eyebrow {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #888;
	}

	.topbar h1 {
		margin: 0;
		font-size: 18px;
		font-weight: $font-weight-semibold;
		letter-spacing: -0.01em;
		color: #111;
		font-family: $font-family-base;
	}

	.topbar__right {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.user {
		display: flex;
		align-items: center;
		gap: 10px;

		@include breakpoint-down($bp-sm) {
			gap: 6px;
		}
	}

	.user__label {
		font-size: 12px;
		color: #555;
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		@include breakpoint-down($bp-sm) {
			display: none;
		}
	}

	.user__logout {
		padding: 6px 12px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid #d8dbe0;
		border-radius: 6px;
		cursor: pointer;

		&:hover {
			background: #f3f4f6;
		}
	}

	// Server loads take a couple of hundred milliseconds, during which SvelteKit
	// keeps the previous screen on show. This bar is what tells the reader the
	// click registered, rather than leaving the old page looking unresponsive.
	.progress {
		position: relative;
		height: 2px;
		overflow: hidden;
		background: #eef0f3;

		&::after {
			content: '';
			position: absolute;
			inset: 0;
			width: 40%;
			background: #111;
			animation: progress-slide 0.9s ease-in-out infinite;
		}
	}

	@keyframes progress-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(350%);
		}
	}

	.content__inner {
		animation: content-in 0.18s ease-out;
	}

	@keyframes content-in {
		from {
			opacity: 0;
			transform: translateY(3px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress::after {
			animation: none;
			width: 100%;
			opacity: 0.35;
		}

		.content__inner {
			animation: none;
		}
	}

	.content {
		flex: 1;
		padding: 28px 32px 48px;
		max-width: 1200px;
		width: 100%;

		@include breakpoint-down($bp-md) {
			padding: 22px 18px 40px;
		}
	}

	.backdrop {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.32);
		border: 0;
		z-index: 40;
		cursor: pointer;

		@include breakpoint-down($bp-md) {
			display: block;
		}
	}
</style>
