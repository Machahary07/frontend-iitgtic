<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import ProfileEditor from '$lib/components/startup/ProfileEditor.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import { missingForReview, type StartupProfileData } from '$lib/utils/startupProfile';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const profile = $derived(data.profile);
	const isOwner = $derived(data.relation === 'owner');
	const inReview = $derived(profile?.status === 'in_review');

	// Seeded once, so a reload of the page data does not wipe unsaved typing.
	let draft = $state<StartupProfileData | null>(
		untrack(() => (data.profile ? structuredClone(data.profile.draft) : null))
	);
	let busy = $state('');

	const missing = $derived(draft ? missingForReview(draft) : []);
	const STAGE: Record<string, string> = {
		current: 'Current incubatee',
		graduated: 'Graduated',
		exited: 'Not listed'
	};

	async function call(method: 'PUT' | 'POST', body: Record<string, unknown>) {
		const res = await fetch('/api/founder/startup-profile', {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ companyId: data.activeCompanyId, ...body })
		});
		if (!res.ok) {
			const b = (await res.json().catch(() => ({}))) as { message?: string };
			showToast(b.message ?? 'Something went wrong.', 'err');
			return false;
		}
		return true;
	}

	async function save() {
		busy = 'save';
		const ok = await call('PUT', { draft });
		busy = '';
		if (ok) {
			showToast('Draft saved.');
			await invalidateAll();
		}
		return ok;
	}

	async function submit() {
		if (!(await save())) return;
		busy = 'submit';
		const ok = await call('POST', { action: 'submit' });
		busy = '';
		if (ok) {
			showToast('Sent to TIC for review.');
			await invalidateAll();
		}
	}

	async function withdraw() {
		busy = 'withdraw';
		if (await call('POST', { action: 'withdraw' })) await invalidateAll();
		busy = '';
	}

	async function upload(file: File): Promise<string | null> {
		const form = new FormData();
		form.set('companyId', data.activeCompanyId ?? '');
		form.set('file', file);
		const res = await fetch('/api/founder/startup-profile/upload', { method: 'POST', body: form });
		const b = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
		if (!res.ok || !b.url) {
			showToast(b.message ?? 'Could not upload that image.', 'err');
			return null;
		}
		return b.url;
	}
</script>

<svelte:head>
	<title>Founder Console · Public profile</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Public profile"
	eyebrow="On the TIC website"
	requiresVerifiedCompany
>
	{#if !profile || !draft}
		<section class="card">
			<h2>Your page on the TIC website</h2>
			<p>It opens here once TIC accepts your incubation application, filled in from what you sent.</p>
		</section>
	{:else}
		<section class="status">
			<div>
				<p class="status__line">
					<strong>{profile.listed ? STAGE[profile.stage] : 'Not on the website yet'}</strong>
					{#if profile.isVirtual && profile.stage === 'current'}· Virtual incubatee{/if}
				</p>
				<p class="status__sub">
					{#if inReview}
						TIC is reviewing your latest changes. Your live page stays as it is until they approve
						them.
					{:else if profile.status === 'sent_back'}
						TIC sent your profile back{profile.note ? `: “${profile.note}”` : '.'} Make the changes and
						send it again.
					{:else if profile.hasPublished}
						Changes you make here go live once TIC approves them.
					{:else}
						Fill it in, preview it, then send it to TIC. It goes on the website when TIC marks you
						live.
					{/if}
				</p>
			</div>
			<div class="status__acts">
				<!-- A preview route outside the console, opened in a new tab. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a class="btn" href={`/incubated-startups/preview/${profile.id}`} target="_blank" rel="noopener"
					>Preview</a
				>
				{#if isOwner}
					{#if inReview}
						<button class="btn" disabled={Boolean(busy)} onclick={withdraw}>Withdraw from review</button>
					{:else}
						<button class="btn" disabled={Boolean(busy)} onclick={save}
							>{busy === 'save' ? 'Saving…' : 'Save draft'}</button
						>
						<button
							class="btn btn--primary"
							disabled={Boolean(busy) || missing.length > 0}
							onclick={submit}
						>
							{busy === 'submit' ? 'Sending…' : 'Send to TIC for review'}
						</button>
					{/if}
				{/if}
			</div>
			{#if missing.length && !inReview}
				<p class="status__missing">Still needed before review: {missing.join(', ')}.</p>
			{/if}
		</section>

		{#if !isOwner}
			<p class="quiet">
				Only the account that registered {data.company?.companyName ?? 'this startup'} can edit the profile.
			</p>
		{/if}

		<ProfileEditor bind:value={draft} sectors={data.sectors} {upload} readonly={!isOwner || inReview} />
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.card,
	.status {
		@include admin-card;
		margin-bottom: 18px;
	}

	.card h2 {
		margin: 0 0 6px;
		font-size: 16px;
	}

	.card p {
		margin: 0;
		color: $admin-ink-2;
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 24px;
		align-items: center;
		justify-content: space-between;
	}

	.status__line {
		margin: 0;
		font-size: 15px;
		color: $admin-ink;
	}

	.status__sub {
		margin: 4px 0 0;
		max-width: 70ch;
		font-size: 13.5px;
		color: $admin-ink-2;
	}

	.status__acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.status__missing {
		flex-basis: 100%;
		margin: 0;
		font-size: 13px;
		color: $admin-ink-3;
	}

	.btn {
		@include admin-btn-base;
		text-decoration: none;
	}

	.btn--primary {
		@include admin-btn-primary;
	}

	.quiet {
		font-size: 13px;
		color: $admin-ink-3;
	}
</style>
