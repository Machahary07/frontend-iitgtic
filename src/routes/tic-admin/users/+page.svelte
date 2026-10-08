<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import UserFormDialog from '$lib/components/UserFormDialog.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminClearDeletedAccount,
		adminDeleteUser,
		adminSetUserBanned,
		type ManagedUser
	} from '$lib/utils/ticAdmin';
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

	type Filter = 'all' | 'staff' | 'founder' | 'never' | 'deactivated' | 'deleted';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const users = $derived(data.users as ManagedUser[]);
	const currentAdminId = $derived(data.currentAdminId);
	const deletedAccounts = $derived(data.deletedAccounts);

	// What the real person may do — while viewing as someone, the rank that
	// counts is still the developer's own, the same rule the server applies.
	const actingRole = $derived(data.admin?.actor?.role ?? data.admin?.role ?? null);
	const isDeveloper = $derived(Boolean(data.canViewAs));

	let filter = $state<Filter>('all');
	let busyId = $state<string | null>(null);
	// Accounts their owners deleted show under every view a founder belongs in.
	const showDeleted = $derived(filter === 'all' || filter === 'founder' || filter === 'deleted');

	// The account open in the popup: null with formOpen adds a new one.
	let formOpen = $state(false);
	// By id, so the popup follows the live record — after Deactivate, or a
	// refresh, it shows the account as it now is.
	let selectedId = $state<string | null>(null);
	const selected = $derived(users.find((u) => u.id === selectedId) ?? null);
	let startEditing = $state(false);

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
		deactivated: users.filter((u) => u.banned).length,
		deleted: deletedAccounts.length
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
		selectedId = null;
		startEditing = false;
		formOpen = true;
	}

	function openUser(user: ManagedUser, edit = false) {
		selectedId = user.id;
		startEditing = edit;
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
			return false;
		}
		showToast(okText);
		await invalidateAll();
		return true;
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
		if (!ok) return false;
		return run(user.id, () => adminDeleteUser(user.id), `${user.email} deleted.`);
	}

	async function clearDeleted(entry: (typeof deletedAccounts)[number]) {
		const ok = await askConfirm({
			title: `Remove the record of ${entry.email}?`,
			body: 'The account is already gone; this only removes the note that it was deleted.',
			confirmLabel: 'Remove record',
			tone: 'danger'
		});
		if (!ok) return;
		run(entry.id, () => adminClearDeletedAccount(entry.id), 'Record removed.');
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

	// A page at a time; back to the first page whenever the view changes.
	const pager = new Pager(
		() => filtered,
		() => [filter]
	);
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
		<button
			class="tab"
			class:tab--active={filter === 'deleted'}
			onclick={() => (filter = 'deleted')}
		>
			Deleted <span class="tab__count">{counts.deleted}</span>
		</button>
	</div>

	{#if filter !== 'deleted'}
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
							{#each pager.rows as user (user.id)}
								<!-- The whole row opens the account; the buttons in it stop the
							     click so they still do only their own thing. -->
								<tr
									class="row"
									class:row--busy={busyId === user.id}
									onclick={() => openUser(user)}
									onkeydown={(event) => {
										if (event.key === 'Enter' && event.target === event.currentTarget)
											openUser(user);
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
										<!-- Opens the same popup as the row, straight into editing. View
									     as, Deactivate and Delete live in the popup. -->
										<button
											type="button"
											class="pencil"
											title="Edit {user.fullName || user.email}"
											aria-label="Edit {user.fullName || user.email}"
											onclick={(event) => {
												event.stopPropagation();
												openUser(user, true);
											}}
										>
											<Pencil size={15} strokeWidth={2} />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination {pager} noun="accounts" />
			{/if}
		</div>
	{/if}

	{#if showDeleted && (deletedAccounts.length || filter === 'deleted')}
		<div class="panel panel--deleted">
			{#if deletedAccounts.length === 0}
				<p class="empty">No one has deleted their account.</p>
			{:else}
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th>Deleted by the account holder</th>
								<th>Role</th>
								<th>Deleted</th>
								<th>Joined</th>
								<th class="actions-col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each deletedAccounts as entry (entry.id)}
								<!-- Not clickable: there is no account left to open. -->
								<tr class="row--deleted" class:row--busy={busyId === entry.id}>
									<td>
										<p class="cell__name">{entry.fullName || entry.email}</p>
										<p class="cell__sub">{entry.email}</p>
										{#each entry.companies as company (company)}
											<p class="cell__sub">{company}</p>
										{/each}
									</td>
									<td>
										<p class="cell__name">{roleLabel(entry.role)}</p>
										<div class="flags">
											<span class="badge badge--bad">deleted their account</span>
										</div>
									</td>
									<td><p class="cell__sub">{fmtDate(entry.deletedAt)}</p></td>
									<td><p class="cell__sub">{fmtDate(entry.joinedAt) ?? '—'}</p></td>
									<td class="actions-col">
										<button
											type="button"
											class="pencil"
											title="Remove this record"
											aria-label="Remove the record of {entry.email}"
											disabled={busyId === entry.id}
											onclick={() => clearDeleted(entry)}
										>
											<Trash size={15} strokeWidth={2} />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
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
	{startEditing}
	busy={busyId !== null}
	onclose={() => (formOpen = false)}
	onsaved={() => invalidateAll()}
	onviewas={selected &&
	isDeveloper &&
	selected.role !== 'developer' &&
	selected.id !== currentAdminId
		? () => openAs(selected!)
		: undefined}
	ontoggleactive={selected && manages(selected) ? () => toggleActive(selected!) : undefined}
	ondelete={selected && manages(selected)
		? async () => {
				if (await remove(selected!)) formOpen = false;
			}
		: undefined}
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

	.panel--deleted {
		margin-top: 18px;
	}

	.row--deleted td {
		color: $admin-ink-3;
		background: $admin-sunken;
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

	.pencil {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		padding: 0;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			color: $admin-ink;
			background: $admin-sunken;
		}
	}

	.cell__meta {
		@include admin-cell-sub;
		color: $admin-ink-3;
	}
</style>
