<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { getCurrentCompany, logoutCompany, type CompanyAccount } from '$lib/utils/companyAuth';
	import {
		createJob,
		getMyJobById,
		updateJob,
		type JobInput,
		type PostedJob
	} from '$lib/utils/jobPostings';
	import { onMount } from 'svelte';

	const navItems = [
		{ label: 'Dashboard', href: '/opportunities/job-posting-admin' },
		{ label: 'Post a role', href: '/opportunities/job-posting-admin/edit/new' },
		{ label: 'Account settings', href: '/opportunities/job-posting-admin/admin-settings' }
	];

	const id = $derived(page.params.id ?? '');
	const isNew = $derived(id === 'new' || id === '');

	let mounted = $state(false);
	let account = $state<CompanyAccount | null>(null);
	let existing = $state<PostedJob | null>(null);

	let role = $state('');
	let company = $state('');
	let location = $state('');
	let type = $state<string>('Full-time');
	let sector = $state('');
	let description = $state('');
	let applyLink = $state('');
	let error = $state('');

	onMount(async () => {
		account = await getCurrentCompany();
		if (!account) {
			goto('/opportunities/job-posting-admin');
			return;
		}
		if (account.status !== 'verified') {
			goto('/opportunities/job-posting-admin');
			return;
		}
		if (!isNew) {
			existing = await getMyJobById(id, account.id);
			if (!existing) {
				goto('/opportunities/job-posting-admin');
				return;
			}
			role = existing.role;
			company = existing.company;
			location = existing.location;
			type = existing.type;
			sector = existing.sector;
			description = existing.description;
			applyLink = existing.applyLink;
		} else {
			company = account.companyName;
		}
		mounted = true;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!account) return;
		const payload: JobInput = {
			role,
			company,
			companySlug: account.companySlug,
			location,
			type,
			sector,
			description,
			applyLink
		};
		const result = isNew
			? await createJob(account.id, payload)
			: await updateJob(id, account.id, payload);
		if (!result.ok) {
			error = result.error;
			return;
		}
		error = '';
		goto('/opportunities/job-posting-admin');
	}

	async function handleLogout() {
		await logoutCompany();
		goto('/opportunities/job-posting-admin');
	}
</script>

<svelte:head>
	<title>{isNew ? 'Post role' : 'Edit role'} · IITG TIC</title>
</svelte:head>

{#if mounted && account}
	<AdminShell
		brand="Company portal"
		brandSub={account.companyName}
		{navItems}
		title={isNew ? 'Post a new role' : 'Edit role'}
		eyebrow={isNew ? 'New role' : 'Editing'}
		user={account.companyName}
		onLogout={handleLogout}
	>
		<form class="card" onsubmit={handleSubmit} novalidate>
			<p class="card__sub">
				These details show up on the public Opportunities page and on the role's own detail URL.
			</p>

			<label class="field">
				<span>Role title</span>
				<input
					type="text"
					bind:value={role}
					placeholder="e.g. Embedded Firmware Engineer"
					required
				/>
			</label>

			<label class="field">
				<span>Company name (shown to applicants)</span>
				<input type="text" bind:value={company} required />
			</label>

			<div class="row">
				<label class="field">
					<span>Type</span>
					<select bind:value={type}>
						<option value="Full-time">Full-time</option>
						<option value="Internship">Internship</option>
					</select>
				</label>

				<label class="field">
					<span>Location</span>
					<input type="text" bind:value={location} placeholder="e.g. Guwahati · hybrid" required />
				</label>
			</div>

			<label class="field">
				<span>Sector / domain</span>
				<input
					type="text"
					bind:value={sector}
					placeholder="e.g. Agricultural automation"
					required
				/>
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

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<div class="actions">
				<button type="submit" class="btn-primary">
					{isNew ? 'Publish role' : 'Save changes'}
				</button>
				<a class="btn" href="/opportunities/job-posting-admin">Cancel</a>
			</div>
		</form>
	</AdminShell>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.card {
		@include admin-card;
		max-width: 680px;
	}

	.card__sub {
		margin: 0;
		font-size: 13px;
		color: #666;
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
		select,
		textarea {
			@include admin-input;
		}

		select {
			cursor: pointer;
		}

		textarea {
			resize: vertical;
			min-height: 120px;
			font-family: $font-family-base;
		}
	}

	.error {
		@include admin-msg-err;
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
	}
</style>
