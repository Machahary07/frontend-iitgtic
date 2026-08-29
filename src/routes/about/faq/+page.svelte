<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.faq;
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
		<div class="list">
			{#each page.items as item, i (i)}
				<details class="qa" open={i === 0}>
					<summary class="qa__summary">
						<span class="qa__index">0{i + 1}</span>
						<span class="qa__question">{item.question}</span>
						<span class="qa__icon" aria-hidden="true">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="m6 9 6 6 6-6" />
							</svg>
						</span>
					</summary>
					<p class="qa__answer">{item.answer}</p>
				</details>
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
		@include hero-lede(640px);
	}

	.body {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.body__inner {
		width: min(100%, $container-md);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-6;
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

	.list {
		display: flex;
		flex-direction: column;
		border-top: 1px solid rgba($color-black, 0.16);
	}

	.qa {
		border-bottom: 1px solid rgba($color-black, 0.16);
	}

	.qa__summary {
		display: flex;
		align-items: center;
		gap: $space-4;
		padding: $space-5 0;
		list-style: none;
		cursor: pointer;
		user-select: none;
	}

	.qa__summary::-webkit-details-marker {
		display: none;
	}

	.qa__index {
		flex-shrink: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		color: rgba($color-black, 0.45);
	}

	.qa__question {
		flex: 1;
		font-family: $font-family-serif;
		font-size: clamp(1.125rem, 2vw, #{$font-size-lg});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		font-style: italic;
		color: $color-black;
		text-wrap: balance;
	}

	.qa__icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: $color-black;
		transition: transform 0.25s ease;
	}

	.qa[open] .qa__icon {
		transform: rotate(180deg);
	}

	.qa__answer {
		margin: 0;
		padding: 0 0 $space-5 calc(#{$space-4} + 2.4ch);
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.78);
		max-width: 64ch;
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

		.qa__summary {
			gap: $space-3;
			padding: $space-4 0;
		}

		.qa__answer {
			padding-left: calc(#{$space-3} + 2.4ch);
		}
	}
</style>
