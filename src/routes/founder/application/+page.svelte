<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import ApplicationWizard from '$lib/components/ApplicationWizard.svelte';
	import ApplicationRecord from '$lib/components/ApplicationRecord.svelte';
	import GoogleMeetLogo from '$lib/components/GoogleMeetLogo.svelte';
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

	{#if data.screening}
		<section class="screening">
			<div>
				<p class="screening__eyebrow">Screening call</p>
				<h2 class="screening__title">You are invited to talk with our coordinators</h2>
				{#if data.screening.meetAt}
					<p class="screening__when">
						{new Date(data.screening.meetAt).toLocaleString('en-GB', {
							weekday: 'long',
							day: 'numeric',
							month: 'long',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						})}
					</p>
				{/if}
			</div>
			<!-- An external Google Meet URL, not an app route. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a class="join" href={data.screening.meetUrl} target="_blank" rel="noopener noreferrer">
				<GoogleMeetLogo size={22} />
				<span>Join Google Meet</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</section>
	{/if}

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
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.screening {
		@include admin-card;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		max-width: 860px;
		margin-bottom: 18px;
		border-left: 3px solid #00ac47;
	}

	.screening__eyebrow {
		margin: 0 0 4px;
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.screening__title {
		margin: 0;
		font-size: 16px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.screening__when {
		margin: 4px 0 0;
		font-size: 13px;
		color: $admin-ink-2;
	}

	.join {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 18px;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		text-decoration: none;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: 999px;
	}

	.apply-again {
		@include admin-btn-primary;
	}
</style>
