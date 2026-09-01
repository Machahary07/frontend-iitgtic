<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.team;
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
			{#each page.members as member, i (i)}
				<article class="card">
					<span class="card__index">0{i + 1}</span>
					<div class="card__avatar-wrap">
						{#if member.avatar?.src}
							<img
								class="card__avatar card__avatar--photo"
								src={member.avatar.src}
								alt={member.avatar.alt}
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<!-- No photo yet: the plain circle is the placeholder, and being
							     decorative it stays out of the accessibility tree. -->
							<div class="card__avatar" aria-hidden="true"></div>
						{/if}
					</div>
					<h2 class="card__name">{member.role}</h2>
					<p class="card__bio">{member.bio}</p>
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
		gap: $space-3;
		padding: $space-6;
		border: 1px solid $color-black;
		background: $color-white;
		color: $color-black;
		aspect-ratio: 1 / 1;

		@include breakpoint-down($bp-sm) {
			aspect-ratio: auto;
			min-height: 360px;
		}
	}

	.card__index {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		color: rgba($color-black, 0.45);
	}

	.card__avatar-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card__avatar {
		width: clamp(120px, 38%, 160px);
		aspect-ratio: 1 / 1;
		border-radius: $radius-circle;
		background: $color-black;
	}

	.card__avatar--photo {
		object-fit: cover;
		display: block;
	}

	.card__name {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.25rem, 2vw, #{$font-size-xl});
		font-style: italic;
		font-weight: $font-weight-regular;
		line-height: $line-height-tight;
		letter-spacing: $letter-spacing-tight;
	}

	.card__bio {
		margin: 0;
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
