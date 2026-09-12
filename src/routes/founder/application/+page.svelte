<script lang="ts">
	import FounderShell from '$lib/components/FounderShell.svelte';
	import ApplicationWizard from '$lib/components/ApplicationWizard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The application is the one part of the console that does not wait on
	// verification — it is how a startup gets verified in the first place — so it
	// renders whatever standing the account has.
</script>

<svelte:head>
	<title>Founder Console · Application</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	title="Incubation application"
	eyebrow="Apply"
	alwaysAvailable
>
	<ApplicationWizard embedded />
</FounderShell>
