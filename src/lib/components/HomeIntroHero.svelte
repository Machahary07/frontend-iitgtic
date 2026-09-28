<script lang="ts">
	import HomeAssociationMarquee from './HomeAssociationMarquee.svelte';
	import LinkReveal from './LinkReveal.svelte';
	import { resolve } from '$app/paths';
	import { getContent } from '$lib/content';

	const content = getContent();

	type RouteHref = Parameters<typeof resolve>[0];
	const intro = content.homeHero.intro;
	const ctaHref = intro.ctaHref as RouteHref;
</script>

<section class="intro-hero">
	<div class="content">
		<h1>
			{intro.headlineLead}<br /><em>{intro.headlineEmphasis}</em>
		</h1>

		<div class="citation">
			<p>{intro.citation}</p>
		</div>
	</div>

	<LinkReveal href={ctaHref} text={intro.ctaLabel} class="cta" />

	<div class="marquee-wrap">
		<HomeAssociationMarquee />
	</div>

	<div class="scroll-indicator">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
		</svg>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;

	.intro-hero {
		min-height: 100svh;
		width: 100%;
		background-color: $color-white;
		color: #1a1a1a;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-8 $space-8;
		position: relative;
		font-family: $font-family-serif;
		gap: $space-6;
	}

	.content {
		width: min(800px, 100%);
		min-width: 0;
	}

	:global(.cta) {
		display: inline-flex;
		align-items: center;
		padding: $space-3 $space-7;
		background-color: $color-black;
		color: $color-white;
		border-radius: $radius-pill;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		font-style: italic;
		text-decoration: none;
		white-space: nowrap;
	}

	.marquee-wrap {
		margin-top: $space-3;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	h1 {
		font-size: clamp(2rem, 6vw, #{$font-size-5xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		margin-bottom: $space-8;
		text-wrap: balance;

		em {
			font-style: $font-style-italic;
		}
	}

	.citation {
		max-width: 500px;
		margin: 0 auto;
		font-size: $font-size-md;
		line-height: $line-height-base;
		opacity: 0.8;
	}

	.scroll-indicator {
		position: absolute;
		bottom: $space-8;
		left: 50%;
		transform: translateX(-50%);
		opacity: 0.5;
		animation: bounce 2s infinite;
	}

	@keyframes bounce {
		0%,
		20%,
		50%,
		80%,
		100% {
			transform: translate(-50%, 0);
		}
		40% {
			transform: translate(-50%, -10px);
		}
		60% {
			transform: translate(-50%, -5px);
		}
	}

	@media (max-width: $bp-sm) {
		.intro-hero {
			min-height: auto;
			justify-content: flex-start;
			padding: calc(var(--page-shell-top, 100px) + #{$space-7}) $space-5 $space-6;
			gap: $space-5;
		}

		.scroll-indicator {
			display: none;
		}

		h1 {
			max-width: 290px;
			margin-inline: auto;
			font-size: clamp(1.625rem, 6.8vw, 1.875rem);
			margin-bottom: $space-5;
		}

		.citation {
			max-width: 300px;
			font-size: $font-size-base;
			padding: 0;
		}

		:global(.cta) {
			justify-content: center;
			width: min(100%, 280px);
			padding-inline: $space-5;
		}

		.marquee-wrap {
			margin-top: 0;
		}
	}

	@media (max-width: $bp-xs), (max-height: 720px) {
		.intro-hero {
			padding-inline: $space-4;
			gap: $space-4;
		}

		.scroll-indicator {
			display: none;
		}
	}
</style>
