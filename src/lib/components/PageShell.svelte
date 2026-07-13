<script lang="ts">
	interface Props {
		heading: string;
	}

	let { heading }: Props = $props();
</script>

<section class="page-shell">
	<h1>{heading}</h1>
</section>

<style lang="scss">
	@use '$styles/variables' as *;

	.page-shell {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-6 $space-8;
		background: $color-white;
		color: $color-black;
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: clamp(3rem, 13vw, 10rem);
		font-weight: $font-weight-black;
		line-height: 0.95;
		text-transform: uppercase;
		max-width: 100%;
	}

	@media (max-width: $bp-sm) {
		.page-shell {
			align-items: flex-start;
			padding: calc(var(--page-shell-top, 100px) + #{$space-8}) $space-4 $space-6;
		}

		h1 {
			font-size: clamp(2.5rem, 16vw, 5rem);
			line-height: 1;
		}
	}
</style>
