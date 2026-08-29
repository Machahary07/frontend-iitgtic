<script lang="ts">
	import '@fontsource-variable/montserrat/index.css';
	import '@fontsource-variable/montserrat/wght-italic.css';
	import '@fontsource-variable/source-serif-4/index.css';
	import '@fontsource-variable/source-serif-4/wght-italic.css';
	import '$styles/app.scss';
	import { dev } from '$app/environment';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { images } from '$lib/data/images';
	import { Navbar, EventBar, Footer } from '$lib';
	import { setContent } from '$lib/content';
	import type { LayoutData } from './$types';

	injectAnalytics({ mode: dev ? 'development' : 'production' });

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	// Publish the live copy before anything below renders, so every page and
	// component reads the edited content rather than the bundled fallback. The
	// first call has to happen during render — effects do not run on the server —
	// and the pre-effect keeps it current across client-side navigation.
	untrack(() => setContent(data.content));
	$effect.pre(() => setContent(data.content));

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
