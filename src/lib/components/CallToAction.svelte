<script lang="ts">
	import LinkReveal from './LinkReveal.svelte';

	interface Props {
		eyebrow?: string;
		headlineLead: string;
		headlineEmphasis?: string;
		label: string;
		href: string;
	}

	let {
		eyebrow = '',
		headlineLead,
		headlineEmphasis = '',
		label,
		href
	}: Props = $props();
</script>

<section class="cta-banner">
	<div class="cta-banner__inner">
		<div class="cta-banner__copy">
			{#if eyebrow}
				<p class="cta-banner__eyebrow">{eyebrow}</p>
			{/if}
			<h2 class="cta-banner__headline">
				{headlineLead}
				{#if headlineEmphasis}
					<em>{headlineEmphasis}</em>
				{/if}
			</h2>
		</div>

		<LinkReveal {href} text={label} class="cta-banner__btn" />
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.cta-banner {
		background: $color-accent-blue;
		color: $color-white;
		padding: $space-9 $space-8;
	}

	.cta-banner__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-8;

		@include breakpoint-down($bp-md) {
			flex-direction: column;
			align-items: flex-start;
			gap: $space-6;
		}
	}

	.cta-banner__copy {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		max-width: 640px;
	}

	.cta-banner__eyebrow {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-white, 0.6);
	}

	.cta-banner__headline {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.75rem, 4vw, #{$font-size-4xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		text-wrap: balance;

		em {
			font-style: italic;
		}
	}

	:global(.cta-banner__btn) {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		padding: $space-3 $space-7;
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
		.cta-banner {
			padding: $space-8 $space-5;
		}

		:global(.cta-banner__btn) {
			padding: $space-3 $space-5;
		}
	}
</style>
