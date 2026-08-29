<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	const content = getContent();

	const page = content.pages.incubation;
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
			{#each page.links as link, i (link.slug)}
				<a
					href={`/incubation/${link.slug}`}
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
						{#if link.icon === 'rocket'}
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
									d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
								/>
								<path
									d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
								/>
								<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
								<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
							</svg>
						{:else if link.icon === 'building'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
								<path d="M6 12H4a2 2 0 0 0-2 2v8h4" />
								<path d="M18 9h2a2 2 0 0 1 2 2v11h-4" />
								<path d="M10 6h4" />
								<path d="M10 10h4" />
								<path d="M10 14h4" />
								<path d="M10 18h4" />
							</svg>
						{:else if link.icon === 'banknote'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect width="20" height="12" x="2" y="6" rx="2" />
								<circle cx="12" cy="12" r="2" />
								<path d="M6 12h.01M18 12h.01" />
							</svg>
						{:else if link.icon === 'wrench'}
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
									d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
								/>
							</svg>
						{:else if link.icon === 'home'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
								<polyline points="9 22 9 12 15 12 15 22" />
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
		font-size: clamp(1.0625rem, 2.4vw, #{$font-size-2xl});
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
