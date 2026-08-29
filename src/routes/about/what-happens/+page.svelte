<script lang="ts">
	import ScrollSpyNav from '$lib/components/ScrollSpyNav.svelte';
	import HomeAssociationMarquee from '$lib/components/HomeAssociationMarquee.svelte';
	import CallToAction from '$lib/components/CallToAction.svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.whatHappens;
	const ctaContent = content.cta.apply;
	const navSections = page.sections.map((s) => ({ id: s.id, label: s.label }));
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

<section class="body">
	<div class="body__inner">
		<ScrollSpyNav sections={navSections} eyebrow={page.scrollspyEyebrow} />

		<article class="content">
			{#each page.sections as section (section.id)}
				<section id={section.id} class="block">
					<p class="block__eyebrow">{section.eyebrow}</p>
					<h2>
						{section.headlineLead}
						<em>{section.headlineEmphasis}</em>
					</h2>
					{#each section.paragraphs as paragraph (paragraph)}
						<p>{paragraph}</p>
					{/each}

					{#if section.showAssociationMarquee}
						<div class="marquee-wrap">
							<HomeAssociationMarquee />
						</div>
					{/if}

					{#if section.callout}
						<aside class="callout">
							<p class="callout__text">{section.callout.text}</p>
							<LinkReveal
								href={section.callout.href}
								text={section.callout.label}
								class="callout__btn"
							/>
						</aside>
					{/if}
				</section>
			{/each}
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

	// ---- Hero (mirrors HomeIntroHero) ----
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
		@include hero-lede(520px, $line-height-base, 0.8);
	}

	// ---- Body / scrollspy layout ----
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
		max-width: 680px;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: $space-4;
		scroll-margin-top: calc(var(--page-shell-top, 104px) + #{$space-5});
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

	.marquee-wrap {
		margin-top: $space-4;
		padding: $space-5 0 $space-2;
		border-top: 1px solid rgba($color-black, 0.08);
		display: flex;
		justify-content: center;
	}

	.callout {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: $space-4;
		margin-top: $space-4;
		padding: $space-5 $space-6;
		border-bottom: 2px solid $color-black;
		border-right: 2px solid $color-black;
		background: rgba($color-black, 0.04);
	}

	.callout__text {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		font-style: italic;
		color: rgba($color-black, 0.82);
		max-width: 56ch;
	}

	:global(.callout__btn) {
		display: inline-flex;
		align-items: center;
		padding: $space-3 $space-6;
		background: $color-black;
		color: $color-white;
		border-radius: $radius-pill;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		font-style: italic;
		text-decoration: none;
		white-space: nowrap;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
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

		.block p,
		.hero__lede p {
			font-size: $font-size-base;
		}

		.callout {
			padding: $space-4;
		}

		.callout__text {
			font-size: $font-size-base;
		}

		:global(.callout__btn) {
			padding: $space-3 $space-4;
		}
	}
</style>
