<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.mentors;
	const ctaContent = content.cta.apply;
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
		<p class="body__eyebrow">{page.sectionEyebrow}</p>
		<div class="grid">
			{#each page.mentors as mentor, i (mentor.name)}
				<article class="card">
					<span class="card__index">{String(i + 1).padStart(2, '0')}</span>
					<h2 class="card__name">{mentor.name}</h2>
					{#if mentor.affiliation}<p class="card__affiliation">{mentor.affiliation}</p>{/if}
					{#if mentor.specialisation}<p class="card__spec">{mentor.specialisation}</p>{/if}
					{#if mentor.bio}<p class="card__bio">{mentor.bio}</p>{/if}
				</article>
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
		@include serif-h1(18ch);
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
		display: flex;
		flex-direction: column;
		gap: $space-7;
	}

	.body__eyebrow {
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
		gap: $space-2;
		padding: $space-6;
		border: 1px solid $color-black;
		background: $color-white;
		color: $color-black;

		@include breakpoint-down($bp-sm) {
			padding: $space-5;
		}
	}

	.card__index {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		color: rgba($color-black, 0.45);
	}

	.card__name {
		margin: $space-2 0 0;
		font-family: $font-family-serif;
		font-size: clamp(1.25rem, 2vw, #{$font-size-xl});
		font-style: italic;
		font-weight: $font-weight-regular;
		line-height: $line-height-tight;
		letter-spacing: $letter-spacing-tight;
	}

	.card__affiliation {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		line-height: $line-height-snug;
		color: rgba($color-black, 0.55);
	}

	.card__spec {
		margin: $space-1 0 0;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-medium;
		line-height: $line-height-snug;
		color: rgba($color-black, 0.82);
	}

	.card__bio {
		margin: $space-2 0 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.72);
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

		.card {
			padding: $space-5;
		}
	}
</style>
