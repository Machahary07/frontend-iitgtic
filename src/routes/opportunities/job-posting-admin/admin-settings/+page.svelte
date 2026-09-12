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
	let contactEmail = $state('');
	let phone = $state('');
	let website = $state('');

	let currentPw = $state('');
	let newPw = $state('');
	let confirmPw = $state('');
	let showCurrentPw = $state(false);
	let showNewPw = $state(false);
	let showConfirmPw = $state(false);

	onMount(async () => {
		account = await getCurrentCompany();
		if (!account) {
			goto('/opportunities/job-posting-admin');
			return;
		}
		companyName = account.companyName;
		contactName = account.contactName;
		contactEmail = account.contactEmail;
		phone = account.phone;
		website = account.website;
		mounted = true;
	});

	async function handleProfile(e: Event) {
		e.preventDefault();
		const updated = await updateCurrentCompany({
			companyName,
			contactName,
			contactEmail,
			phone,
			website
		});
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

{#snippet eyeIcon(shown: boolean)}
	{#if shown}
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	{/if}
{/snippet}

{#if mounted && account}
	<AdminShell
		brand="Company portal"
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
						Sign-in email <strong>{account.email}</strong> · cannot be changed
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
					<span>Contact person email</span>
					<input type="email" bind:value={contactEmail} autocomplete="email" />
				</label>

				<label class="field">
					<span>Phone number</span>
					<input type="tel" bind:value={phone} autocomplete="tel" />
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
					<div class="field__control">
						<input
							type={showCurrentPw ? 'text' : 'password'}
							value={currentPw}
							oninput={(e) => (currentPw = e.currentTarget.value)}
							autocomplete="current-password"
							required
						/>
						<button
							type="button"
							class="reveal-toggle"
							onclick={() => (showCurrentPw = !showCurrentPw)}
							aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
							aria-pressed={showCurrentPw}
						>
							{@render eyeIcon(showCurrentPw)}
						</button>
					</div>
				</label>

				<label class="field">
					<span>New password</span>
					<div class="field__control">
						<input
							type={showNewPw ? 'text' : 'password'}
							value={newPw}
							oninput={(e) => (newPw = e.currentTarget.value)}
							autocomplete="new-password"
							required
						/>
						<button
							type="button"
							class="reveal-toggle"
							onclick={() => (showNewPw = !showNewPw)}
							aria-label={showNewPw ? 'Hide password' : 'Show password'}
							aria-pressed={showNewPw}
						>
							{@render eyeIcon(showNewPw)}
						</button>
					</div>
				</label>

				<label class="field">
					<span>Confirm new password</span>
					<div class="field__control">
						<input
							type={showConfirmPw ? 'text' : 'password'}
							value={confirmPw}
							oninput={(e) => (confirmPw = e.currentTarget.value)}
							autocomplete="new-password"
							required
						/>
						<button
							type="button"
							class="reveal-toggle"
							onclick={() => (showConfirmPw = !showConfirmPw)}
							aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
							aria-pressed={showConfirmPw}
						>
							{@render eyeIcon(showConfirmPw)}
						</button>
					</div>
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

	.field__control {
		position: relative;
		display: flex;
		align-items: center;

		input {
			flex: 1;
			padding-right: 40px;
		}
	}

	.reveal-toggle {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: 0;
		color: $admin-ink-3;
		cursor: pointer;

		svg {
			display: block;
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
