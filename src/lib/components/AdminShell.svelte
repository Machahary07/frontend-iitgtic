<script lang="ts">
	import { navigating, page } from '$app/state';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Scanner from '$lib/components/Scanner.svelte';
	import ViewAsControl from '$lib/components/ViewAsControl.svelte';
	import { images } from '$lib/data/images';
	import { assistantPanel } from '$lib/utils/assistantPanel.svelte';
	import { sectionForPage } from '$lib/utils/roles';
	import type { NavItem, NavLink } from '$lib/utils/adminNavTypes';

	interface Props {
		brand: string;
		brandSub?: string;
		/** Opts the console into the assistant sparkle beside the logo. It opens
		 *  the docked side panel when the layout has mounted one, and is a plain
		 *  link to this address otherwise. */
		assistantHref?: string;
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
		assistantHref = '',
		navItems: allNavItems,
		title,
		eyebrow = '',
		user = null,
		onLogout,
		children,
		actions
	}: Props = $props();

	let mobileOpen = $state(false);

	// The sections this person's role may open, sent by the /tic-admin layout.
	// Absent (the founder console), every item shows. Separators that would end
	// up leading, trailing or doubled once items drop out go with them.
	const navItems = $derived.by(() => {
		const access = page.data.access as string[] | undefined;
		if (!access) return allNavItems;
		const kept = allNavItems.filter((item) => {
			if ('separator' in item) return true;
			const section = sectionForPage(item.href);
			return !section || access.includes(section);
		});
		return kept.filter((item, i) => {
			if (!('separator' in item)) return true;
			const prev = kept[i - 1];
			return Boolean(prev) && !('separator' in prev) && i < kept.length - 1;
		});
	});

	// The sparkle toggles the side panel wherever the layout provides one.
	const panelSpark = $derived(Boolean(assistantHref) && assistantPanel.available);

	// Two separate things: below the sidebar breakpoint the sidebar is a drawer
	// that slides over the page (`mobileOpen`), and above it the sidebar is a
	// column that narrows to an icon rail (`collapsed`). Collapsing is a per-person
	// preference, so it is remembered; the drawer always starts shut.
	const COLLAPSE_KEY = 'tic-admin:sidebar-collapsed';

	function readCollapsed() {
		if (!browser) return false;
		// Private windows and blocked site data throw on access rather than
		// returning null, so a failed read just means "use the default".
		try {
			return localStorage.getItem(COLLAPSE_KEY) === '1';
		} catch {
			return false;
		}
	}

	let collapsed = $state(readCollapsed());
	// The panel borrows the sidebar's width on a screen too narrow for both,
	// without touching the saved preference — closing it puts the sidebar back.
	const railCollapsed = $derived(collapsed || assistantPanel.borrowsRail);

	// Goes by what is on screen, not the saved preference: a rail folded for the
	// assistant reads as closed, and opening it puts the assistant away.
	function toggleCollapsed() {
		const expand = railCollapsed;
		if (expand) assistantPanel.close();
		collapsed = !expand;
		try {
			localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
		} catch {
			// Not being able to remember the choice is not a reason to refuse it.
		}
	}

	// A section owns everything beneath it — /tic-admin/content is the parent of
	// /tic-admin/content/pages.team. The root entry is the exception: it is a page
	// sitting at the console root, not a section above every other one, so it
	// matches its own path and nothing else. Without that, a page absent from the
	// nav inherited the root as its parent and read "Admin › Overview › Assistant".
	const activeHref = $derived.by(() => {
		const path = page.url.pathname;
		const root = navItems.find((item): item is NavLink => !('separator' in item))?.href;
		let best = '';
		for (const item of navItems) {
			if ('separator' in item) continue;
			const owns = item.href !== root && path.startsWith(item.href + '/');
			if (path === item.href || owns) {
				if (item.href.length > best.length) best = item.href;
			}
		}
		return best;
	});

	const activeItem = $derived(
		navItems.find((item) => !('separator' in item) && item.href === activeHref) ?? null
	);

	const homeItem = $derived(navItems.find((item) => !('separator' in item)) ?? null);

	// The breadcrumb is what tells the reader which layer they are standing on:
	// root section → nav section → this screen. Entries that would repeat the one
	// before them are dropped so a top-level page reads "Admin › Overview", not
	// "Admin › Overview › Overview".
	const crumbs = $derived.by(() => {
		const trail: { label: string; href?: string }[] = [];
		if (homeItem && !('separator' in homeItem)) {
			trail.push({ label: brand, href: homeItem.href });
		}
		if (activeItem && !('separator' in activeItem) && activeItem.label !== title) {
			trail.push({ label: activeItem.label, href: activeItem.href });
		}
		trail.push({ label: title });
		return trail;
	});

	// Moving to another page. SvelteKit keeps the old page on screen until the
	// new one's data has arrived, which reads as the click not having landed. So
	// the new page's title and a skeleton go up at once, and its real content
	// replaces them the moment it is ready. A short grace period first, so a
	// page that was already preloaded on hover never flashes a skeleton.
	const pendingPath = $derived.by(() => {
		const to = navigating.to?.url;
		if (!to || to.pathname === page.url.pathname) return null;
		return to.pathname;
	});

	let showSkeleton = $state(false);
	$effect(() => {
		if (!pendingPath) {
			showSkeleton = false;
			return;
		}
		const timer = setTimeout(() => (showSkeleton = true), 90);
		return () => clearTimeout(timer);
	});

	// The nav entry that owns the page being opened, for the skeleton's title.
	const pendingTitle = $derived.by(() => {
		if (!pendingPath) return '';
		let best: NavLink | null = null;
		for (const item of allNavItems) {
			if ('separator' in item) continue;
			if (pendingPath === item.href || pendingPath.startsWith(item.href + '/')) {
				if (!best || item.href.length > best.href.length) best = item;
			}
		}
		return best?.label ?? '';
	});

	const userInitial = $derived((user ?? '').trim().charAt(0).toUpperCase() || '?');

	// The clock is client-only: rendering server time would hydrate to whatever
	// hour the server sits in, and then jump. It stays null until mounted.
	let now = $state<Date | null>(null);

	// Each tick lands on the next half-second boundary rather than half a second
	// after the last one, so the seconds digit and the blinking colon both turn
	// over with the real clock instead of drifting off it.
	$effect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const tick = () => {
			now = new Date();
			timer = setTimeout(tick, 500 - (Date.now() % 500));
		};
		tick();
		return () => clearTimeout(timer);
	});

	// Seven bands rather than the usual three, because "Good morning" at 00:59 is
	// plainly wrong to whoever is reading it at 00:59. `from` is the first hour of
	// the band; the last one runs to midnight.
	const GREETINGS: { from: number; lines: string[] }[] = [
		{
			from: 0,
			lines: [
				'Hey, night owl',
				'Burning the midnight oil',
				'The quiet hours are yours',
				'Still up? Respect',
				'Just you and the cursor'
			]
		},
		{
			from: 5,
			lines: [
				'Up before the sun',
				'Early bird hours',
				'First light, first edit',
				'Dawn patrol',
				'Beating the sunrise'
			]
		},
		{
			from: 7,
			lines: [
				'Good morning',
				'Morning! Kettle on?',
				'Fresh page, fresh day',
				'Rise and shine',
				'Top of the morning'
			]
		},
		{
			from: 12,
			lines: [
				'Good afternoon',
				"Lunch o'clock",
				'Midday checkpoint',
				'Halfway through the day',
				'Fed and back at it?'
			]
		},
		{
			from: 14,
			lines: [
				'Good afternoon',
				'Afternoon stretch',
				'The post-lunch push',
				"Chai o'clock",
				'Second wind time'
			]
		},
		{
			from: 17,
			lines: [
				'Good evening',
				'Golden hour',
				'Evening shift',
				'Winding down?',
				'Nearly clocking off?'
			]
		},
		{
			from: 21,
			lines: [
				'Good night — still at it?',
				'Late shift',
				'The building is asleep',
				'One last thing before bed?',
				'Owl mode'
			]
		}
	];

	// The line is picked by the date rather than at random, so it holds still while
	// someone moves around the console and turns over the next day instead.
	const greeting = $derived.by(() => {
		if (!now) return '';
		const hour = now.getHours();
		let band = GREETINGS[0];
		for (const candidate of GREETINGS) {
			if (hour >= candidate.from) band = candidate;
		}
		const rotation = now.getDate() + now.getMonth() + band.from;
		return band.lines[rotation % band.lines.length];
	});

	// The colon is its own element so it can blink, and everything after it is one
	// string: a line break between separate spans would render as a space and put
	// a gap in the middle of the clock.
	const clock = $derived.by(() => {
		if (!now) return null;
		const pad = (value: number) => String(value).padStart(2, '0');
		const hours = now.getHours();
		return {
			hour: pad(hours % 12 || 12),
			minute: pad(now.getMinutes()),
			rest: `${pad(now.getSeconds())} ${hours < 12 ? 'AM' : 'PM'}`,
			// On for the first half of every second, off for the second half.
			colonLit: now.getMilliseconds() < 500
		};
	});

	const today = $derived(
		now ? now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
	);

	function toneVars(item: NavItem) {
		const tone = 'separator' in item ? 'neutral' : (item.tone ?? 'neutral');
		return `--tile-bg: var(--admin-tone-${tone}-bg); --tile-fg: var(--admin-tone-${tone}-fg);`;
	}
