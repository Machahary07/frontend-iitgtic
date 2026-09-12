<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Users from '@lucide/svelte/icons/users';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	// The hub-page card grid: hero on top, a row of square cards below, each one
	// a doorway into a child page. /about and /incubation each carry an older
	// hand-inlined copy of this; new hubs use this one.
	type GridLink = { title: string; tagline: string; href: string; icon?: string };

	let {
		eyebrow,
		links
	}: {
		eyebrow: string;
		links: readonly GridLink[];
	} = $props();

	const ICONS = {
		banknote: Banknote,
		calendar: Calendar,
		landmark: Landmark,
		rocket: Rocket,
		users: Users
	} as const;

	function iconFor(name: string | undefined) {
		return name && name in ICONS ? ICONS[name as keyof typeof ICONS] : null;
	}

	let titleRefs: HTMLElement[] = $state([]);

	async function animate(idx: number, yPercent: number) {
		if (prefersReducedMotion()) return;
		const el = titleRefs[idx];
		if (!el) return;
		const { gsap } = await loadGsap();
		gsap.to(el, { yPercent, duration: 0.6, ease: 'hop', overwrite: true });
	}
</script>

<section class="grid-section">
	<div class="grid-section__inner">
		<p class="grid-section__eyebrow">{eyebrow}</p>
		<div class="grid">
			{#each links as link, i (link.href)}
				{@const Icon = iconFor(link.icon)}
				<!-- Hub targets are authored in the admin console, so the href is a
				     content string rather than a route id resolve() can check. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={link.href}
					class="card"
					onmouseenter={() => animate(i, -50)}
					onmouseleave={() => animate(i, 0)}
					onfocus={() => animate(i, -50)}
					onblur={() => animate(i, 0)}
				>
					<div class="card__top">
						<span class="card__index">0{i + 1}</span>
						<svg
							class="card__arrow"
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M7 7h10v10" />
							<path d="M7 17 17 7" />
						</svg>
					</div>

					{#if Icon}
						<div class="card__icon" aria-hidden="true">
							<Icon size={48} strokeWidth={1.5} />
						</div>
					{/if}

					<div class="card__title">
						<span class="reveal-mask">
							<span class="reveal-wrapper" bind:this={titleRefs[i]}>
								<span class="reveal-item">{link.title}</span>
								<span class="reveal-item" aria-hidden="true">{link.title}</span>
							</span>
						</span>
					</div>
					<p class="card__tagline">{link.tagline}</p>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</div>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.grid-section {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.grid-section__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-7;
	}

	.grid-section__eyebrow {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.grid {
		display: grid;
		// Three columns whatever the card count, matching /about and /incubation —
		// a two-card hub leaves the third column empty rather than stretching its
		// square cards to half the page.
		grid-template-columns: repeat(3, 1fr);
		gap: $space-5;

		@include breakpoint-down($bp-md) {
			grid-template-columns: repeat(2, 1fr);
		}

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.card {
		position: relative;
		aspect-ratio: 1 / 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: $space-6;
		color: $color-black;
		border: 1px solid $color-black;
		text-decoration: none;
		overflow: hidden;
		cursor: pointer;

		@include breakpoint-down($bp-sm) {
			aspect-ratio: auto;
			min-height: 220px;
		}
	}

	.card__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: $space-3;
	}

	.card__index {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		color: rgba($color-black, 0.55);
	}

	.card__arrow {
		flex-shrink: 0;
		color: $color-black;
	}

	.card__icon {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: $color-black;
	}

	.card__title {
		color: $color-black;
		font-family: $font-family-serif;
		font-size: clamp(1.125rem, 2.4vw, #{$font-size-2xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		font-style: italic;
		margin-bottom: $space-3;
	}

	.reveal-mask {
		display: block;
		overflow: hidden;
		height: 1.2em;
		line-height: 1.2em;
	}

	.reveal-wrapper {
		display: flex;
		flex-direction: column;
		will-change: transform;
	}

	.reveal-item {
		display: block;
		height: 1.2em;
		white-space: nowrap;
	}

	.card__tagline {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.7);
		max-width: 38ch;
	}

	@include breakpoint-down($bp-sm) {
		.grid-section {
			padding: $space-8 $space-5 $space-9;
		}

		.card {
			padding: $space-5;
		}
	}
</style>
