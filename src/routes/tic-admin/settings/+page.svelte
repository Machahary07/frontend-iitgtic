<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import PasswordStrength from '$lib/components/PasswordStrength.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { phoneInput } from '$lib/utils/phone';
	import { roleLabel } from '$lib/utils/roles';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const locked = $derived(data.viewingAs);

	// Seeded once, so a reload of the data does not wipe what is being typed.
	const loaded = untrack(() => data.me);
	let fullName = $state(loaded.fullName);
	let phone = $state(loaded.phone);
	let saving = $state(false);

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let changing = $state(false);

	async function readError(res: Response, fallback: string) {
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		return body.message ?? fallback;
	}

	async function saveDetails(e: Event) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		const res = await fetch('/api/tic-admin/settings', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ fullName, phone })
		});
		saving = false;
		if (!res.ok) {
			showToast(await readError(res, 'Could not save your details.'), 'err');
			return;
		}
		await invalidateAll();
		showToast('Details saved.');
	}

	async function changePassword(e: Event) {
		e.preventDefault();
		if (changing) return;
		if (newPassword !== confirmPassword) {
			showToast('The new passwords do not match.', 'err');
			return;
		}
		changing = true;
		const res = await fetch('/api/tic-admin/settings', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ currentPassword, newPassword })
		});
		changing = false;
		if (!res.ok) {
			showToast(await readError(res, 'Could not change the password.'), 'err');
			return;
		}
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		showToast('Password changed.');
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Settings</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Settings"
	eyebrow="Your account"
	user={adminName}
	onLogout={handleLogout}
>
	{#if locked}
		<p class="note" role="status">
			You are viewing as {data.me.fullName || data.me.email}. Switch back to your own account to
			change settings.
		</p>
	{/if}

	<section class="card">
		<h2 class="card__title">Your details</h2>
		<form onsubmit={saveDetails} novalidate>
			<label class="field">
				<span>Full name</span>
				<input type="text" bind:value={fullName} autocomplete="name" disabled={locked} required />
			</label>
			<label class="field">
				<span>Phone</span>
				<input type="tel" bind:value={phone} autocomplete="tel" disabled={locked} use:phoneInput />
			</label>
			<label class="field">
				<span>Email</span>
				<input type="email" value={data.me.email} disabled />
			</label>
			<div class="pair">
				<label class="field">
					<span>Role</span>
					<input type="text" value={roleLabel(data.me.role)} disabled />
				</label>
				<label class="field">
					<span>Department</span>
					<input type="text" value={data.me.department || '—'} disabled />
				</label>
			</div>
			<label class="field">
				<span>Responsibility</span>
				<input type="text" value={data.me.responsibility || '—'} disabled />
			</label>
			<p class="quiet">
				Your email, role, department and responsibility are set by an admin from Users.
			</p>
			<button type="submit" class="btn btn--primary" disabled={saving || locked}>
				{saving ? 'Saving…' : 'Save details'}
			</button>
		</form>
	</section>

	<section class="card">
		<h2 class="card__title">Change password</h2>
		<form onsubmit={changePassword} novalidate>
			<label class="field">
				<span>Current password</span>
				<input
					type="password"
					bind:value={currentPassword}
					autocomplete="current-password"
					disabled={locked}
					required
				/>
			</label>
			<label class="field">
				<span>New password</span>
				<input
					type="password"
					bind:value={newPassword}
					autocomplete="new-password"
					disabled={locked}
					required
				/>
				<PasswordStrength password={newPassword} />
			</label>
			<label class="field">
				<span>Confirm new password</span>
				<input
					type="password"
					bind:value={confirmPassword}
					autocomplete="new-password"
					disabled={locked}
					required
				/>
				{#if confirmPassword && confirmPassword !== newPassword}
					<p class="mismatch">Does not match the new password.</p>
				{/if}
			</label>
			<button type="submit" class="btn" disabled={changing || locked}>
				{changing ? 'Changing…' : 'Change password'}
			</button>
		</form>
	</section>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.note {
		max-width: 620px;
		margin: 0 0 18px;
		padding: 12px 16px;
		font-size: 13px;
		color: $admin-ink-2;
		background: $admin-sunken;
		border-left: 3px solid admin-tone-fg('warn');
		border-radius: $admin-radius-sm;
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

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		align-items: flex-start;
		width: 100%;
	}

	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
		width: 100%;

		@media (max-width: 560px) {
			grid-template-columns: 1fr;
		}
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

	.mismatch {
		margin: 0;
		font-size: 12px;
		color: #a01515;
	}

	.quiet {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.btn {
		@include admin-btn-base;

		&--primary {
			@include admin-btn-primary;
		}
	}
</style>