</script>

<div class="shell" class:shell--collapsed={railCollapsed}>
	<!-- Animated ground. Fixed and inert, so it stays put while the page scrolls
	     and never takes a click; the gradient on .shell shows through if WebGL is
	     unavailable, so the admin is never left on a bare white page. -->
	<div class="scanner-bg" aria-hidden="true">
		<Scanner
			color1="#6697D6"
			color2="#71CEA4"
			color3="#FFFFFF"
			speed={0.5}
			sweepSpeed={0.25}
			sweepWidth={1.6}
			sweepFalloff={6}
			scale={1.5}
			frequency={2}
			ripple={0.22}
			bandDensity={11}
			lineSharpness={5.5}
			glow={0.22}
			scanDirection="vertical"
			colorSpread={0.7}
			brightness={1.0}
			contrast={1.15}
			softness={1.4}
			vignette={0.45}
			scanline={true}
			grain={true}
			grainIntensity={0.05}
			opacity={0.5}
			mouseInteraction={true}
			mouseRadius={0.5}
			mouseStrength={0.5}
		/>
	</div>

	<aside class="sidebar" class:sidebar--open={mobileOpen}>
		<div class="brand">
			<a href="/" class="brand__mark" aria-label="IITG TIC home">
				<img src={images.logo} alt="" width="38" height="38" decoding="async" />
			</a>
			<div class="brand__text">
				<span class="brand__name">IITG TIC</span>
				<span class="brand__role">{brand}</span>
			</div>
			{#if brandSub}<span class="brand__tag">{brandSub}</span>{/if}
			{#if panelSpark}
				<button
					type="button"
					class="spark"
					class:spark--active={assistantPanel.open}
					aria-label={assistantPanel.open ? 'Close the assistant' : 'Open the assistant'}
					aria-expanded={assistantPanel.open}
					aria-controls="console-assistant"
					title="Assistant"
					onclick={() => {
						mobileOpen = false;
						assistantPanel.toggle();
					}}
				>
					<Sparkles size={16} strokeWidth={1.9} />
				</button>
			{:else if assistantHref}
				<a
					href={assistantHref}
					class="spark"
					class:spark--active={page.url.pathname === assistantHref}
					aria-label="Assistant"
					aria-current={page.url.pathname === assistantHref ? 'page' : undefined}
					title="Assistant"
					onclick={() => (mobileOpen = false)}
				>
					<Sparkles size={16} strokeWidth={1.9} />
				</a>
			{/if}
		</div>

		<nav class="nav">
			{#each navItems as item, i (i)}
				{#if 'separator' in item}
					<hr class="nav__sep" />
				{:else}
					{@const Icon = item.icon}
					<a
						href={item.href}
						class="nav__link"
						class:nav__link--active={activeHref === item.href}
						style={toneVars(item)}
						aria-current={activeHref === item.href ? 'page' : undefined}
						title={railCollapsed ? item.label : undefined}
						onclick={() => (mobileOpen = false)}
					>
						<span class="nav__icon">
							{#if Icon}<Icon size={16} strokeWidth={1.9} />{/if}
						</span>
						<span class="nav__label">{item.label}</span>
					</a>
				{/if}
			{/each}
		</nav>

		<div class="sidebar__foot">
			<a href="/" class="foot-link" title={railCollapsed ? 'Back to public site' : undefined}>
				<ArrowLeft size={14} strokeWidth={2} />
				<span class="foot-link__label">Back to public site</span>
			</a>
		</div>
	</aside>

	<div class="main">
		<header class="topbar">
			<button
				type="button"
				class="hamburger"
				aria-label="Toggle navigation"
				onclick={() => {
					mobileOpen = !mobileOpen;
					if (mobileOpen) assistantPanel.close();
				}}
			>
				<span></span><span></span><span></span>
			</button>

			<!-- The desktop counterpart to the hamburger. It lives in the topbar
			     rather than on the sidebar so it stays in the same place whether the
			     sidebar is a full column or a narrow rail. -->
			<button
				type="button"
				class="collapse"
				aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				aria-expanded={!railCollapsed}
				title={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onclick={toggleCollapsed}
			>
				{#if railCollapsed}
					<PanelLeftOpen size={17} strokeWidth={1.9} />
				{:else}
					<PanelLeftClose size={17} strokeWidth={1.9} />
				{/if}
			</button>

			<nav class="crumbs" aria-label="Breadcrumb">
				{#each crumbs as crumb, i (crumb.label + i)}
					{#if i > 0}
						<span class="crumbs__sep" aria-hidden="true">
							<ChevronRight size={13} strokeWidth={2} />
						</span>
					{/if}
					{#if crumb.href && i < crumbs.length - 1}
						<a href={crumb.href} class="crumbs__item">{crumb.label}</a>
					{:else}
						<span class="crumbs__item crumbs__item--current" aria-current="page">
							{crumb.label}
						</span>
					{/if}
				{/each}
			</nav>

			<ViewAsControl />

			{#if user}
				{#if greeting}
					<p class="greeting">
						{greeting}
						<span class="greeting__sep greeting__sep--date" aria-hidden="true">·</span>
						<span class="greeting__date">{today}</span>
						<span class="greeting__sep" aria-hidden="true">·</span>
						{#if clock}
							<time class="greeting__time" class:greeting__time--colons-off={!clock.colonLit}
								>{clock.hour}<span class="greeting__colon">:</span>{clock.minute}<span
									class="greeting__colon">:</span
								>{clock.rest}</time
							>
						{/if}
					</p>
				{/if}
				<div class="user">
					<span class="user__avatar" aria-hidden="true">{userInitial}</span>
					<span class="user__label">{user}</span>
					{#if onLogout}
						<button type="button" class="user__logout" onclick={onLogout}>Sign out</button>
					{/if}
				</div>
			{/if}
		</header>

		{#if navigating.to}
			<div class="progress" role="status" aria-label="Loading page"></div>
		{/if}

		<div class="content">
			{#if showSkeleton}
				<div
					class="skeleton"
					role="status"
					aria-live="polite"
					aria-label="Loading {pendingTitle || 'page'}"
				>
					<div class="pagehead">
						<div class="pagehead__text">
							<p class="pagehead__eyebrow skeleton__bar skeleton__bar--eyebrow"></p>
							<h1>{pendingTitle}</h1>
						</div>
					</div>
					<div class="skeleton__tabs">
						<span class="skeleton__bar skeleton__bar--tab"></span>
						<span class="skeleton__bar skeleton__bar--tab"></span>
						<span class="skeleton__bar skeleton__bar--tab"></span>
					</div>
					<div class="skeleton__panel">
						{#each [0, 1, 2, 3, 4, 5] as row (row)}
							<div class="skeleton__row">
								<span class="skeleton__bar skeleton__bar--avatar"></span>
								<span class="skeleton__lines">
									<span class="skeleton__bar skeleton__bar--line"></span>
									<span class="skeleton__bar skeleton__bar--short"></span>
								</span>
								<span class="skeleton__bar skeleton__bar--pill"></span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			<div class="content__page" class:content__page--hidden={showSkeleton}>
				<div class="pagehead">
					<div class="pagehead__text">
						{#if eyebrow}<p class="pagehead__eyebrow">{eyebrow}</p>{/if}
						<h1>{title}</h1>
					</div>
					{#if actions}
						<div class="pagehead__actions">{@render actions()}</div>
					{/if}
				</div>

				{#key page.url.pathname}
					<div class="content__inner">
						{@render children()}
					</div>
				{/key}
			</div>
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
	@use '$styles/admin' as *;

	// The ambient ground: a near-white base lit by three soft colour blooms, so
	// the white panels above it read as floating rather than as flat regions of
	// the same sheet.
	$admin-ground:
		radial-gradient(900px 520px at 10% -8%, #e9ecfa 0%, rgba(233, 236, 250, 0) 62%),
		radial-gradient(820px 470px at 92% -4%, #fceee4 0%, rgba(252, 238, 228, 0) 60%),
		radial-gradient(760px 520px at 82% 100%, #e6f3ec 0%, rgba(230, 243, 236, 0) 58%), $admin-bg;

	:global(body:has(.shell)) {
		background: $admin-bg;
	}

	.shell {
		@include admin-tone-vars;

		// One variable drives the column, the sidebar and everything that has to
		// reflow with it, so collapsing is a single value change.
		--sidebar-w: 256px;

		display: grid;
		grid-template-columns: var(--sidebar-w) 1fr;
		gap: 0;
		min-height: 100svh;
		padding: 14px;
		background: $admin-ground;
		background-attachment: fixed;
		color: $admin-ink;
		font-family: $font-family-base;
		transition: grid-template-columns $transition-base;

		&--collapsed {
			--sidebar-w: 78px;
		}

		@include breakpoint-down($bp-md) {
			// The drawer overlays the page down here, so the column it would have
			// occupied collapses away entirely and the rail width is irrelevant.
			--sidebar-w: 0;
			grid-template-columns: 1fr;
			padding: 0;
		}
	}

	// Fixed rather than absolute so it covers the viewport, not the (taller)
	// document — the shader should not stretch to the length of a long table.
	.scanner-bg {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}

	// ---- Sidebar -------------------------------------------------------------

	.sidebar {
		grid-column: 1;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: 20px 16px;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		position: sticky;
		top: 14px;
		height: calc(100svh - 28px);

		@include breakpoint-down($bp-md) {
			position: fixed;
			top: 0;
			left: 0;
			width: 272px;
			height: 100svh;
			border-radius: 0 $admin-radius-lg $admin-radius-lg 0;
			z-index: 50;
			transform: translateX(-100%);
			transition: transform 0.24s ease;
			box-shadow: $admin-shadow-raised;
		}

		&--open {
			@include breakpoint-down($bp-md) {
				transform: translateX(0);
			}
		}
	}

	// ---- Collapsed rail ------------------------------------------------------
	// Desktop only. The drawer below $bp-md always shows full labels, so every
	// rule here is scoped to the wide layout — a collapsed preference set on a
	// laptop must not produce an icon-only drawer on a phone.
	@include breakpoint-up($bp-md) {
		.shell--collapsed {
			.sidebar {
				padding-inline: 12px;
				align-items: center;
			}

			.brand {
				// Stacked rather than centred in a row: the sparkle has to stay
				// reachable on the rail, and two icons side by side would not fit.
				flex-direction: column;
				justify-content: center;
				gap: 10px;
				padding-inline: 0;
			}

			.spark {
				margin-left: 0;
			}

			// Hidden rather than removed: keeping them in the tree means no reflow
			// of the nav when the labels come back.
			.brand__text,
			.brand__tag,
			.nav__label,
			.foot-link__label {
				display: none;
			}

			.nav {
				width: 100%;
			}

			.nav__link {
				justify-content: center;
				padding: 6px;
			}

			.nav__sep {
				margin-inline: 6px;
			}

			.sidebar__foot {
				width: 100%;
				display: flex;
				justify-content: center;
			}

			.foot-link {
				padding: 6px;
			}
		}
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 2px 6px 18px;
		border-bottom: 1px solid $admin-line-soft;
	}

	// The real mark, so no tinted tile behind it — the logo carries its own
	// colour and a pastel square would read as a second, competing badge.
	.brand__mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 38px;
		height: 38px;
		text-decoration: none;
		@include admin-focus-ring;

		img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	.brand__text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.brand__name {
		font-family: $font-family-serif;
		font-weight: $font-weight-bold;
		font-size: 16px;
		letter-spacing: -0.01em;
		color: $admin-ink;
	}

	.brand__role {
		font-size: 11px;
		color: $admin-ink-3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	// The way into the assistant. It sits with the mark rather than in the nav
	// because it is not another section of the console — it is a way to work the
	// whole of it.
	.spark {
		margin-left: auto;
		padding: 0;
		border: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: $admin-radius-md;
		color: admin-tone-fg('violet');
		background: admin-tone-bg('violet');
		text-decoration: none;
		@include admin-focus-ring;

		&--active {
			color: $color-white;
			background: $admin-ink;
		}
	}

	.brand__tag {
		margin-left: auto;
		padding: 3px 8px;
		font-size: 9px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: $admin-ink-3;
		background: $admin-sunken;
		border-radius: $admin-radius-pill;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.nav__link {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 6px 10px 6px 6px;
		font-size: 13px;
		font-weight: $font-weight-medium;
		color: $admin-ink-2;
		text-decoration: none;
		border-radius: $admin-radius-md;
		@include admin-focus-ring;

		&--active {
			color: $color-white;
			background: $admin-ink;
			font-weight: $font-weight-semibold;
		}
	}

	.nav__icon {
		@include admin-icon-tile('neutral', 30px);
		background: var(--tile-bg);
		color: var(--tile-fg);
		border-radius: $admin-radius-sm;

		.nav__link--active & {
			background: rgba(255, 255, 255, 0.16);
			color: $color-white;
		}
	}

	.nav__label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nav__sep {
		margin: 9px 10px;
		border: 0;
		border-top: 1px solid $admin-line-soft;
	}

	.sidebar__foot {
		padding-top: 16px;
		border-top: 1px solid $admin-line-soft;
	}

	.foot-link {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 0 6px;
		font-size: 12px;
		color: $admin-ink-2;
		text-decoration: none;
		@include admin-focus-ring;
	}

	// ---- Main column ---------------------------------------------------------

	.main {
		grid-column: 2;
		position: relative;
		z-index: 1;
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
		gap: 14px;
		padding: 10px 26px;
		min-height: 58px;

		@include breakpoint-down($bp-md) {
			padding: 12px 16px;
			background: rgba(255, 255, 255, 0.72);
			backdrop-filter: blur(10px);
			border-bottom: 1px solid $admin-line-soft;
			position: sticky;
			top: 0;
			z-index: 5;
		}
	}

	.hamburger {
		display: none;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		width: 36px;
		height: 36px;
		padding: 8px;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		@include admin-focus-ring;

		span {
			display: block;
			width: 100%;
			height: 1.5px;
			background: $admin-ink;
		}

		@include breakpoint-down($bp-md) {
			display: flex;
		}
	}

	// The wide-layout twin of .hamburger: same size and shape, shown exactly
	// where the hamburger is not.
	.collapse {
		display: none;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 36px;
		height: 36px;
		padding: 0;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		@include admin-focus-ring;

		&:active {
			transform: translateY(0.5px);
		}

		@include breakpoint-up($bp-md) {
			display: inline-flex;
		}
	}

	.crumbs {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		overflow: hidden;
	}

	.crumbs__item {
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: $admin-ink-3;
		text-decoration: none;
		white-space: nowrap;
		@include admin-focus-ring;

		&--current {
			font-weight: $font-weight-semibold;
			color: $admin-ink;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	.crumbs__sep {
		display: inline-flex;
		color: rgba(17, 20, 24, 0.25);
	}

	.greeting {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: $admin-ink-3;
		white-space: nowrap;

		@include breakpoint-down($bp-sm) {
			display: none;
		}
	}

	.greeting__sep {
		color: rgba(17, 20, 24, 0.25);
	}

	.greeting__time {
		color: $admin-ink-2;
		font-variant-numeric: tabular-nums;
	}

	// Below the sidebar breakpoint the topbar also carries a hamburger, so the
	// date steps aside — with its separator — leaving the greeting and the clock.
	.greeting__date,
	.greeting__sep--date {
		@include breakpoint-down($bp-md) {
			display: none;
		}
	}

	.greeting__date {
		color: $admin-ink-2;
	}

	.greeting__colon {
		// Fading rather than hiding: display:none would collapse the character and
		// shuffle the digits sideways twice a second. Both colons are driven from
		// the one class on the clock so they cannot fall out of step with it.
		opacity: 1;
		transition: opacity 0.12s linear;
	}

	.greeting__time--colons-off .greeting__colon {
		opacity: 0;
	}

	.user {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 5px 6px 5px 5px;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
		box-shadow: $admin-shadow-card;
	}

	.user__avatar {
		@include admin-icon-tile('info', 28px);
		border-radius: $admin-radius-pill;
		font-size: 12px;
		font-weight: $font-weight-bold;
	}

	.user__label {
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: $admin-ink-2;
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		@include breakpoint-down($bp-sm) {
			display: none;
		}
	}

	.user__logout {
		padding: 6px 13px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $color-white;
		background: $admin-ink;
		border: 0;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:active {
			transform: translateY(0.5px);
		}
	}

	// Server loads take a couple of hundred milliseconds, during which SvelteKit
	// keeps the previous screen on show. This bar is what tells the reader the
	// click registered, rather than leaving the old page looking unresponsive.
	.progress {
		position: relative;
		height: 2px;
		margin: 0 26px;
		overflow: hidden;
		border-radius: $admin-radius-pill;
		background: rgba(17, 20, 24, 0.07);

		&::after {
			content: '';
			position: absolute;
			inset: 0;
			width: 40%;
			background: $admin-ink;
			animation: progress-slide 0.9s ease-in-out infinite;
		}

		@include breakpoint-down($bp-md) {
			margin: 0 16px;
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

	.content {
		flex: 1;
		padding: 8px 26px 48px;
		max-width: 1280px;
		width: 100%;

		@include breakpoint-down($bp-md) {
			padding: 16px 16px 40px;
		}
	}

	// The page header sits on the ground rather than inside a panel, so the
	// title reads as a label for the layer below it.
	.pagehead {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 18px;
		flex-wrap: wrap;
		margin-bottom: 22px;
	}

	.pagehead__text {
		min-width: 0;
	}

	.pagehead__eyebrow {
		@include admin-eyebrow;
	}

	.pagehead h1 {
		margin: 0;
		font-size: 30px;
		font-weight: $font-weight-bold;
		letter-spacing: -0.03em;
		line-height: 1.1;
		color: $admin-ink;
		font-family: $font-family-base;

		@include breakpoint-down($bp-sm) {
			font-size: 24px;
		}
	}

	.pagehead__actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.content__inner {
		animation: content-in 0.18s ease-out;
	}

	// Hidden, not removed: the page stays mounted underneath so its state is
	// intact if the navigation is cancelled.
	.content__page--hidden {
		display: none;
	}

	.skeleton {
		animation: content-in 0.12s ease-out;
	}

	.skeleton__tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 18px;
	}

	.skeleton__panel {
		@include admin-panel;
		padding: 8px 22px;
	}

	.skeleton__row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 0;

		& + & {
			border-top: 1px solid $admin-line-soft;
		}
	}

	.skeleton__lines {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
	}

	.skeleton__bar {
		display: block;
		border-radius: $admin-radius-pill;
		background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 45%, #eef0f4 90%);
		background-size: 200% 100%;
		animation: shimmer 1.1s linear infinite;

		&--eyebrow {
			width: 90px;
			height: 10px;
			margin-bottom: 10px;
		}

		&--tab {
			width: 96px;
			height: 36px;
		}

		&--avatar {
			width: 34px;
			height: 34px;
			flex: none;
		}

		&--line {
			width: min(320px, 60%);
			height: 11px;
		}

		&--short {
			width: min(180px, 35%);
			height: 9px;
		}

		&--pill {
			width: 88px;
			height: 28px;
			flex: none;
		}
	}

	@keyframes shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
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
		.greeting__time--colons-off .greeting__colon {
			opacity: 1;
			transition: none;
		}

		.progress::after {
			animation: none;
			width: 100%;
			opacity: 0.35;
		}

		.content__inner,
		.skeleton,
		.skeleton__bar {
			animation: none;
		}

		.sidebar {
			transition: none;
		}

		.shell {
			transition: none;
		}
	}

	.backdrop {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(10, 12, 16, 0.35);
		border: 0;
		z-index: 40;
		cursor: pointer;

		@include breakpoint-down($bp-md) {
			display: block;
		}
	}
</style>
