<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import ApplicationWizard from '$lib/components/ApplicationWizard.svelte';
	import ApplicationRecord from '$lib/components/ApplicationRecord.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The application is the one part of the console that does not wait on
	// verification — it is how a startup gets verified in the first place — so it
	// renders whatever standing the account has.
	//
	// Once the startup in view has applied, the page shows what it sent instead of
	// the form; the loader only hands back no application when there is none, or
	// when a declined startup has chosen to apply again.

	// Switching startup inside the wizard switches the whole console, so the
	// company in the shell's own switcher never disagrees with the one applying.
	async function switchCompany(id: string) {
		const res = await fetch('/api/founder/companies', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ companyId: id })
		});
		if (!res.ok) {
			showToast('Could not switch startup.', 'err');
			return;
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Founder Console · Application</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Incubation application"
	eyebrow="Apply"
	alwaysAvailable
>
	{#snippet pageActions()}
		{#if data.application?.status === 'rejected'}
			<!-- A query string on this route, which resolve() cannot express. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="apply-again" href={`${resolve('/founder/application')}?new`}>Apply again</a>
		{/if}
	{/snippet}

	{#if data.application}
		<ApplicationRecord application={data.application} documents={data.documents} />
	{:else}
		<ApplicationWizard
			embedded
			companies={data.companies}
			companyId={data.activeCompanyId}
			onCompanyChange={switchCompany}
		/>
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/admin' as *;

	.apply-again {
		@include admin-btn-primary;
	}
</style>
