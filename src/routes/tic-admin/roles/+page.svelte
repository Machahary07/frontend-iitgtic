<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import Eye from '@lucide/svelte/icons/eye';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import UserFormDialog, { type UserRecord } from '$lib/components/UserFormDialog.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		ACCOUNT_ROLES,
		canGrant,
		canManage,
		canOpen,
		canSetPassword,
		CONSOLE_SECTIONS,
		ROLE_INFO,
		roleLabel,
		STAFF_ROLES,
		type StaffRole
	} from '$lib/utils/roles';
	import { viewAs } from '$lib/utils/viewAs';
	import { showToast } from '$lib/utils/toast.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { adminDeleteUser, adminSetUserBanned } from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';

	// Every kind of account there is, who holds each one, and what each can open.
	// The table below is printed from $lib/utils/roles — the same one the sidebar,
	// the request hook and the assistant obey — so it cannot drift from the truth.

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const actingRole = $derived(data.admin?.actor?.role ?? data.admin?.role ?? null);
	const selfId = $derived(data.admin?.userId ?? null);
	const isDeveloper = $derived(Boolean(data.canViewAs));
	// Opening an account to edit it is a Users-screen power; without it the
	// popup still opens, read-only.
	const managesUsers = $derived(canOpen(actingRole, 'users'));

	// The Developer role is shown to developers only — its card, its column and
	// the view-as row with it. Judged on the account on screen, so viewing as an
	// admin shows exactly what that admin sees.
	const seesDevelopers = $derived(Boolean(data.admin && ROLE_INFO[data.admin.role].viewAs));
	const shownRoles = $derived(STAFF_ROLES.filter((role) => role !== 'developer' || seesDevelopers));

	const byRole = $derived.by(() => {
		const groups = Object.fromEntries(STAFF_ROLES.map((role) => [role, [] as UserRecord[]]));
		for (const member of data.members) groups[member.role]?.push(member);
		return groups as Record<StaffRole, UserRecord[]>;
	});

	let formOpen = $state(false);
	let selectedId = $state<string | null>(null);
	const selected = $derived(
		(data.members as UserRecord[]).find((member) => member.id === selectedId) ?? null
	);
	let busy = $state(false);

	function open(member: UserRecord) {
		selectedId = member.id;
		formOpen = true;
	}

	const manages = (member: UserRecord) =>
		managesUsers && member.id !== selfId && canManage(actingRole, member.role);

	async function toggleActive(member: UserRecord) {
		const next = !member.banned;
		if (
			next &&
			!(await askConfirm({
				title: `Deactivate ${member.email}?`,
				body: 'They will not be able to sign in until you activate the account again. Nothing is deleted.',
				confirmLabel: 'Deactivate',
				tone: 'danger'
			}))
		) {
			return;
		}
		busy = true;
		const result = await adminSetUserBanned(member.id, next);
		busy = false;
		if (!result.ok) return showToast(result.error, 'err');
		showToast(next ? `${member.email} deactivated.` : `${member.email} activated.`);
		await invalidateAll();
	}

	async function remove(member: UserRecord) {
		const ok = await askConfirm({
			title: `Permanently delete ${member.email}?`,
			body: 'Everything they own goes with the account. This cannot be undone — deactivate it instead if you may want it back.',
			confirmLabel: 'Delete user',
			tone: 'danger'
		});
		if (!ok) return;
		busy = true;
		const result = await adminDeleteUser(member.id);
		busy = false;
		if (!result.ok) return showToast(result.error, 'err');
		showToast(`${member.email} deleted.`);
		formOpen = false;
		await invalidateAll();
	}

	const staffOptions = $derived(
		ACCOUNT_ROLES.filter((role) => role !== 'founder' && canGrant(actingRole, role)).map(
			(role) => ({ value: role, label: ROLE_INFO[role].label, hint: ROLE_INFO[role].hint })
		)
	);

	async function openAs(member: UserRecord) {
		const result = await viewAs(member.id);
		if (!result.ok) showToast(result.error, 'err');
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Roles</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Roles"
	eyebrow="Accounts"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="cards">
		{#each shownRoles as role (role)}
			{@const members = byRole[role] ?? []}
			<section class="card">
				<header class="card__head">
					<div>
						<h2 class="card__title">{ROLE_INFO[role].label}</h2>
						<p class="card__blurb">{ROLE_INFO[role].blurb}</p>
					</div>
					<span
						class="card__count"
						title="{members.length} account{members.length === 1 ? '' : 's'}">{members.length}</span
					>
				</header>

				{#if members.length === 0}
					<p class="card__empty">Nobody holds this role yet.</p>
				{:else}
					<ul class="members">
						{#each members as member (member.id)}
							<li>
								<div
									class="member"
									role="button"
									tabindex="0"
									onclick={() => open(member)}
									onkeydown={(event) => {
										if (event.key === 'Enter' && event.target === event.currentTarget) open(member);
									}}
								>
									<span class="member__avatar" aria-hidden="true">
										{(member.fullName || member.email).charAt(0).toUpperCase()}
									</span>
									<span class="member__text">
										<span class="member__name">
											{member.fullName || member.email}
											{#if member.id === selfId}<span class="you">you</span>{/if}
										</span>
										<span class="member__sub">
											{member.department || member.email}{#if member.banned}
												· deactivated{/if}
										</span>
									</span>
									{#if isDeveloper && member.role !== 'developer'}
										<button
											type="button"
											class="member__view"
											title="View as {member.fullName || member.email}"
											aria-label="View as {member.fullName || member.email}"
											disabled={member.banned}
											onclick={(event) => {
												event.stopPropagation();
												openAs(member);
											}}
										>
											<Eye size={14} strokeWidth={2} />
										</button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}

		<section class="card card--muted">
			<header class="card__head">
				<div>
					<h2 class="card__title">{ROLE_INFO.founder.label}</h2>
					<p class="card__blurb">{ROLE_INFO.founder.blurb}</p>
				</div>
				<span class="card__count">{data.founderCount}</span>
			</header>
			<a class="card__link" href={resolve('/tic-admin/users')}>See founders under Users →</a>
		</section>
	</div>

	<section class="panel">
		<header class="panel__head">
			<h2 class="panel__title">What each role can open</h2>
			<p class="panel__sub">
				Sections a role cannot open are hidden from its sidebar, refused by the server, and left out
				of its assistant's tools.
			</p>
		</header>
		<div class="table-wrap">
			<table class="matrix">
				<thead>
					<tr>
						<th>Section</th>
						{#each shownRoles as role (role)}
							<th>{roleLabel(role)}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each CONSOLE_SECTIONS as section (section.key)}
						<tr>
							<td class="matrix__section">{section.label}</td>
							{#each shownRoles as role (role)}
								<td>
									{#if ROLE_INFO[role].sections.includes(section.key)}
										<span class="yes" aria-label="Yes"><Check size={13} strokeWidth={2.6} /></span>
									{:else}
										<span class="no" aria-label="No">—</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
					<tr>
						<td class="matrix__section">Set passwords</td>
						{#each shownRoles as role (role)}
							<td>
								{#if ROLE_INFO[role].setsPasswords}
									<span class="yes" aria-label="Yes"><Check size={13} strokeWidth={2.6} /></span>
								{:else}
									<span class="no" aria-label="No">—</span>
								{/if}
							</td>
						{/each}
					</tr>
					{#if seesDevelopers}
						<tr>
							<td class="matrix__section">View as</td>
							{#each shownRoles as role (role)}
								<td>
									{#if ROLE_INFO[role].viewAs}
										<span class="yes" aria-label="Yes"><Check size={13} strokeWidth={2.6} /></span>
									{:else}
										<span class="no" aria-label="No">—</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>
</AdminShell>

<UserFormDialog
	open={formOpen}
	user={selected}
	roleOptions={selected && canGrant(actingRole, selected.role)
		? staffOptions
		: [{ value: selected?.role ?? '', label: roleLabel(selected?.role) }]}
	canEdit={Boolean(
		selected && managesUsers && (selected.id === selfId || canManage(actingRole, selected.role))
	)}
	canSetPassword={Boolean(
		selected && (selected.id === selfId || canSetPassword(actingRole, selected.role))
	)}
	canChangeRole={Boolean(selected && selected.id !== selfId && canGrant(actingRole, selected.role))}
	{busy}
	onclose={() => (formOpen = false)}
	onsaved={() => invalidateAll()}
	onviewas={selected && isDeveloper && selected.role !== 'developer'
		? () => openAs(selected!)
		: undefined}
	ontoggleactive={selected && manages(selected) ? () => toggleActive(selected!) : undefined}
	ondelete={selected && manages(selected) ? () => remove(selected!) : undefined}
/>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
		margin-bottom: 18px;
	}

	.card {
		@include admin-panel;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px;

		&--muted {
			background: rgba(255, 255, 255, 0.7);
		}
	}

	.card__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.card__title {
		margin: 0;
		font-size: 15px;
		font-weight: $font-weight-bold;
		letter-spacing: -0.01em;
		color: $admin-ink;
	}

	.card__blurb {
		margin: 4px 0 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: $admin-ink-2;
	}

	.card__count {
		@include admin-icon-tile('violet', 32px);
		border-radius: $admin-radius-pill;
		font-size: 13px;
		font-weight: $font-weight-bold;
	}

	.card__empty {
		margin: 0;
		font-size: 12.5px;
		color: $admin-ink-3;
	}

	.card__link {
		font-size: 12.5px;
		font-weight: $font-weight-semibold;
		color: $admin-ink-2;
		text-decoration: none;
		@include admin-focus-ring;
	}

	.members {
		list-style: none;
		margin: 0 -8px;
		padding: 0;
	}

	.member {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 8px;
		border-radius: $admin-radius-md;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			background: $admin-sunken;
		}
	}

	.member__avatar {
		@include admin-icon-tile('info', 30px);
		border-radius: $admin-radius-pill;
		font-size: 12px;
		font-weight: $font-weight-bold;
	}

	.member__text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.member__name,
	.member__sub {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.member__name {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.member__sub {
		font-size: 11.5px;
		color: $admin-ink-3;
	}

	.member__view {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 28px;
		height: 28px;
		padding: 0;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
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

	.panel {
		@include admin-panel;
	}

	.panel__head {
		padding: 18px 20px 6px;
	}

	.panel__title {
		@include admin-section-title;
		font-size: 15px;
	}

	.panel__sub {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: $admin-ink-2;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.matrix {
		@include admin-table(880px);

		th {
			@include admin-thead;
			text-align: center;

			&:first-child {
				text-align: left;
			}
		}

		td {
			@include admin-td;
			text-align: center;
		}

		tbody tr:last-child td {
			border-bottom: 0;
		}
	}

	.matrix__section {
		text-align: left !important;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.yes {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		color: admin-tone-fg('good');
		background: admin-tone-bg('good');
		border-radius: $admin-radius-pill;
	}

	.no {
		color: rgba(17, 20, 24, 0.25);
	}
</style>
