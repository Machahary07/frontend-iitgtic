<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	const content = getContent();

	const page = content.pages.about;
	const ctaContent = content.cta.apply;

	let titleRefs: HTMLElement[] = $state([]);

	async function animate(idx: number, yPercent: number) {
		if (prefersReducedMotion()) return;
		const el = titleRefs[idx];
		if (!el) return;
		const { gsap } = await loadGsap();
		gsap.to(el, {
			yPercent,
			duration: 0.6,
			ease: 'hop',
			overwrite: true
		});
	}
</script>

<svelte:head>
	<title>{page.title}</title>
</svelte:head>

<section class="hero">
	<p class="hero__eyebrow">{page.hero.eyebrow}</p>
	<h1>
		{page.hero.headlineLead}
		<em>{page.hero.headlineEmphasis}</em>
	</h1>
	<div class="hero__lede">
		<p>{page.hero.intro}</p>
	</div>
</section>

<section class="grid-section">
	<div class="grid-section__inner">
		<p class="grid-section__eyebrow">{page.gridEyebrow}</p>
		<div class="grid">
			{#each page.links as link, i (link.href)}
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
					<div class="card__icon" aria-hidden="true">
						{#if link.icon === 'compass'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="10" />
								<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
							</svg>
						{:else if link.icon === 'landmark'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="3" x2="21" y1="22" y2="22" />
								<line x1="6" x2="6" y1="18" y2="11" />
								<line x1="10" x2="10" y1="18" y2="11" />
								<line x1="14" x2="14" y1="18" y2="11" />
								<line x1="18" x2="18" y1="18" y2="11" />
								<polygon points="12 2 20 7 4 7" />
							</svg>
						{:else if link.icon === 'users'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
								<path d="M16 3.13a4 4 0 0 1 0 7.75" />
							</svg>
						{:else if link.icon === 'help-circle'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="10" />
								<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
								<path d="M12 17h.01" />
							</svg>
						{:else if link.icon === 'book-open'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
								<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
							</svg>
						{:else if link.icon === 'graduation-cap'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
								/>
								<path d="M22 10v6" />
								<path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
							</svg>
						{/if}
					</div>
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
			{/each}
		</div>
	</div>
</section>

<CallToAction
	eyebrow={ctaContent.eyebrow}
	headlineLead={ctaContent.headlineLead}
	headlineEmphasis={ctaContent.headlineEmphasis}
	label={ctaContent.label}
	href={ctaContent.href}
/>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.hero {
		@include page-hero;
	}

	.hero__eyebrow {
		@include eyebrow;
	}

	.hero h1 {
		@include serif-h1;
	}

	.hero__lede {
		@include hero-lede;
	}

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
		// background: $color-accent-blue;
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

		svg {
			width: 48px;
			height: 48px;
		}
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
		.hero {
			@include page-hero-mobile;
		}

		.grid-section {
			padding: $space-8 $space-5 $space-9;
		}

		.card {
			padding: $space-5;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}
	}
</style>
