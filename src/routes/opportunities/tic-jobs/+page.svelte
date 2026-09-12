<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import JobBoard from '$lib/components/JobBoard.svelte';
	import { getContent } from '$lib/content';
	import { ticJobs } from '$lib/utils/jobPostings';

	const content = getContent();

	const page = content.pages.ticJobs;
	const ctaContent = content.cta.apply;

	// The centre's own openings are curated content, not company-submitted
	// postings, so they come from the admin console rather than the jobs table.
	const posts = ticJobs();
</script>

<svelte:head>
	<title>{page.title}</title>
</svelte:head>

<JobBoard {page} {posts} searchLabel="Search open roles at the centre" />

<CallToAction
	eyebrow={ctaContent.eyebrow}
	headlineLead={ctaContent.headlineLead}
	headlineEmphasis={ctaContent.headlineEmphasis}
	label={ctaContent.label}
	href={ctaContent.href}
/>
