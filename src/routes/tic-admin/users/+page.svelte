<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminCreateAdmin,
		adminDeleteUser,
		adminSendPasswordReset,
		adminSetUserBanned,
		adminSetUserRole,
		type ManagedUser,
		type UserRole
	} from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';

	type Filter = 'all' | UserRole | 'never' | 'suspended';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const users = $derived(data.users as ManagedUser[]);
	const currentAdminId = $derived(data.currentAdminId);

	let filter = $state<Filter>('all');
	let busyId = $state<string | null>(null);

	let showInvite = $state(false);
	let newName = $state('');
	let newEmail = $state('');
	let newPassword = $state('');

	const refresh = () => invalidateAll();

	const counts = $derived({
		all: users.length,
		admin: users.filter((u) => u.role === 'admin').length,
		company: users.filter((u) => u.role === 'company').length,
		founder: users.filter((u) => u.role === 'founder').length,
		never: users.filter((u) => !u.lastSignInAt).length,
		suspended: users.filter((u) => u.banned).length
	});

	const filtered = $derived.by(() => {
		if (filter === 'all') return users;
		if (filter === 'never') return users.filter((u) => !u.lastSignInAt);
		if (filter === 'suspended') return users.filter((u) => u.banned);
		return users.filter((u) => u.role === filter);
	});

	async function run(
		id: string,
		work: () => Promise<{ ok: true } | { ok: false; error: string }>,
		okText: string
	) {
		busyId = id;
		const result = await work();
		busyId = null;
		if (!result.ok) {
			showToast(result.error, 'err');
			return;
		}
		showToast(okText);
		await refresh();
	}

	async function changeRole(user: ManagedUser, role: UserRole) {
		if (role === user.role) return;
		if (role === 'admin') {
			const ok = await askConfirm({
				title: `Give ${user.email} full admin access?`,
				body: 'They will be able to read every application and manage other admins.',
				confirmLabel: 'Make admin'
			});
			if (!ok) return;
		}
		run(user.id, () => adminSetUserRole(user.id, role), `${user.email} is now ${role}.`);
	}

	async function toggleBan(user: ManagedUser) {
		const next = !user.banned;
		if (next) {
			const ok = await askConfirm({
				title: `Suspend ${user.email}?`,
				body: 'They will not be able to sign in until you restore the account.',
				confirmLabel: 'Suspend',
				tone: 'danger'
			});
			if (!ok) return;
		}
		run(
			user.id,
			() => adminSetUserBanned(user.id, next),
			next ? `${user.email} suspended.` : `${user.email} restored.`
		);
	}

	function sendReset(user: ManagedUser) {
		run(
			user.id,
			() => adminSendPasswordReset(user.id, user.email),
			`Password reset sent to ${user.email}.`
		);
	}

	async function remove(user: ManagedUser) {
		const ok = await askConfirm({
			title: `Permanently delete ${user.email}?`,
			body: 'Everything they own goes with the account. This cannot be undone.',
			confirmLabel: 'Delete user',
			tone: 'danger'
		});
		if (!ok) return;
		run(user.id, () => adminDeleteUser(user.id), `${user.email} deleted.`);
	}

	async function createAdmin(e: Event) {
		e.preventDefault();
		if (newPassword.length < 8) {
			showToast('Password must be at least 8 characters.', 'err');
			return;
		}
		busyId = 'new';
		const result = await adminCreateAdmin({
			email: newEmail,
			password: newPassword,
			fullName: newName
		});
		busyId = null;
		if (!result.ok) {
			showToast(result.error, 'err');
			return;
		}
		showToast(`Admin account created for ${newEmail}.`);
		newName = '';
		newEmail = '';
		newPassword = '';
		showInvite = false;
		await refresh();
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	function fmtDate(iso: string | null) {
		if (!iso) return null;
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function fmtRelative(iso: string | null) {
		if (!iso) return 'never';
		const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
		if (days === 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days} days ago`;
		return fmtDate(iso) ?? 'never';
	}
</script>

<svelte:head>
	<title>TIC Admin · Users</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Users"
	eyebrow="Accounts"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<button class="btn btn--primary" onclick={() => (showInvite = !showInvite)}>
			{showInvite ? 'Cancel' : '+ New admin'}
		</button>
	{/snippet}

	{#if showInvite}
		<form class="invite" onsubmit={createAdmin}>
			<h2>Create an admin account</h2>
			<p class="invite__sub">
				They sign in with this email and password, and can change the password themselves
				afterwards. Founders and companies sign themselves up — only admins are created here.
			</p>
			<div class="invite__grid">
				<label class="field">
					<span>Name</span>
					<input type="text" bind:value={newName} autocomplete="off" />
				</label>
				<label class="field">
					<span>Email</span>
					<input type="email" bind:value={newEmail} autocomplete="off" required />
				</label>
				<label class="field">
					<span>Temporary password</span>
					<input type="text" bind:value={newPassword} autocomplete="off" required />
				</label>
			</div>
			<button class="btn btn--primary" type="submit" disabled={busyId === 'new'}>
				{busyId === 'new' ? 'Creating…' : 'Create admin'}
			</button>
		</form>
	{/if}

	<div class="tabs">
		<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
			All <span class="tab__count">{counts.all}</span>
		</button>
		<button class="tab" class:tab--active={filter === 'admin'} onclick={() => (filter = 'admin')}>
			Admins <span class="tab__count">{counts.admin}</span>
		</button>
		<button
			class="tab"
			class:tab--active={filter === 'company'}
			onclick={() => (filter = 'company')}
		>
			Companies <span class="tab__count">{counts.company}</span>
		</button>
		<button
			class="tab"
			class:tab--active={filter === 'founder'}
			onclick={() => (filter = 'founder')}
		>
			Founders <span class="tab__count">{counts.founder}</span>
		</button>
		<button class="tab" class:tab--active={filter === 'never'} onclick={() => (filter = 'never')}>
			Never signed in <span class="tab__count">{counts.never}</span>
		</button>
		<button
			class="tab"
			class:tab--active={filter === 'suspended'}
			onclick={() => (filter = 'suspended')}
		>
			Suspended <span class="tab__count">{counts.suspended}</span>
		</button>
	</div>

	<div class="panel">
		{#if filtered.length === 0}
			<p class="empty">No accounts in this view.</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Account</th>
							<th>Role</th>
							<th>Last signed in</th>
							<th>Joined</th>
							<th class="actions-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as user (user.id)}
							<tr class:row--busy={busyId === user.id}>
								<td>
									<p class="cell__name">
										{user.fullName || user.companyName || user.email}
										{#if user.id === currentAdminId}
											<span class="you">you</span>
										{/if}
									</p>
									<p class="cell__sub">{user.email}</p>
									{#if user.companyName && user.companyStatus}
										<p class="cell__sub">
											{user.companyName} ·
											<span class="dot dot--{user.companyStatus}"></span>{user.companyStatus}
										</p>
									{/if}
								</td>
								<td>
									<select
										class="role"
										value={user.role}
										disabled={user.id === currentAdminId || busyId === user.id}
										onchange={(e) =>
											changeRole(user, (e.currentTarget as HTMLSelectElement).value as UserRole)}
									>
										<option value="founder">founder</option>
										<option value="company">company</option>
										<option value="admin">admin</option>
									</select>
									<div class="flags">
										{#if user.banned}<span class="badge badge--bad">suspended</span>{/if}
										{#if !user.emailConfirmed}
											<span class="badge badge--warn">unconfirmed</span>
										{/if}
									</div>
								</td>
								<td>
									<p class="cell__name" class:muted={!user.lastSignInAt}>
										{fmtRelative(user.lastSignInAt)}
									</p>
									{#if user.lastSignInAt}
										<p class="cell__sub">{fmtDate(user.lastSignInAt)}</p>
									{/if}
								</td>
								<td><p class="cell__sub">{fmtDate(user.createdAt)}</p></td>
								<td class="actions-col">
									<div class="actions">
										<button
											class="btn"
											disabled={busyId === user.id}
											onclick={() => sendReset(user)}>Reset password</button
										>
										{#if user.id !== currentAdminId}
											<button
												class="btn"
												disabled={busyId === user.id}
												onclick={() => toggleBan(user)}
											>
												{user.banned ? 'Restore' : 'Suspend'}
											</button>
											<button
												class="btn btn--danger"
												disabled={busyId === user.id}
												onclick={() => remove(user)}>Delete</button
											>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.tabs {
		@include admin-tabs;
	}
	.tab {
		@include admin-tab;
	}
	.tab__count {
		@include admin-tab-count;
	}
	.panel {
		@include admin-panel;
	}
	.empty {
		@include admin-empty;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		@include admin-table(820px);
	}

	thead th {
		@include admin-thead;
	}

	tbody td {
		@include admin-td;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.row--busy {
		opacity: 0.55;
	}

	.cell__name {
		@include admin-cell-name;

		&.muted {
			color: #999;
			font-weight: $font-weight-medium;
		}
	}

	.cell__sub {
		@include admin-cell-sub;
	}

	.you {
		margin-left: 6px;
		padding: 1px 6px;
		font-size: 10px;
		font-weight: $font-weight-semibold;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #24427e;
		background: #e2e8f5;
		border-radius: 999px;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 4px;
		border-radius: 50%;
		background: #bbb;

		&--verified {
			background: #0e6b2c;
		}
		&--pending {
			background: #c79400;
		}
		&--rejected {
			background: #a01515;
		}
	}

	.role {
		padding: 5px 8px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.flags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 6px;
	}

	.badge {
		@include admin-badge;

		&--bad {
			@include admin-badge-tone('bad');
		}
		&--warn {
			@include admin-badge-tone('warn');
		}
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.actions {
		display: inline-flex;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.btn {
		@include admin-btn-small;
	}

	.invite {
		@include admin-card;
		margin-bottom: 16px;
		align-items: flex-start;

		h2 {
			@include admin-section-title;
			font-size: 15px;
		}
	}

	.invite__sub {
		margin: 0;
		font-size: 13px;
		color: $admin-ink-2;
		max-width: 60ch;
	}

	.invite__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		width: 100%;
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
			font-size: 13px;
		}
	}
</style>
