<script lang="ts">
	import { phoneInput } from '$lib/utils/phone';
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const company = $derived(data.company);
	const isOwner = $derived(
		data.companies.find((c) => c.id === data.activeCompanyId)?.relation === 'owner'
	);

	type PendingChange = {
		id: string;
		changes: Record<string, { from: string; to: string }>;
		created_at: string;
	} | null;

	const pending = $derived(data.pendingChange as PendingChange);

	const LABEL: Record<string, string> = {
		companyName: 'Company name',
		website: 'Website',
		contactName: 'Contact person',
		contactEmail: 'Contact email',
		phone: 'Phone'
	};

	// Seeded once: these fields are a draft of a change request from the moment
	// the page opens, so a reload of the layout data must not overwrite them.
	const loaded = untrack(() => data.company);

	let companyName = $state(loaded?.companyName ?? '');
	let website = $state(loaded?.website ?? '');
	let contactName = $state(loaded?.contactName ?? '');
	let contactEmail = $state(loaded?.contactEmail ?? '');
	let phone = $state(loaded?.phone ?? '');
	let saving = $state(false);
	let saveError = $state('');

	async function requestChange(e: Event) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/api/founder/profile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					companyId: data.activeCompanyId,
					companyName,
					website,
					contactName,
					contactEmail,
					phone
				})
			});
			const body = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
				message?: string;
			};
			if (!res.ok || !body.ok) {
				saveError = body.error ?? body.message ?? 'Could not send the request.';
				return;
			}
			showToast('Sent to TIC for approval.', 'ok');
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function withdraw() {
		if (!pending) return;
		const ok = await askConfirm({
			title: 'Withdraw this request?',
			body: 'The pending change is discarded and your company details stay as they are.',
			confirmLabel: 'Withdraw',
			tone: 'danger'
		});
		if (!ok) return;

		const res = await fetch(
			`/api/founder/profile?companyId=${data.activeCompanyId}&id=${pending.id}`,
			{ method: 'DELETE' }
		);
		if (!res.ok) {
			showToast('Could not withdraw the request.', 'err');
			return;
		}
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Founder Console · Company</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Company"
	eyebrow="Your details"
>
	{#if pending}
		<div class="note" role="status">
			<p class="note__title">A change is waiting for TIC</p>
			<ul class="diff">
				{#each Object.entries(pending.changes) as [field, change] (field)}
					<li>
						<span class="diff__label">{LABEL[field] ?? field}</span>
						<span class="diff__from">{change.from || '—'}</span>
						<span class="diff__arrow" aria-hidden="true">→</span>
						<span class="diff__to">{change.to || '—'}</span>
					</li>
				{/each}
			</ul>
			{#if isOwner}
				<button type="button" class="link" onclick={withdraw}>Withdraw this request</button>
			{/if}
		</div>
	{/if}

	<section class="card">
		<h2 class="card__title">Company details</h2>
		<p class="card__sub">
			These appear next to every role you post, so a change to them is a change to the public site.
			TIC reads each one before it takes effect — your details stay exactly as they are until then.
		</p>

		<form onsubmit={requestChange} novalidate>
			<label class="field">
				<span>Company name</span>
				<input type="text" bind:value={companyName} disabled={!isOwner} required />
			</label>
			<label class="field">
				<span>Website</span>
				<input type="url" bind:value={website} disabled={!isOwner} placeholder="https://" />
			</label>
			<label class="field">
				<span>Contact person</span>
				<input type="text" bind:value={contactName} disabled={!isOwner} />
			</label>
			<label class="field">
				<span>Contact email</span>
				<input type="email" bind:value={contactEmail} disabled={!isOwner} />
			</label>
			<label class="field">
				<span>Phone</span>
				<input type="tel" bind:value={phone} disabled={!isOwner} use:phoneInput />
			</label>

			{#if saveError}
				<p class="error" role="alert">{saveError}</p>
			{/if}

			{#if isOwner}
				<button type="submit" class="btn-primary" disabled={saving}>
					{saving ? 'Sending…' : 'Send change for approval'}
				</button>
			{:else}
				<p class="quiet">
					Only the account that registered {company?.companyName ?? 'this company'} can change these.
				</p>
			{/if}
		</form>
	</section>
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.note {
		@include admin-panel;
		padding: 16px 18px;
		margin-bottom: 18px;
		border-left: 3px solid admin-tone-fg('warn');
		max-width: 620px;
	}

	.note__title {
		margin: 0 0 10px;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.diff {
		list-style: none;
		margin: 0 0 12px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;

		li {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 8px;
			font-size: 13px;
			color: $admin-ink-2;
		}
	}

	.diff__label {
		min-width: 120px;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.diff__from {
		text-decoration: line-through;
		color: $admin-ink-3;
	}

	.diff__to {
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.card {
		@include admin-card;
		max-width: 620px;
		margin-bottom: 18px;
	}

	.card__title {
		@include admin-section-title;
		margin: 0;
	}

	.card__sub {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: flex-start;
		width: 100%;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;

		> span {
			@include admin-field-label;
		}

		input {
			@include admin-input;

			&:disabled {
				background: $admin-sunken;
				color: $admin-ink-3;
				cursor: not-allowed;
			}
		}
	}

	.error {
		@include admin-msg-err;
	}

	.quiet {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.link {
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		cursor: pointer;
		@include admin-focus-ring($admin-accent);
	}

	.btn-primary {
		@include admin-btn-primary;
	}
</style>
