<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const companies = $derived(data.companies);

	const STATUS: Record<string, { label: string; tone: string }> = {
		pending: { label: 'Waiting for TIC', tone: 'warn' },
		verified: { label: 'Verified', tone: 'good' },
		rejected: { label: 'Not verified', tone: 'bad' }
	};

	let adding = $state(false);
	let companyName = $state('');
	let website = $state('');
	// Seeded once from the account, then owned by whoever is typing.
	let contactName = $state(untrack(() => data.founder.name));
	let contactEmail = $state(untrack(() => data.founder.email));
	let phone = $state('');
	let submitting = $state(false);
	let formError = $state('');

	async function create(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		formError = '';
		try {
			const res = await fetch('/api/founder/companies', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ companyName, website, contactName, contactEmail, phone })
			});
			const body = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
				message?: string;
			};
			if (!res.ok || !body.ok) {
				formError = body.error ?? body.message ?? 'Could not register the startup.';
				return;
			}
			showToast('Registered. TIC verifies it before anything goes public.', 'ok');
			companyName = '';
			website = '';
			phone = '';
			adding = false;
			await invalidateAll();
		} finally {
			submitting = false;
		}
	}

	async function switchTo(id: string) {
		await fetch('/api/founder/companies', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ companyId: id })
		});
		await invalidateAll();
	}

	async function remove(id: string, name: string) {
		const ok = await askConfirm({
			title: `Delete ${name}?`,
			body: 'Every role it posted comes off the board and its team loses access. Applicants and any incubation application stay with TIC. This cannot be undone.',
			confirmLabel: 'Delete startup',
			tone: 'danger'
		});
		if (!ok) return;

		const res = await fetch(`/api/founder/companies?id=${id}`, { method: 'DELETE' });
		if (!res.ok) {
			showToast('Could not delete it.', 'err');
			return;
		}
		showToast('Deleted.', 'ok');
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Founder Console · Startups</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Startups"
	eyebrow="Your companies"
	alwaysAvailable
>
	<p class="lede">
		A startup you register here is yours. Register as many as you run — each one keeps its own
		incubation application, job postings, applicants and team, and the switcher at the top of every
		page says which one you are looking at. TIC verifies each startup before it can put anything in
		front of the public.
	</p>

	<div class="head">
		<button class="btn-primary" onclick={() => (adding = !adding)}>
			{adding ? 'Cancel' : 'Register a startup'}
		</button>
	</div>

	{#if adding}
		<form class="card" onsubmit={create} novalidate>
			<label class="field">
				<span>Startup name</span>
				<input
					type="text"
					bind:value={companyName}
					placeholder="e.g. Northeast Robotics"
					required
				/>
			</label>
			<label class="field">
				<span>Website <em>optional</em></span>
				<input type="url" bind:value={website} placeholder="https://" />
			</label>
			<label class="field">
				<span>Contact person</span>
				<input type="text" bind:value={contactName} required />
			</label>
			<label class="field">
				<span>Contact email</span>
				<input type="email" bind:value={contactEmail} required />
			</label>
			<label class="field">
				<span>Phone</span>
				<input type="tel" bind:value={phone} required />
			</label>

			{#if formError}
				<p class="error" role="alert">{formError}</p>
			{/if}

			<div class="actions">
				<button type="submit" class="btn-primary" disabled={submitting}>
					{submitting ? 'Registering…' : 'Register'}
				</button>
				<button type="button" class="btn" onclick={() => (adding = false)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if companies.length === 0}
		<div class="empty">
			<p>Nothing registered yet. The button above is where a startup starts.</p>
		</div>
	{:else}
		<ul class="list">
			{#each companies as company (company.id)}
				<li class="item" class:item--active={company.id === data.activeCompanyId}>
					<div class="item__body">
						<p class="item__name">
							{company.name}
							{#if company.id === data.activeCompanyId}
								<span class="item__current">in view</span>
							{/if}
						</p>
						<p class="item__meta">
							<span class="badge badge--{STATUS[company.status].tone}">
								{STATUS[company.status].label}
							</span>
							{#if company.relation === 'member'}
								<span class="item__note">You were added to this one</span>
							{/if}
						</p>
					</div>

					<div class="item__actions">
						{#if company.id !== data.activeCompanyId}
							<button class="btn-small" onclick={() => switchTo(company.id)}>Work on this</button>
						{:else}
							<a class="btn-small" href={resolve('/founder/settings')}>Details</a>
						{/if}
						{#if company.relation === 'owner'}
							<button class="link link--danger" onclick={() => remove(company.id, company.name)}>
								Delete
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.lede {
		margin: 0 0 16px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 76ch;
	}

	.head {
		margin-bottom: 16px;
	}

	.card {
		@include admin-card;
		max-width: 520px;
		margin-bottom: 18px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		em {
			font-style: normal;
			font-weight: $font-weight-regular;
			text-transform: none;
			letter-spacing: 0;
			color: $admin-ink-3;
		}

		input {
			@include admin-input;
		}
	}

	.error {
		@include admin-msg-err;
	}

	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.empty {
		@include admin-empty;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.item {
		@include admin-panel;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 16px 18px;
		flex-wrap: wrap;

		&--active {
			border-left: 3px solid $admin-ink;
		}
	}

	.item__body {
		min-width: 0;
	}

	.item__name {
		@include admin-cell-name;
		font-size: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.item__current {
		font-size: 10px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.item__meta {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 8px 0 0;
		flex-wrap: wrap;
	}

	.item__note {
		font-size: 12px;
		color: $admin-ink-3;
	}

	.item__actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.badge {
		@include admin-badge;

		&--good {
			@include admin-badge-tone('good');
		}
		&--warn {
			@include admin-badge-tone('warn');
		}
		&--bad {
			@include admin-badge-tone('bad');
		}
	}

	.btn-small {
		@include admin-btn-small;
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

		&--danger {
			color: admin-tone-fg('bad');
		}
	}

	.btn-primary {
		@include admin-btn-primary;
	}

	.btn {
		@include admin-btn-base;
	}
</style>
