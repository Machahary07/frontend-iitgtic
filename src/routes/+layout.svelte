<script lang="ts">
	import '@fontsource-variable/montserrat/index.css';
	import '@fontsource-variable/montserrat/wght-italic.css';
	import '@fontsource-variable/source-serif-4/index.css';
	import '@fontsource-variable/source-serif-4/wght-italic.css';
	import '$styles/app.scss';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { images } from '$lib/data/images';
	import { Navbar, EventBar, Footer } from '$lib';

	injectAnalytics({ mode: dev ? 'development' : 'production' });

	let { children } = $props();

	const isAdmin = $derived(
		page.url.pathname.startsWith('/tic-admin') ||
			page.url.pathname.startsWith('/opportunities/job-posting-admin')
	);
</script>

<svelte:head>
	<link rel="icon" type="image/webp" href={images.favicon} />
</svelte:head>

{#if !isAdmin}
	<EventBar />
	<Navbar />
{/if}

<main class:main--admin={isAdmin}>
	{@render children()}
</main>

{#if !isAdmin}
	<Footer />
{/if}

<style lang="scss">
	main {
		width: 100%;
	}
</style>
