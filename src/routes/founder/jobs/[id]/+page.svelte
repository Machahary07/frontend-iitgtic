<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import Select from '$lib/components/Select.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type JobRow = {
		id: string;
		role: string;
		company: string;
		location: string;
		type: string;
		sector: string;
		description: string;
		apply_link: string;
		status: 'pending' | 'approved' | 'rejected';
		review_note: string | null;
	};

	const existing = $derived(data.job as JobRow | null);

	// The form is seeded once and then owned by whoever is typing in it, so the
	// loaded row is read outside reactivity — re-seeding mid-edit would throw away
	// what they had written.
	const loaded = untrack(() => data.job as JobRow | null);

	let role = $state(loaded?.role ?? '');
	let company = $state(loaded?.company ?? untrack(() => data.defaultCompanyName));
	let location = $state(loaded?.location ?? '');
	let type = $state(loaded?.type ?? 'Full-time');
	let sector = $state(loaded?.sector ?? '');
	let description = $state(loaded?.description ?? '');
	let applyLink = $state(loaded?.apply_link ?? '');
	let submitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		try {
			const payload = {
				companyId: data.activeCompanyId,
				role,
				company,
				location,
				type,
				sector,
				description,
				applyLink
			};
			const res = await fetch('/api/founder/jobs', {
				method: data.isNew ? 'POST' : 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(data.isNew ? payload : { ...payload, id: existing?.id })
			});
			const body = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
				message?: string;
			};
			if (!res.ok || !body.ok) {
				showToast(body.error ?? body.message ?? 'Could not save the role.', 'err');
				return;
			}
			showToast('Sent to TIC for approval.', 'ok');
			await goto(resolve('/founder/jobs'));
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{data.isNew ? 'Post a role' : 'Edit role'} · Founder Console</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title={data.isNew ? 'Post a role' : 'Edit role'}
	eyebrow={data.isNew ? 'New posting' : 'Editing'}
	requiresVerifiedCompany
>
	{#if existing?.status === 'rejected' && existing.review_note}
		<div class="note" role="alert">
			<p class="note__title">TIC sent this back</p>
			<p>{existing.review_note}</p>
		</div>
	{/if}

	<form class="card" onsubmit={handleSubmit} novalidate>
		<p class="card__sub">
			{#if data.isNew}
				Nothing here is public yet. A TIC admin reads the posting first, and it appears on the
				Opportunities board once they approve it.
			{:else if existing?.status === 'approved'}
				This role is live. Saving an edit takes it off the public board and back into the approval
				queue until TIC approves the new version.
			{:else}
				This role is already in the approval queue. Saving replaces what TIC will read.
			{/if}
		</p>

		<label class="field">
			<span>Role title</span>
			<input type="text" bind:value={role} placeholder="e.g. Embedded Firmware Engineer" required />
		</label>

		<label class="field">
			<span>Company name (shown to applicants)</span>
			<input type="text" bind:value={company} required />
		</label>

		<div class="row">
			<div class="field">
				<span class="field__label" id="job-type-label">Type</span>
				<Select
					id="job-type"
					bind:value={type}
					options={[
						{ value: 'Full-time', label: 'Full-time' },
						{ value: 'Internship', label: 'Internship' }
					]}
					ariaLabel="Type of role"
				/>
			</div>

			<label class="field">
				<span>Location</span>
				<input type="text" bind:value={location} placeholder="e.g. Guwahati · hybrid" required />
			</label>
		</div>

		<label class="field">
			<span>Sector / domain</span>
			<input type="text" bind:value={sector} placeholder="e.g. Agricultural automation" required />
		</label>

		<label class="field">
			<span>Role description</span>
			<textarea
				bind:value={description}
				rows="6"
				placeholder="What the person will work on. Two or three sentences is plenty."
				required
			></textarea>
		</label>

		<label class="field">
			<span>Apply link (URL or mailto:)</span>
			<input
				type="text"
				bind:value={applyLink}
				placeholder="mailto:hiring@yourco.com  or  https://yourco.com/careers/role"
				required
			/>
		</label>

		<div class="actions">
			<button type="submit" class="btn-primary" disabled={submitting}>
				{submitting ? 'Sending…' : 'Send for approval'}
			</button>
			<a class="btn" href={resolve('/founder/jobs')}>Cancel</a>
		</div>
	</form>
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.note {
		@include admin-panel;
		padding: 16px 18px;
		margin-bottom: 16px;
		border-left: 3px solid admin-tone-fg('bad');
		max-width: 680px;

		p {
			margin: 0;
			font-size: 13px;
			line-height: 1.6;
			color: $admin-ink-2;
		}
	}

	.note__title {
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		margin-bottom: 4px;
	}

	.card {
		@include admin-card;
		max-width: 680px;
	}

	.card__sub {
		margin: 0;
		font-size: 13px;
		color: $admin-ink-2;
		line-height: 1.5;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		input,
		textarea {
			@include admin-input;
		}

		textarea {
			resize: vertical;
			min-height: 120px;
			font-family: $font-family-base;
		}
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 4px;
		flex-wrap: wrap;
	}

	.btn-primary {
		@include admin-btn-primary;
	}

	.btn {
		@include admin-btn-base;
		text-decoration: none;
	}
</style>
