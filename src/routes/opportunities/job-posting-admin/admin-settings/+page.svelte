<script lang="ts">
	import { goto } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import {
		changePassword,
		deleteCurrentCompany,
		getCurrentCompany,
		logoutCompany,
		updateCurrentCompany,
		type CompanyAccount
	} from '$lib/utils/companyAuth';
	import { onMount } from 'svelte';

	const navItems = [
		{ label: 'Dashboard', href: '/opportunities/job-posting-admin' },
		{ label: 'Post a role', href: '/opportunities/job-posting-admin/edit/new' },
		{ label: 'Account settings', href: '/opportunities/job-posting-admin/admin-settings' }
	];

	let mounted = $state(false);
	let account = $state<CompanyAccount | null>(null);

	let companyName = $state('');
	let contactName = $state('');
	let website = $state('');
	let profileMsg = $state<{ tone: 'ok' | 'err'; text: string } | null>(null);

	let currentPw = $state('');
	let newPw = $state('');
	let confirmPw = $state('');
	let pwMsg = $state<{ tone: 'ok' | 'err'; text: string } | null>(null);

	onMount(() => {
		account = getCurrentCompany();
		if (!account) {
			goto('/opportunities/job-posting-admin');
			return;
		}
		companyName = account.companyName;
		contactName = account.contactName;
		website = account.website;
		mounted = true;
	});

	function handleProfile(e: Event) {
		e.preventDefault();
		const updated = updateCurrentCompany({ companyName, contactName, website });
		if (!updated) {
			profileMsg = { tone: 'err', text: 'Could not update profile.' };
			return;
		}
		account = updated;
		profileMsg = { tone: 'ok', text: 'Profile saved.' };
	}

	function handlePassword(e: Event) {
		e.preventDefault();
		if (newPw !== confirmPw) {
			pwMsg = { tone: 'err', text: 'New passwords do not match.' };
			return;
		}
		const result = changePassword(currentPw, newPw);
		if (!result.ok) {
			pwMsg = { tone: 'err', text: result.error };
			return;
		}
		currentPw = '';
		newPw = '';
		confirmPw = '';
		pwMsg = { tone: 'ok', text: 'Password updated.' };
	}

	function handleDelete() {
		if (
			!confirm(
				'Delete this company account? Your posted roles will be removed and this cannot be undone.'
			)
		)
			return;
		deleteCurrentCompany();
		goto('/opportunities/job-posting-admin');
	}

	function handleLogout() {
		logoutCompany();
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
		{navItems}
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

				{#if profileMsg}
					<p class="msg" class:msg--ok={profileMsg.tone === 'ok'} class:msg--err={profileMsg.tone === 'err'}>
						{profileMsg.text}
					</p>
				{/if}

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

				{#if pwMsg}
					<p class="msg" class:msg--ok={pwMsg.tone === 'ok'} class:msg--err={pwMsg.tone === 'err'}>
						{pwMsg.text}
					</p>
				{/if}

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
		color: #777;

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

	.msg {
		&--ok {
			@include admin-msg-ok;
		}

		&--err {
			@include admin-msg-err;
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
