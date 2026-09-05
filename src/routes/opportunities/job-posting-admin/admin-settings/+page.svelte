<script lang="ts">
	import { goto } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { COMPANY_PORTAL_NAV } from '$lib/utils/companyNav';
	import {
		changePassword,
		deleteCurrentCompany,
		getCurrentCompany,
		logoutCompany,
		updateCurrentCompany,
		type CompanyAccount
	} from '$lib/utils/companyAuth';
	import { onMount } from 'svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';

	let mounted = $state(false);
	let account = $state<CompanyAccount | null>(null);

	let companyName = $state('');
	let contactName = $state('');
	let website = $state('');

	let currentPw = $state('');
	let newPw = $state('');
	let confirmPw = $state('');

	onMount(async () => {
		account = await getCurrentCompany();
		if (!account) {
			goto('/opportunities/job-posting-admin');
			return;
		}
		companyName = account.companyName;
		contactName = account.contactName;
		website = account.website;
		mounted = true;
	});

	async function handleProfile(e: Event) {
		e.preventDefault();
		const updated = await updateCurrentCompany({ companyName, contactName, website });
		if (!updated) {
			showToast('Could not update profile.', 'err');
			return;
		}
		account = updated;
		showToast('Profile saved.');
	}

	async function handlePassword(e: Event) {
		e.preventDefault();
		if (newPw !== confirmPw) {
			showToast('New passwords do not match.', 'err');
			return;
		}
		const result = await changePassword(currentPw, newPw);
		if (!result.ok) {
			showToast(result.error, 'err');
			return;
		}
		currentPw = '';
		newPw = '';
		confirmPw = '';
		showToast('Password updated.');
	}

	async function handleDelete() {
		const ok = await askConfirm({
			title: 'Delete this company account?',
			body: 'Your posted roles are removed with it. This cannot be undone.',
			confirmLabel: 'Delete account',
			tone: 'danger'
		});
		if (!ok) return;
		const removed = await deleteCurrentCompany();
		if (!removed) {
			showToast('Could not delete the account. Please try again.', 'err');
			return;
		}
		goto('/opportunities/job-posting-admin');
	}

	async function handleLogout() {
		await logoutCompany();
		goto('/opportunities/job-posting-admin');
	}
</script>

<svelte:head>
	<title>Account settings · IITG TIC</title>
</svelte:head>

{#if mounted && account}
	<AdminShell
		brand="Company portal"
		brandSub={account.companyName}
		navItems={COMPANY_PORTAL_NAV}
		title="Account settings"
		eyebrow="Settings"
		user={account.companyName}
		onLogout={handleLogout}
	>
		<div class="grid">
			<form class="card" onsubmit={handleProfile} novalidate>
				<header class="card__head">
					<h2>Company profile</h2>
					<p class="card__sub">
						Email <strong>{account.email}</strong> · cannot be changed
					</p>
				</header>

				<label class="field">
					<span>Company name</span>
					<input type="text" bind:value={companyName} required />
				</label>

				<label class="field">
					<span>Contact person</span>
					<input type="text" bind:value={contactName} />
				</label>

				<label class="field">
					<span>Website</span>
					<input type="url" bind:value={website} placeholder="https://" />
				</label>

				<button type="submit" class="btn-primary">Save profile</button>
			</form>

			<form class="card" onsubmit={handlePassword} novalidate>
				<header class="card__head">
					<h2>Change password</h2>
					<p class="card__sub">Use at least 6 characters.</p>
				</header>

				<label class="field">
					<span>Current password</span>
					<input type="password" bind:value={currentPw} autocomplete="current-password" required />
				</label>

				<label class="field">
					<span>New password</span>
					<input type="password" bind:value={newPw} autocomplete="new-password" required />
				</label>

				<label class="field">
					<span>Confirm new password</span>
					<input type="password" bind:value={confirmPw} autocomplete="new-password" required />
				</label>

				<button type="submit" class="btn-primary">Update password</button>
			</form>

			<div class="card card--danger">
				<header class="card__head">
					<h2>Delete account</h2>
					<p class="card__sub">
						Permanently remove this company account and all roles you have posted. This cannot be
						undone.
					</p>
				</header>
				<button type="button" class="btn-danger" onclick={handleDelete}>Delete account</button>
			</div>
		</div>
	</AdminShell>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.grid {
		display: grid;
		gap: 18px;
		max-width: 680px;
	}

	.card {
		@include admin-card;

		&--danger {
			border-color: #f5c2c2;
		}
	}

	.card__head {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 4px;
	}

	h2 {
		@include admin-section-title;
	}

	.card__sub {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;

		strong {
			color: #333;
			font-weight: $font-weight-semibold;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		input {
			@include admin-input;
		}
	}

	.btn-primary {
		@include admin-btn-primary;
		align-self: flex-start;
	}

	.btn-danger {
		@include admin-btn-danger;
		align-self: flex-start;
	}
</style>
