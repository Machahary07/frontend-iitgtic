<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import UserFormDialog from '$lib/components/UserFormDialog.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { adminDeleteUser, adminSetUserBanned, type ManagedUser } from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import {
		ACCOUNT_ROLES,
		canGrant,
		canManage,
		canSetPassword,
		isStaffRole,
		ROLE_INFO,
		roleLabel
	} from '$lib/utils/roles';
	import { viewAs } from '$lib/utils/viewAs';

	type Filter = 'all' | 'staff' | 'founder' | 'never' | 'deactivated';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const users = $derived(data.users as ManagedUser[]);
	const currentAdminId = $derived(data.currentAdminId);

	// What the real person may do — while viewing as someone, the rank that
	// counts is still the developer's own, the same rule the server applies.
	const actingRole = $derived(data.admin?.actor?.role ?? data.admin?.role ?? null);
	const isDeveloper = $derived(Boolean(data.canViewAs));

	let filter = $state<Filter>('all');
	let busyId = $state<string | null>(null);

	// The account open in the popup: null with formOpen adds a new one.
	let formOpen = $state(false);
	let selected = $state<ManagedUser | null>(null);

	// Only the roles this person may hand out; a founder is never created here.
	const grantable = $derived(
		ACCOUNT_ROLES.filter((role) => canGrant(actingRole, role)).map((role) => ({
			value: role,
			label: ROLE_INFO[role].label,
			hint: ROLE_INFO[role].hint
		}))
	);
	const staffGrantable = $derived(grantable.filter((option) => option.value !== 'founder'));

	const counts = $derived({
		all: users.length,
		staff: users.filter((u) => isStaffRole(u.role)).length,
		founder: users.filter((u) => u.role === 'founder').length,
		never: users.filter((u) => !u.lastSignInAt).length,
		deactivated: users.filter((u) => u.banned).length
	});

	const filtered = $derived.by(() => {
		if (filter === 'all') return users;
		if (filter === 'never') return users.filter((u) => !u.lastSignInAt);
		if (filter === 'deactivated') return users.filter((u) => u.banned);
		if (filter === 'staff') return users.filter((u) => isStaffRole(u.role));
		return users.filter((u) => u.role === filter);
	});

	const manages = (user: ManagedUser) =>
		user.id !== currentAdminId && canManage(actingRole, user.role);

	function openAdd() {
		selected = null;
		formOpen = true;
	}

	function openUser(user: ManagedUser) {
		selected = user;
		formOpen = true;
	}

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
		await invalidateAll();
	}

	// Reversible: a deactivated account cannot sign in, but nothing is removed,
	// and Activate lets them straight back in.
	async function toggleActive(user: ManagedUser) {
		const next = !user.banned;
		if (next) {
			const ok = await askConfirm({
				title: `Deactivate ${user.email}?`,
				body: 'They will not be able to sign in until you activate the account again. Nothing is deleted.',
				confirmLabel: 'Deactivate',
				tone: 'danger'
			});
			if (!ok) return;
		}
		run(
			user.id,
			() => adminSetUserBanned(user.id, next),
			next ? `${user.email} deactivated.` : `${user.email} activated.`
		);
	}

	async function remove(user: ManagedUser) {
		const ok = await askConfirm({
			title: `Permanently delete ${user.email}?`,
			body: 'Everything they own goes with the account. This cannot be undone — deactivate it instead if you may want it back.',
			confirmLabel: 'Delete user',
			tone: 'danger'
		});
		if (!ok) return;
		run(user.id, () => adminDeleteUser(user.id), `${user.email} deleted.`);
	}

	async function openAs(user: ManagedUser) {
		busyId = user.id;
		const result = await viewAs(user.id);
		if (!result.ok) {
			busyId = null;
			showToast(result.error, 'err');
		}
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
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
		{#if staffGrantable.length}
			<button class="btn btn--primary" onclick={openAdd}>+ Add</button>
		{/if}
	{/snippet}

	<div class="tabs">
		<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
			All <span class="tab__count">{counts.all}</span>
		</button>
		<button class="tab" class:tab--active={filter === 'staff'} onclick={() => (filter = 'staff')}>
			TIC staff <span class="tab__count">{counts.staff}</span>
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
			class:tab--active={filter === 'deactivated'}
			onclick={() => (filter = 'deactivated')}
		>
			Deactivated <span class="tab__count">{counts.deactivated}</span>
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
							<!-- The whole row opens the account; the buttons in it stop the
							     click so they still do only their own thing. -->
							<tr
								class="row"
								class:row--busy={busyId === user.id}
								onclick={() => openUser(user)}
								onkeydown={(event) => {
									if (event.key === 'Enter' && event.target === event.currentTarget) openUser(user);
								}}
								tabindex="0"
								aria-label="Open {user.fullName || user.email}"
							>
								<td>
									<p class="cell__name">
										{user.fullName || user.email}
										{#if user.id === currentAdminId}
											<span class="you">you</span>
										{/if}
									</p>
									<p class="cell__sub">{user.email}</p>
									{#if user.phone}<p class="cell__meta">{user.phone}</p>{/if}
									{#each user.companies as company (company.name)}
										<p class="cell__sub">
											{company.name} ·
											<span class="dot dot--{company.status}"></span>{company.status}
										</p>
									{/each}
								</td>
								<td>
									<p class="cell__name">{roleLabel(user.role)}</p>
									{#if user.department || user.responsibility}
										<p class="cell__sub">
											{[user.department, user.responsibility].filter(Boolean).join(' · ')}
										</p>
									{/if}
									<div class="flags">
										{#if user.banned}<span class="badge badge--bad">deactivated</span>{/if}
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
									<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
									<div class="actions" onclick={(event) => event.stopPropagation()}>
										{#if isDeveloper && user.id !== currentAdminId}
											<button
												class="btn"
												disabled={busyId === user.id || user.banned}
												title="Open the console as {user.fullName || user.email}"
												onclick={() => openAs(user)}
											>
												View as
											</button>
										{/if}
										{#if manages(user)}
											<button
												class="btn"
												disabled={busyId === user.id}
												onclick={() => toggleActive(user)}
											>
												{user.banned ? 'Activate' : 'Deactivate'}
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

<UserFormDialog
	open={formOpen}
	user={selected}
	roleOptions={selected
		? canGrant(actingRole, selected.role)
			? selected.role === 'founder'
				? grantable
				: staffGrantable
			: [{ value: selected.role, label: roleLabel(selected.role) }]
		: staffGrantable}
	canEdit={selected ? selected.id === currentAdminId || canManage(actingRole, selected.role) : true}
	canSetPassword={selected
		? selected.id === currentAdminId || canSetPassword(actingRole, selected.role)
		: true}
	canChangeRole={selected
		? selected.id !== currentAdminId && canGrant(actingRole, selected.role)
		: true}
	onclose={() => (formOpen = false)}
	onsaved={() => invalidateAll()}
/>

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
		min-width: 150px;
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

	.row {
		cursor: pointer;

		&:hover td {
			background: rgba(17, 20, 24, 0.018);
		}
	}

	.cell__meta {
		@include admin-cell-sub;
		color: $admin-ink-3;
	}
</style>
