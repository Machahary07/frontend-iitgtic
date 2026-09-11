<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, goto } from '$app/navigation';
	import type { User } from '@supabase/supabase-js';
	import LinkReveal from './LinkReveal.svelte';
	import ButtonReveal from './ButtonReveal.svelte';
	import { loadGsap } from '$lib/utils/animation';
	import { images } from '$lib/data/images';
	import { getContent } from '$lib/content';
	import { supabase } from '$lib/supabaseClient';
	import { clearUserSession } from '$lib/utils/userSession';

	const content = getContent();

	// Reflect the signed-in founder/company in the profile menu.
	let account = $state<{ name: string } | null>(null);

	function readAccount(user: User | null | undefined): { name: string } | null {
		if (!user) return null;
		return { name: (user.user_metadata?.full_name as string) || user.email || 'Account' };
	}

	async function refreshAccount() {
		const { data } = await supabase.auth.getSession();
		account = readAccount(data.session?.user);
	}

	// The nav persists across client-side navigation, so reading the session only
	// once at mount leaves the menu stuck on "Login / Sign up" if that first read
	// raced session restore — an already-signed-in user navigating around fires no
	// new auth event to correct it. Re-reading after every navigation (afterNavigate
	// also runs on the initial load) keeps the menu honest on every page.
	afterNavigate(() => {
		void refreshAccount();
	});

	onMount(() => {
		void refreshAccount();
		// Live updates for a login / logout that happens without a navigation.
		const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
			account = readAccount(session?.user);
		});
		return () => authSub.subscription.unsubscribe();
	});

	async function signOut() {
		profileOpen = false;
		closeMobileMenu();
		await clearUserSession();
		account = null;
		goto(resolve('/'));
	}

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

	// Profile dropdown — Login / Sign up. Opens on hover and toggles on click,
	// matching the rest of the nav's dropdown behaviour.
	let profileOpen = $state(false);
	let profileTimer: ReturnType<typeof setTimeout> | undefined;
	function openProfile() {
		if (profileTimer) clearTimeout(profileTimer);
		profileOpen = true;
	}
	function scheduleCloseProfile() {
		if (profileTimer) clearTimeout(profileTimer);
		profileTimer = setTimeout(() => (profileOpen = false), 150);
	}
	function toggleProfile() {
		profileOpen = !profileOpen;
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

<!-- Layer 3: Apply + profile — desktop only -->
<div class="nav-actions">
	<LinkReveal href="/apply" text={content.nav.applyLabel} class="nav-apply" />
	<!-- Hover is a mouse-only convenience; the button below is the accessible control. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="nav-profile"
		onmouseenter={openProfile}
		onmouseleave={scheduleCloseProfile}
	>
		<button
			type="button"
			class="nav-profile-btn"
			class:open={profileOpen}
			aria-haspopup="menu"
			aria-expanded={profileOpen}
			aria-label="Account menu"
			onclick={toggleProfile}
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="8" r="4" />
				<path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
			</svg>
		</button>
		{#if profileOpen}
			<div class="profile-menu" role="menu">
				{#if account}
					<div class="profile-id">
						<span class="profile-id__name">{account.name}</span>
						<span class="profile-id__status"><span class="profile-id__dot" aria-hidden="true"></span>Logged in</span>
					</div>
					<LinkReveal href="/account" text="Your account" class="profile-item" role="menuitem" />
					<ButtonReveal text="Sign out" class="profile-item profile-signout" onclick={signOut} />
				{:else}
					<LinkReveal href="/login" text="Login" class="profile-item" role="menuitem" />
					<LinkReveal href="/apply" text="Sign up" class="profile-item" role="menuitem" />
				{/if}
			</div>
		{/if}
	</div>
</div>

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

		<!-- Account actions — the desktop profile button is hidden on mobile. -->
		{#if account}
			<div class="mobile-item mobile-id">
				<span class="mobile-id__name">{account.name}</span>
				<span class="mobile-id__status">(logged in)</span>
			</div>
			<div class="mobile-item">
				<LinkReveal href="/account" text="Your account" class="mobile-link" onclick={closeMobileMenu} />
			</div>
			<div class="mobile-item">
				<ButtonReveal text="Sign out" class="mobile-link mobile-signout" onclick={signOut} />
			</div>
		{:else}
			<div class="mobile-item">
				<LinkReveal href="/login" text="Login" class="mobile-link" onclick={closeMobileMenu} />
			</div>
			<div class="mobile-item">
				<LinkReveal href="/apply" text="Sign up" class="mobile-link" onclick={closeMobileMenu} />
			</div>
		{/if}
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

	.nav-actions {
		position: fixed;
		top: calc(var(--event-bar-offset, var(--event-bar-height, 40px)) + ($nav-height - 36px) / 2);
		right: $nav-cluster-gap;
		display: flex;
		align-items: center;
		gap: $space-3;
		z-index: $z-dropdown;
		transition: top $transition-base;

		@media (max-width: 1023px) {
			right: $nav-cluster-gap-tablet;
		}

		@media (max-width: 767px) {
			display: none;
		}
	}

	:global(.nav-apply) {
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

		@media (max-width: 1023px) {
			padding: $space-2 $space-4;
		}
	}

	.nav-profile {
		position: relative;
		display: flex;
		align-items: center;
	}

	.nav-profile-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid $color-black;
		background: $color-white;
		color: $color-black;
		cursor: pointer;
		padding: 0;
		transition: background-color $transition-base, color $transition-base;

		// Open-state fill, matching the hamburger's open treatment. No hover swap.
		&.open {
			background: $color-black;
			color: $color-white;
		}
	}

	.profile-menu {
		position: absolute;
		top: calc(100% + #{$space-1});
		right: 0;
		min-width: 168px;
		background: $color-white;
		border: 1px solid $color-border;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba($color-black, 0.1), 0 2px 6px rgba($color-black, 0.05);
		padding: $space-1;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	:global(.profile-item) {
		display: block;
		padding: 6px $space-3;
		border-radius: 8px;
		font-size: $font-size-base;
		font-weight: $font-weight-regular;
		color: $color-fg;
		white-space: nowrap;
		pointer-events: auto;
	}

	.profile-id {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px $space-3 $space-2;
		margin-bottom: $space-1;
		border-bottom: 1px solid $color-subtle;
	}

	.profile-id__name {
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		color: $color-fg;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 220px;
	}

	.profile-id__status {
		display: inline-flex;
		align-items: center;
		gap: $space-1;
		font-size: $font-size-xs;
		font-weight: $font-weight-medium;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: $color-muted;
	}

	.profile-id__dot {
		width: 6px;
		height: 6px;
		border-radius: $radius-circle;
		background: $color-primary-green;
	}

	:global(.profile-signout) {
		text-align: left;
		margin-top: $space-1;
		padding-top: calc(6px + #{$space-1});
		border-top: 1px solid $color-subtle;
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

	.mobile-id {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: $space-4 0;
	}

	.mobile-id__name {
		font-size: $font-size-md;
		font-weight: $font-weight-semibold;
		color: $color-white;
	}

	.mobile-id__status {
		font-size: $font-size-sm;
		color: rgba($color-white, 0.6);
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
