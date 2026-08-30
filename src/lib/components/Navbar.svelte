<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import LinkReveal from './LinkReveal.svelte';
	import { loadGsap } from '$lib/utils/animation';
	import { images } from '$lib/data/images';
	import { getContent } from '$lib/content';

	const content = getContent();

	type RouteHref = Parameters<typeof resolve>[0];
	type DropdownItem = { label: string; href: RouteHref };
	type NavLink = { label: string; href: RouteHref; dropdown?: DropdownItem[] };

	const leftLinks: NavLink[] = content.nav.leftLinks as NavLink[];
	const rightLinks: NavLink[] = content.nav.rightLinks as NavLink[];
	const allLinks: NavLink[] = [...leftLinks, ...rightLinks];
	const firstDropdownLabel = allLinks.find((l) => l.dropdown)?.label ?? null;

	// Desktop dropdown
	let openDropdown = $state<string | null>(null);
	let leaveTimer: ReturnType<typeof setTimeout> | undefined;

	function openMenu(label: string) {
		if (leaveTimer) clearTimeout(leaveTimer);
		openDropdown = label;
	}
	function scheduleClose() {
		if (leaveTimer) clearTimeout(leaveTimer);
		leaveTimer = setTimeout(() => (openDropdown = null), 150);
	}

	// Mobile menu
	let mobileOpen = $state(false);
	let openAccordion = $state<string | null>(null);

	const findSubmenu = (label: string) =>
		document.querySelector<HTMLElement>(`[data-submenu="${CSS.escape(label)}"]`);

	async function animateSubmenuOpen(label: string) {
		const el = findSubmenu(label);
		if (!el) return;
		const { gsap } = await loadGsap();
		gsap.set(el, { height: 'auto' });
		const target = el.offsetHeight;
		gsap.fromTo(
			el,
			{ height: 0 },
			{
				height: target,
				duration: 0.35,
				ease: 'power2.inOut',
				onComplete: () => {
					el.style.height = 'auto';
				}
			}
		);
	}

	async function animateSubmenuClose(label: string) {
		const el = findSubmenu(label);
		if (!el) return;
		const { gsap } = await loadGsap();
		gsap.set(el, { height: el.offsetHeight });
		gsap.to(el, { height: 0, duration: 0.35, ease: 'power2.inOut' });
	}

	function toggleAccordion(label: string) {
		const prev = openAccordion;
		const willOpen = prev !== label;
		if (prev && prev !== label) animateSubmenuClose(prev);
		if (willOpen) {
			openAccordion = label;
			animateSubmenuOpen(label);
		} else {
			openAccordion = null;
			animateSubmenuClose(label);
		}
	}

	async function openMobileMenu() {
		mobileOpen = true;
		if (firstDropdownLabel && openAccordion !== firstDropdownLabel) {
			openAccordion = firstDropdownLabel;
			await tick();
			animateSubmenuOpen(firstDropdownLabel);
		}
	}

	function toggleMobileMenu() {
		if (mobileOpen) closeMobileMenu();
		else openMobileMenu();
	}

	function closeMobileMenu() {
		if (openAccordion) {
			const el = findSubmenu(openAccordion);
			if (el) el.style.height = '0px';
		}
		openAccordion = null;
		mobileOpen = false;
	}
</script>

<!-- Background bar -->
<div class="nav-bg" aria-hidden="true"></div>

