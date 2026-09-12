<script lang="ts">
	import { onMount } from 'svelte';
	import CallToAction from '$lib/components/CallToAction.svelte';
	import JobBoard from '$lib/components/JobBoard.svelte';
	import { getContent } from '$lib/content';
	import { getStartupJobs, seedStartupJobs, type AnyJob } from '$lib/utils/jobPostings';

	const content = getContent();

	const page = content.pages.startupJobs;
	const ctaContent = content.cta.apply;

	// The seed posts render immediately so the board is never blank on first paint;
	// the live postings replace them once the query comes back.
	let posts = $state<AnyJob[]>(seedStartupJobs());

	onMount(async () => {
		posts = await getStartupJobs();
	});
</script>

<svelte:head>
	<title>{page.title}</title>
</svelte:head>

<JobBoard {page} {posts} searchLabel="Search open roles at incubated startups" />

<CallToAction
	eyebrow={ctaContent.eyebrow}
	headlineLead={ctaContent.headlineLead}
	headlineEmphasis={ctaContent.headlineEmphasis}
	label={ctaContent.label}
	href={ctaContent.href}
/>
