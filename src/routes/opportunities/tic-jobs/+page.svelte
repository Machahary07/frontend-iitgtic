<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import JobBoard from '$lib/components/JobBoard.svelte';
	import { getContent } from '$lib/content';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const content = getContent();

	const page = content.pages.ticJobs;
	const ctaContent = content.cta.apply;
</script>

<svelte:head>
	<title>{page.title}</title>
</svelte:head>

<JobBoard {page} posts={data.posts} searchLabel="Search open roles at the centre" />

<CallToAction
	eyebrow={ctaContent.eyebrow}
	headlineLead={ctaContent.headlineLead}
	headlineEmphasis={ctaContent.headlineEmphasis}
	label={ctaContent.label}
	href={ctaContent.href}
/>
