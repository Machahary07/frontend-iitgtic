<script lang="ts">
	import StartupProfile from '$lib/components/startup/StartupProfile.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Preview · {data.startup.name || 'Startup profile'}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<p class="banner" role="status">
	Preview of the {data.version === 'live' ? 'live version' : 'draft'} — not public until TIC approves
	it and lists the startup.
</p>

<StartupProfile startup={data.startup} category={data.category} />

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
