<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import SchemeTabs from '$lib/components/SchemeTabs.svelte';
	import ScrollSpyNav from '$lib/components/ScrollSpyNav.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.schemesFunding;
	const ctaContent = content.cta.apply;
	const navSections = page.schemes.map((s) => ({ id: s.id, label: s.label }));
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

<section class="body">
	<div class="body__inner">
		<SchemeTabs />

		{#if page.schemes.length === 0}
			<p class="empty">{page.emptyMessage}</p>
		{:else}
			<div class="layout">
				<ScrollSpyNav sections={navSections} eyebrow={page.scrollspyEyebrow} />

				<ol class="list" aria-label={page.sectionEyebrow}>
					{#each page.schemes as scheme, i (scheme.id)}
						<li id={scheme.id} class="scheme">
							<p class="scheme__index">{String(i + 1).padStart(2, '0')}</p>
							<h2 class="scheme__name">{scheme.name}</h2>
							<p class="scheme__tagline">{scheme.tagline}</p>

							<div class="scheme__amount">
								<p class="scheme__label">{scheme.amountLabel}</p>
								<p class="scheme__amount-text">{scheme.amount}</p>
							</div>

							<div class="scheme__grid">
								<div class="scheme__block">
									<h3 class="scheme__label">{page.descriptionHeading}</h3>
									<p class="scheme__prose">{scheme.description}</p>
								</div>

								{#if scheme.eligibility.length > 0}
									<div class="scheme__block">
										<h3 class="scheme__label">{page.eligibilityHeading}</h3>
										<ul class="points">
											{#each scheme.eligibility as point (point)}
												<li>{point}</li>
											{/each}
										</ul>
									</div>
								{/if}

								{#if scheme.help.length > 0}
									<div class="scheme__block">
										<h3 class="scheme__label">{page.helpHeading}</h3>
										<ul class="points">
											{#each scheme.help as point (point)}
												<li>{point}</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
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
		gap: $space-8;
	}

	.empty {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-lg;
		line-height: $line-height-base;
		color: rgba($color-black, 0.6);
		max-width: 60ch;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
		gap: $space-10;
		align-items: start;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
			gap: $space-7;
		}
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid rgba($color-black, 0.12);
	}

	.scheme {
		display: flex;
		flex-direction: column;
		gap: $space-4;
		padding: $space-8 0;
		border-bottom: 1px solid rgba($color-black, 0.12);
		scroll-margin-top: calc(var(--page-shell-top, 104px) + #{$space-5});
	}

	.scheme__index,
	.scheme__label {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.5);
	}

	.scheme__name {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.5rem, 3vw, #{$font-size-3xl});
		font-weight: $font-weight-regular;
		line-height: $line-height-tight;
		letter-spacing: $letter-spacing-tight;
		text-wrap: balance;
		max-width: 30ch;
	}

	.scheme__tagline {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-md;
		font-style: italic;
		line-height: $line-height-base;
		color: rgba($color-black, 0.72);
		max-width: 60ch;
	}

	// The figure is what a founder scans for first, so it is set apart from the
	// prose rather than buried in it.
	.scheme__amount {
		display: flex;
		flex-direction: column;
		gap: $space-2;
		margin-top: $space-2;
		padding: $space-4 $space-5;
		background: rgba($color-black, 0.04);
		border-left: 2px solid $color-black;
		max-width: 64ch;
	}

	.scheme__amount-text {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		line-height: $line-height-base;
		color: $color-black;
	}

	.scheme__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $space-6 $space-7;
		margin-top: $space-3;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
		}
	}

	.scheme__block {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		min-width: 0;
	}

	.scheme__prose {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.82);
	}

	.points {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: $space-2;

		li {
			position: relative;
			padding-left: $space-5;
			font-family: $font-family-serif;
			font-size: $font-size-base;
			line-height: $line-height-base;
			color: rgba($color-black, 0.82);

			&::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0.7em;
				width: $space-3;
				height: 1px;
				background: rgba($color-black, 0.45);
			}
		}
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

		.scheme {
			padding: $space-6 0;
		}

		.scheme__amount {
			padding: $space-3 $space-4;
		}
	}
</style>
