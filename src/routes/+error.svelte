<script lang="ts">
	import { page } from '$app/stores';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import content from '$lib/data/content.json';

	const { notFound, generic, backHome } = content.error;
</script>

<div class="error-page">
	<p class="status">{$page.status}</p>
	<h1>
		{$page.status === 404 ? notFound.heading : generic.heading}
	</h1>
	<p class="message">
		{$page.status === 404 ? notFound.message : generic.message}
	</p>
	<LinkReveal href="/" text={backHome} class="back" />
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.error-page {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-6 $space-8;
		background: $color-bg;
		color: $color-fg;
	}

	.status {
		font-size: clamp(6rem, 20vw, 18rem);
		font-weight: $font-weight-light;
		line-height: 1;
		margin: 0 0 $space-4;
		color: $color-fg;
		letter-spacing: $letter-spacing-normal;
	}

	h1 {
		font-size: $font-size-xl;
		font-weight: $font-weight-regular;
		margin: 0 0 $space-3;
		letter-spacing: $letter-spacing-normal;
	}

	.message {
		font-size: $font-size-base;
		color: $color-muted;
		margin: 0 0 $space-7;
	}

	:global(.back) {
		font-size: $font-size-base;
		font-weight: $font-weight-medium;
		color: $color-fg;
	}

	@media (max-width: $bp-sm) {
		.error-page {
			padding-inline: $space-4;
		}

		.status {
			font-size: clamp(5rem, 28vw, 8rem);
		}
	}
</style>
