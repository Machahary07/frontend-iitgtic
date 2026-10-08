<script lang="ts">
	import { phoneInput } from '$lib/utils/phone';
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import { changePassword, deleteMyAccount } from '$lib/utils/accountActions';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ownsAny = $derived(data.companies.some((c) => c.relation === 'owner'));

	// Seeded once, so a reload of the layout data does not wipe what is being typed.
	const loaded = untrack(() => data.me);

	let fullName = $state(loaded.fullName);
	let phone = $state(loaded.phone);
	let saving = $state(false);
	let saveError = $state('');

	let currentPassword = $state('');
	let newPassword = $state('');
	let changingPassword = $state(false);
	let closing = $state(false);

	const missing = $derived(
		[!data.me.fullName && 'your name', !data.me.phone && 'a phone number'].filter(Boolean)
	);

	async function saveDetails(e: Event) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/api/founder/me', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ fullName, phone })
			});
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				saveError = body.message ?? 'Could not save your details.';
				return;
			}
			showToast('Details saved.', 'ok');
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function handlePassword(e: Event) {
		e.preventDefault();
		if (changingPassword) return;
		changingPassword = true;
		try {
			const result = await changePassword(currentPassword, newPassword);
			if (!result.ok) {
				showToast(result.error, 'err');
				return;
			}
			showToast('Password changed.', 'ok');
			currentPassword = '';
			newPassword = '';
		} finally {
			changingPassword = false;
		}
	}

	async function closeAccount() {
		const ok = await askConfirm({
			title: 'Delete your account?',
			body: ownsAny
				? 'Every startup you registered goes with it: their roles come off the board and their teams lose access. Your login stops working. This cannot be undone.'
				: 'Your login stops working and you leave any startup you were added to. This cannot be undone.',
			confirmLabel: 'Delete my account',
			tone: 'danger'
		});
		if (!ok) return;

		closing = true;
		const done = await deleteMyAccount();
		if (!done) {
			closing = false;
			showToast('Could not delete the account. Ask TIC on the Support page.', 'err');
			return;
		}
		await goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>Founder Console · Settings</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Settings"
	eyebrow="Your account"
	alwaysAvailable
>
	{#if missing.length}
		<div class="note" role="status">
			<p class="note__title">Complete your details</p>
			<p class="card__sub">Add {missing.join(' and ')} so TIC can reach you.</p>
		</div>
	{/if}

	<section class="card">
		<h2 class="card__title">Your details</h2>
		<p class="card__sub">
			These are about you, not a startup, so they take effect straight away. Company details live
			under Details.
		</p>

		<form onsubmit={saveDetails} novalidate>
			<label class="field">
				<span>Full name</span>
				<input type="text" bind:value={fullName} autocomplete="name" required />
			</label>
			<label class="field">
				<span>Email</span>
				<input type="email" value={data.me.email} disabled />
			</label>
			<label class="field">
				<span>Phone</span>
				<input type="tel" bind:value={phone} autocomplete="tel" use:phoneInput />
			</label>

			{#if saveError}
				<p class="error" role="alert">{saveError}</p>
			{/if}

			<button type="submit" class="btn-primary" disabled={saving}>
				{saving ? 'Saving…' : 'Save details'}
			</button>
			<p class="quiet">
				Your email is your sign-in, so it cannot be changed here — ask TIC on the Support page.
			</p>
		</form>
	</section>

	<section class="card">
		<h2 class="card__title">Your password</h2>

		<form onsubmit={handlePassword} novalidate>
			<label class="field">
				<span>Current password</span>
				<input
					type="password"
					bind:value={currentPassword}
					autocomplete="current-password"
					required
				/>
			</label>
			<label class="field">
				<span>New password</span>
				<input type="password" bind:value={newPassword} autocomplete="new-password" required />
			</label>
			<button type="submit" class="btn" disabled={changingPassword}>
				{changingPassword ? 'Changing…' : 'Change password'}
			</button>
		</form>
	</section>

	<section class="card card--danger">
		<h2 class="card__title">Delete your account</h2>
		<p class="card__sub">
			This deletes the whole account, not one startup — to remove a single one, use Startups.
			Submitted incubation applications stay with TIC. There is no way back from this.
		</p>
		<button type="button" class="btn-danger" onclick={closeAccount} disabled={closing}>
			{closing ? 'Deleting…' : 'Delete account'}
		</button>
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
		margin: 0 0 6px;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.card {
		@include admin-card;
		max-width: 620px;
		margin-bottom: 18px;

		&--danger {
			border-left: 3px solid admin-tone-fg('bad');
		}
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

	.btn-primary {
		@include admin-btn-primary;
	}

	.btn {
		@include admin-btn-base;
	}

	.btn-danger {
		@include admin-btn-danger;
		align-self: flex-start;
	}
</style>
