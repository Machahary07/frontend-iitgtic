<script lang="ts">
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import CallToAction from '$lib/components/CallToAction.svelte';
	import SchemeTabs from '$lib/components/SchemeTabs.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.schemes;
	const ctaContent = content.cta.apply;

	// Every scheme links out to the body that administers it, so the card is an
	// external anchor rather than an internal route.
	function isExternal(href: string) {
		return /^https?:\/\//i.test(href);
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

<section class="body">
	<div class="body__inner">
		<SchemeTabs />

		<div class="body__head">
			<p class="body__eyebrow">{page.sectionEyebrow}</p>
			<span class="body__count">{page.schemes.length}</span>
		</div>

		{#if page.schemes.length === 0}
			<p class="empty">{page.emptyMessage}</p>
		{:else}
			<ul class="list">
				{#each page.schemes as scheme, i (scheme.name)}
					<li class="row">
						<div class="row__index">0{i + 1}</div>
						<div class="row__body">
							<div class="row__head">
								<h2 class="row__name">{scheme.name}</h2>
								{#if scheme.shortName}
									<span class="row__short">{scheme.shortName}</span>
								{/if}
							</div>
							<p class="row__provider">{scheme.provider}</p>
							<p class="row__summary">{scheme.summary}</p>

							{#if scheme.support.length > 0}
								<ul class="tags">
									{#each scheme.support as tag (tag)}
										<li class="tag">{tag}</li>
									{/each}
								</ul>
							{/if}

							{#if scheme.href}
								<!-- Schemes link out to the body that administers them, so the
								     href is an external URL rather than a route id. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									class="row__link"
									href={scheme.href}
									target={isExternal(scheme.href) ? '_blank' : null}
									rel={isExternal(scheme.href) ? 'noopener noreferrer' : null}
								>
									<span>Scheme details</span>
									<ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						</div>
					</li>
				{/each}
			</ul>
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
		@include serif-h1(16ch);
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
		gap: $space-6;
	}

	.body__head {
		display: flex;
		align-items: baseline;
		gap: $space-3;
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

	.body__count {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		color: rgba($color-black, 0.45);
	}

	.empty {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-lg;
		line-height: $line-height-base;
		color: rgba($color-black, 0.6);
		max-width: 60ch;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid rgba($color-black, 0.12);
	}

	.row {
		display: grid;
		grid-template-columns: 4rem 1fr;
		gap: $space-4;
		padding: $space-6 0;
		border-bottom: 1px solid rgba($color-black, 0.12);

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
			gap: $space-2;
			padding: $space-5 0;
		}
	}

	.row__index {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		color: rgba($color-black, 0.45);
		padding-top: 0.4em;
	}

	.row__body {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		min-width: 0;
	}

	.row__head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: $space-3;
	}

	.row__name {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.25rem, 2.4vw, #{$font-size-2xl});
		font-style: italic;
		font-weight: $font-weight-regular;
		line-height: $line-height-tight;
		letter-spacing: $letter-spacing-tight;
	}

	.row__short {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
		border: 1px solid rgba($color-black, 0.2);
		padding: $space-1 $space-2;
	}

	.row__provider {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		color: rgba($color-black, 0.6);
	}

	.row__summary {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.78);
		max-width: 72ch;
	}

	.tags {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
		margin: 0;
		padding: 0;
	}

	.tag {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		letter-spacing: 0.04em;
		color: rgba($color-black, 0.7);
		background: rgba($color-black, 0.05);
		padding: $space-1 $space-3;
	}

	.row__link {
		display: inline-flex;
		align-items: center;
		gap: $space-2;
		align-self: flex-start;
		// 44px of hit area without pushing the row apart visually.
		min-height: 44px;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-semibold;
		color: $color-black;
		text-decoration: none;
		border-bottom: 1px solid $color-black;

		&:hover,
		&:focus-visible {
			opacity: 0.65;
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
	}
</style>
