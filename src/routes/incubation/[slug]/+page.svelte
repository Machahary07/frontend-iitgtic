<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import ScrollSpyNav from '$lib/components/ScrollSpyNav.svelte';
	import content from '$lib/data/content.json';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pillar = $derived(data.pillar);
	const ctaContent = content.cta.apply;
	const navSections = $derived(pillar.sections.map((s) => ({ id: s.id, label: s.label })));
</script>

<svelte:head>
	<title>{pillar.title} · IITG TIC</title>
</svelte:head>

<section class="hero">
	<p class="hero__eyebrow">{pillar.hero.eyebrow}</p>
	<h1>
		{pillar.hero.headlineLead}
		<em>{pillar.hero.headlineEmphasis}</em>
	</h1>
	<div class="hero__lede">
		<p>{pillar.hero.lede}</p>
	</div>
</section>

<section class="body">
	<div class="body__inner">
		<ScrollSpyNav sections={navSections} eyebrow={pillar.scrollspyEyebrow} />

		<article class="content">
			{#each pillar.sections as section (section.id)}
				<section id={section.id} class="block">
					<div class="block__copy">
						<p class="block__eyebrow">{section.eyebrow}</p>
						<h2>
							{section.headlineLead}
							<em>{section.headlineEmphasis}</em>
						</h2>
						{#each section.paragraphs as paragraph (paragraph)}
							<p>{paragraph}</p>
						{/each}
					</div>

					{#if section.image}
						<figure class="block__figure" aria-label={section.image.alt}>
							<div class="block__figure-placeholder" aria-hidden="true"></div>
						</figure>
					{/if}
				</section>
			{/each}

			<footer class="back">
				<LinkReveal href="/incubation" text="← Back to incubation" class="back__link" />
			</footer>
		</article>
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
		@include hero-lede(640px);
	}

	.body {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.body__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
		gap: $space-10;
		align-items: start;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
			gap: $space-7;
		}
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: $space-10;
	}

	.block {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
		gap: $space-7;
		align-items: start;
		scroll-margin-top: calc(var(--page-shell-top, 104px) + #{$space-5});

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
			gap: $space-5;
		}
	}

	.block__copy {
		display: flex;
		flex-direction: column;
		gap: $space-4;
		max-width: 56ch;
	}

	.block__eyebrow {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.block h2 {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.625rem, 3.4vw, #{$font-size-4xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		text-wrap: balance;

		em {
			font-style: italic;
		}
	}

	.block p {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.82);
	}

	.block__figure {
		margin: 0;
	}

	.block__figure-placeholder {
		width: 100%;
		aspect-ratio: 4 / 3;
		background: $color-black;
	}

	.back {
		padding-top: $space-6;
		border-top: 1px solid rgba($color-black, 0.16);
	}

	:global(.back__link) {
		color: $color-black;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}

		.body {
			padding: $space-8 $space-5 $space-9;
		}

		.content {
			gap: $space-8;
		}

		.block h2 {
			font-size: clamp(1.5rem, 6.5vw, 2rem);
		}

		.block p {
			font-size: $font-size-base;
		}
	}
</style>
