<script lang="ts">
	import StartupProfile from '$lib/components/startup/StartupProfile.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.startup.name} · {data.category.title} · IITG TIC</title>
</svelte:head>

<StartupProfile startup={data.startup} category={data.category} />
