<script lang="ts">
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Unsubscribe · IIT Guwahati TIC</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="unsub">
	<div class="unsub__inner">
		{#if data.status === 'ok'}
			<h1>You're unsubscribed</h1>
			<p>
				{data.email} won't receive the newsletter any more. You can re-subscribe any time from the
				site footer.
			</p>
			<LinkReveal href="/" text="Back to the site" class="inline-link" />
		{:else if data.status === 'invalid'}
			<h1>This link isn't valid</h1>
			<p>
				The unsubscribe link is incomplete or has expired. Open it straight from the newsletter, or
				ask us to remove you.
			</p>
			<LinkReveal href="/contact" text="Contact us" class="inline-link" />
		{:else}
			<h1>Something went wrong</h1>
			<p>We couldn't unsubscribe you just now. Please try the link again in a moment.</p>
			<LinkReveal href="/contact" text="Contact us" class="inline-link" />
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.unsub {
		min-height: 100svh;
		background: $color-accent-blue;
		color: $color-white;
		padding: calc(var(--page-shell-top, 104px) + #{$space-10}) 0 $space-8;
		display: flex;
		justify-content: center;

		@include breakpoint-down($bp-sm) {
			padding-top: calc(var(--page-shell-top, 100px) + #{$space-8});
		}
	}

	.unsub__inner {
		width: 100%;
		max-width: 460px;
		padding-inline: $space-6;

		@include breakpoint-down($bp-sm) {
			padding-inline: $space-4;
		}

		h1 {
			margin: 0 0 $space-3;
			font-size: $font-size-3xl;
		}

		p {
			margin: 0 0 $space-5;
			line-height: 1.6;
		}
	}
</style>
