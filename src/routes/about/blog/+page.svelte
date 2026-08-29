<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	const content = getContent();

	const page = content.pages.blog;
	const ctaContent = content.cta.apply;

	function formatDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	}

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
		<p>{page.hero.lede}</p>
	</div>
</section>

<section class="grid-section">
	<div class="grid-section__inner">
		<p class="grid-section__eyebrow">{page.sectionEyebrow}</p>
		<div class="grid">
			{#each page.posts as post, i (post.slug)}
				<a
					href={`/about/blog/${post.slug}`}
					class="card"
					onmouseenter={() => animate(i, -50)}
					onmouseleave={() => animate(i, 0)}
					onfocus={() => animate(i, -50)}
					onblur={() => animate(i, 0)}
				>
					<div class="card__top">
						<span class="card__date">{formatDate(post.date)}</span>
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
					<div class="card__image" aria-hidden="true"></div>
					<div class="card__title">
						<span class="reveal-mask">
							<span class="reveal-wrapper" bind:this={titleRefs[i]}>
								<span class="reveal-item">{post.title}</span>
								<span class="reveal-item" aria-hidden="true">{post.title}</span>
							</span>
						</span>
					</div>
					<p class="card__excerpt">{post.excerpt}</p>
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
		@include serif-h1(14ch);
	}

	.hero__lede {
		@include hero-lede(640px);
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
		display: flex;
		flex-direction: column;
		gap: $space-4;
		padding: $space-6;
		background: $color-white;
		color: $color-black;
		border: 1px solid $color-black;
		text-decoration: none;
		overflow: hidden;
		cursor: pointer;
		aspect-ratio: 1 / 1;

		@include breakpoint-down($bp-sm) {
			aspect-ratio: auto;
		}
	}

	.card__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: $space-3;
	}

	.card__date {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.card__arrow {
		flex-shrink: 0;
		color: $color-black;
	}

	.card__image {
		flex: 1;
		width: 100%;
		min-height: 0;
		background: $color-black;

		@include breakpoint-down($bp-sm) {
			flex: none;
			aspect-ratio: 4 / 3;
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

	.card__excerpt {
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

		.hero__lede {
			@include hero-lede-mobile;
		}

		.grid-section {
			padding: $space-8 $space-5 $space-9;
		}

		.card {
			padding: $space-5;
		}
	}
</style>
