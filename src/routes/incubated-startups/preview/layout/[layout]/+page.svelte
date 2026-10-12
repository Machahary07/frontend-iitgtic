<script lang="ts">
	import StartupProfile from '$lib/components/startup/StartupProfile.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Layout example · {data.layout.label}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<p class="banner" role="status">
	Example of the <strong>{data.layout.label}</strong> layout, with a made-up startup. Your page
	uses your own text and photos.
</p>

<StartupProfile startup={data.startup} category={{ slug: 'current', title: 'Current Incubatees' }} />

<style lang="scss">
	@use '$styles/variables' as *;

	.banner {
		position: fixed;
		left: 50%;
		bottom: 16px;
		z-index: 90;
		transform: translateX(-50%);
		width: max-content;
		max-width: calc(100% - 32px);
		margin: 0;
		padding: 10px 16px;
		border-radius: $radius-pill;
		background: $color-brand-charcoal;
		color: $color-white;
		font-size: 13px;
		text-align: center;
	}
</style>
