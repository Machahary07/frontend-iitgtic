<script lang="ts">
	import { page } from '$app/state';
	import { seoFor, trimForMeta } from '$lib/utils/seo';

	// Rendered once, from the root layout, so every route gets metadata without
	// 37 pages each repeating it.
	//
	// It does not emit <title>: every route sets its own in its own svelte:head,
	// and a second one in the document is a duplicate rather than an override —
	// which is exactly the bug that used to make every server-rendered page show
	// the homepage title. og:title is a separate tag, so the social card still
	// gets a proper heading.

	interface Props {
		/** Set by a page whose copy lives in a record rather than a content section. */
		title?: string;
		description?: string;
		image?: string;
		type?: string;
		noindex?: boolean;
	}

	let {
		title: titleOverride = '',
		description: descriptionOverride = '',
		image = '',
		type = 'website',
		noindex: noindexOverride
	}: Props = $props();

	const resolved = $derived(seoFor(page.url.pathname));
	const title = $derived(titleOverride || resolved.title);
	const description = $derived(
		descriptionOverride ? trimForMeta(descriptionOverride) : resolved.description
	);
	const noindex = $derived(noindexOverride ?? resolved.noindex);

	// From the request rather than an env var, so it is right on the Vercel
	// preview, the production domain and localhost without being configured.
	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}${page.url.pathname}`.replace(/\/$/, '') || origin);
	// From static/, not the asset pipeline: a social card is fetched by a crawler
	// with no session, and its URL has to stay valid across deploys.
	const socialImage = $derived(new URL(image || '/banner-iitgtic.webp', origin).toString());
</script>

<svelte:head>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	<meta
		name="robots"
		content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}
	/>

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content="IIT Guwahati TIC" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={socialImage} />
	{#if !image}
		<!-- Only the default banner has known dimensions; a page-supplied one does not. -->
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
	{/if}

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={socialImage} />
</svelte:head>