<!-- Layer 1: visible links — desktop only -->
<nav class="nav-links" aria-label="Primary">
	<ul class="nav-group">
		{#each leftLinks as link (link.href)}
			<li
				class="nav-item"
				onmouseenter={() => link.dropdown && openMenu(link.label)}
				onmouseleave={() => link.dropdown && scheduleClose()}
			>
				<LinkReveal href={link.href} text={link.dropdown ? link.label + ' ▾' : link.label} class="nav-link" />
			</li>
		{/each}
	</ul>

	<span class="nav-spacer" aria-hidden="true"></span>

	<div class="nav-right">
		<ul class="nav-group">
			{#each rightLinks as link (link.label)}
				<li class="nav-item">
					<LinkReveal href={link.href} text={link.label} class="nav-link" />
				</li>
			{/each}
		</ul>
	</div>
</nav>

<!-- Layer 2: dropdowns — desktop only -->
<div class="nav-dropdowns" aria-hidden="true">
	<ul class="nav-group">
		{#each leftLinks as link (link.href)}
			<li class="dropdown-slot">
				<span class="dropdown-ghost">{link.dropdown ? link.label + ' ▾' : link.label}</span>
				{#if link.dropdown && openDropdown === link.label}
					<div
						class="dropdown"
						role="menu"
						tabindex="-1"
						onmouseenter={() => openMenu(link.label)}
						onmouseleave={scheduleClose}
					>
						{#each link.dropdown ?? [] as item (item.label)}
							<LinkReveal href={item.href} text={item.label} class="dropdown-item" role="menuitem" />
						{/each}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<span class="nav-spacer" aria-hidden="true"></span>

	<div class="nav-right">
		<ul class="nav-group">
			{#each rightLinks as link (link.label)}
				<li class="dropdown-slot">
					<span class="dropdown-ghost">{link.label}</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<!-- Layer 3: Apply button — desktop only -->
<LinkReveal href="/apply" text={content.nav.applyLabel} class="nav-apply" />

<!-- Layer 3: logo -->
<a href={resolve('/')} class="nav-logo" aria-label={content.nav.logoAlt}>
	<img
		src={images.logo}
		alt=""
		width="32"
		height="32"
		decoding="async"
		fetchpriority="high"
	/>
</a>

<!-- Hamburger button — mobile only -->
<button
	class="nav-hamburger"
	aria-label="Toggle menu"
	aria-expanded={mobileOpen}
	onclick={toggleMobileMenu}
>
	<span class="bar bar-1" class:open={mobileOpen}></span>
	<span class="bar bar-2" class:open={mobileOpen}></span>
</button>

<!-- Mobile menu panel -->
<div class="mobile-menu" class:open={mobileOpen} aria-hidden={!mobileOpen}>
	<nav>
		{#each allLinks as link (link.label)}
			<div class="mobile-item">
				{#if link.dropdown}
					<div class="mobile-row">
						<LinkReveal
							href={link.href}
							text={link.label}
							class="mobile-link"
							onclick={closeMobileMenu}
						/>
						<button
							class="mobile-toggle"
							aria-label={`Toggle ${link.label} submenu`}
							aria-expanded={openAccordion === link.label}
							onclick={() => toggleAccordion(link.label)}
						>
							<span class="mobile-chevron" class:rotated={openAccordion === link.label}>▾</span>
						</button>
					</div>
					<div class="mobile-submenu" data-submenu={link.label}>
						{#each link.dropdown as item (item.label)}
							<LinkReveal
								href={item.href}
								text={item.label}
								class="mobile-sublink"
								onclick={closeMobileMenu}
							/>
						{/each}
					</div>
				{:else}
					<LinkReveal
						href={link.href}
						text={link.label}
						class="mobile-link"
						onclick={closeMobileMenu}
					/>
				{/if}
			</div>
		{/each}
	</nav>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	$nav-height: 64px;
	$nav-logo-size: 32px;
	$nav-cluster-gap: $space-8;
	$nav-link-gap: $space-8;
	$nav-cluster-gap-tablet: $space-4;
	$nav-link-gap-tablet: $space-4;

	// Shared positioning/layout for both link + dropdown layers.
	%nav-row {
		position: fixed;
		top: var(--event-bar-offset, var(--event-bar-height, 40px));
		left: 50%;
		transform: translateX(-50%);
		height: $nav-height;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: $nav-cluster-gap;
		z-index: $z-dropdown;
		transition: top $transition-base;

		@media (max-width: 1023px) {
			gap: $nav-cluster-gap-tablet;
		}
	}

	.nav-bg {
		position: fixed;
		top: var(--event-bar-offset, var(--event-bar-height, 40px));
		left: 0;
		right: 0;
		height: $nav-height;
		background: $color-white;
		z-index: $z-dropdown;
		transition: top $transition-base;
	}

	.nav-links {
		@extend %nav-row;
		pointer-events: none;

		@media (max-width: 767px) {
			display: none;
		}
	}

	.nav-dropdowns {
		@extend %nav-row;
		pointer-events: none;

		@media (max-width: 767px) {
			display: none;
		}
	}

	.nav-group {
		display: flex;
		align-items: center;
		gap: $nav-link-gap;
		list-style: none;
		margin: 0;
		padding: 0;

		@media (max-width: 1023px) {
			gap: $nav-link-gap-tablet;
		}

		&:first-child {
			justify-content: flex-end;
		}
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: $nav-cluster-gap;
		justify-content: flex-start;

		@media (max-width: 1023px) {
			gap: $nav-cluster-gap-tablet;
		}
	}

	.nav-spacer {
		display: inline-block;
		width: $nav-logo-size;
	}

	.nav-item {
		position: relative;
	}

	%nav-trigger {
		font-size: $font-size-base;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-normal;
		white-space: nowrap;
		line-height: 1;
	}

	:global(.nav-link) {
		@extend %nav-trigger;
		color: $color-black;
		pointer-events: auto;
	}

	.dropdown-slot {
		position: relative;
	}

	.dropdown-ghost {
		@extend %nav-trigger;
		visibility: hidden;
	}

	:global(.nav-apply) {
		position: fixed;
		top: calc(var(--event-bar-offset, var(--event-bar-height, 40px)) + ($nav-height - 2rem) / 2);
		right: $nav-cluster-gap;
		display: inline-flex;
		align-items: center;
		padding: $space-2 $space-6;
		background-color: $color-black;
		color: $color-white;
		border-radius: $radius-pill;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		font-style: italic;
		white-space: nowrap;
		z-index: $z-dropdown;
		transition: top $transition-base;

		@media (max-width: 1023px) {
			right: $nav-cluster-gap-tablet;
			padding: $space-2 $space-4;
		}

		@media (max-width: 767px) {
			display: none !important;
		}
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: $space-3;
		min-width: 220px;
		background: $color-white;
		color: $color-fg;
		box-shadow: $shadow-md;
		padding: $space-2;
		display: flex;
		flex-direction: column;
		pointer-events: auto;
	}

	:global(.dropdown-item) {
		display: block;
		padding: $space-2 $space-3;
		font-size: $font-size-base;
		font-weight: $font-weight-regular;
		color: $color-fg;
		white-space: nowrap;
	}

	.nav-logo {
		position: fixed;
		top: var(--event-bar-offset, var(--event-bar-height, 40px));
		left: 50%;
		transform: translateX(-50%);
		height: $nav-height;
		display: flex;
		align-items: center;
		z-index: $z-dropdown;
		transition: top $transition-base, opacity $transition-fast;

		img {
			display: block;
			width: $nav-logo-size;
			height: $nav-logo-size;
			object-fit: contain;
		}

	}

	// ── Hamburger ─────────────────────────────────────────────
	.nav-hamburger {
		display: none;
		position: fixed;
		top: var(--event-bar-offset, var(--event-bar-height, 40px));
		right: $space-4;
		height: $nav-height;
		width: 32px;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		cursor: pointer;
		z-index: $z-dropdown + 3;
		padding: 0;
		transition: top $transition-base;

		@media (max-width: 767px) {
			display: flex;
		}
	}

	.bar {
		display: block;
		width: 22px;
		height: 1.5px;
		background: $color-black;
		transform-origin: center;
		transition: transform $transition-base, background-color $transition-base;
	}

	.bar-1.open {
		transform: translateY(3.25px) rotate(45deg);
		background: $color-white;
	}
	.bar-2.open {
		transform: translateY(-3.25px) rotate(-45deg);
		background: $color-white;
	}

	// ── Mobile menu panel ──────────────────────────────────────
	$mobile-menu-origin-x: calc(100% - #{$space-4} - 11px);
	$mobile-menu-origin-y: calc(var(--event-bar-offset, var(--event-bar-height, 40px)) + #{$nav-height} / 2);

	.mobile-menu {
		display: none;

		@media (max-width: 767px) {
			display: block;
			position: fixed;
			inset: 0;
			background: $color-black;
			color: $color-white;
			overflow-y: auto;
			z-index: $z-dropdown + 2;
			clip-path: circle(0% at #{$mobile-menu-origin-x} #{$mobile-menu-origin-y});
			pointer-events: none;
			transition: clip-path 0.6s cubic-bezier(0.77, 0, 0.18, 1);

			&.open {
				clip-path: circle(150% at #{$mobile-menu-origin-x} #{$mobile-menu-origin-y});
				pointer-events: auto;
			}
		}
	}

	.mobile-menu nav {
		display: flex;
		flex-direction: column;
		padding: calc(var(--event-bar-offset, var(--event-bar-height, 40px)) + #{$nav-height} + #{$space-4}) $space-5 $space-6;
	}

	.mobile-item {
		border-bottom: 1px solid rgba($color-white, 0.12);
	}

	:global(.mobile-link) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: $space-4 0;
		font-size: $font-size-md;
		font-weight: $font-weight-regular;
		color: $color-white;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		text-decoration: none;
	}

	.mobile-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-3;

		:global(.mobile-link) {
			flex: 1;
			min-width: 0;
		}
	}

	.mobile-toggle {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		margin-right: -#{$space-2};
		background: none;
		border: none;
		color: $color-white;
		cursor: pointer;
		padding: 0;
	}

	.mobile-chevron {
		font-size: $font-size-xl;
		line-height: 1;
		transition: transform $transition-base;

		&.rotated {
			transform: rotate(180deg);
		}
	}

	.mobile-submenu {
		display: flex;
		flex-direction: column;
		padding-bottom: $space-2;
		height: 0;
		overflow: hidden;
		will-change: height;
	}

	:global(.mobile-sublink) {
		display: block;
		padding: $space-2 $space-3;
		font-size: $font-size-base;
		color: $color-white;
		text-decoration: none;
	}
</style>
