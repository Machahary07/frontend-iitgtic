<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import type { CompanyStatus } from '$lib/utils/companyAuth';
	import { adminDeleteCompany, adminSetCompanyStatus } from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	type Filter = 'all' | CompanyStatus;

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const companies = $derived(data.companies);

	let filter = $state<Filter>('pending');
	let rejectingId = $state<string | null>(null);
	let rejectReason = $state('');

	// Mutations still go through the audited API routes; re-running the server
	// load is what refreshes the table.
	const refresh = () => invalidateAll();

	const filtered = $derived(
		filter === 'all' ? companies : companies.filter((c) => c.status === filter)
	);

	const counts = $derived({
		all: companies.length,
		pending: companies.filter((c) => c.status === 'pending').length,
		verified: companies.filter((c) => c.status === 'verified').length,
		rejected: companies.filter((c) => c.status === 'rejected').length
	});

	async function approve(id: string) {
		await adminSetCompanyStatus(id, 'verified');
		await refresh();
	}

	function openReject(id: string) {
		rejectingId = id;
		rejectReason = '';
	}

	async function confirmReject() {
		if (!rejectingId) return;
		await adminSetCompanyStatus(rejectingId, 'rejected', rejectReason.trim() || undefined);
		rejectingId = null;
		rejectReason = '';
		await refresh();
	}

	function cancelReject() {
		rejectingId = null;
		rejectReason = '';
	}

	async function remove(id: string, name: string) {
		const ok = await askConfirm({
			title: `Permanently delete the account for "${name}"?`,
			body: 'The company, its roles and its sign-in all go. This cannot be undone.',
			confirmLabel: 'Delete account',
			tone: 'danger'
		});
		if (!ok) return;
		await adminDeleteCompany(id);
		await refresh();
	}

	async function revertToPending(id: string) {
		await adminSetCompanyStatus(id, 'pending');
		await refresh();
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>TIC Admin · Companies</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	brandSub="Internal"
	navItems={TIC_ADMIN_NAV}
	title="Companies"
	eyebrow="Moderation"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="tabs">
		<button
			class="tab"
			class:tab--active={filter === 'pending'}
			onclick={() => (filter = 'pending')}
		>
			Pending <span class="tab__count">{counts.pending}</span>
		</button>
		<button
			class="tab"
			class:tab--active={filter === 'verified'}
			onclick={() => (filter = 'verified')}
		>
			Verified <span class="tab__count">{counts.verified}</span>
		</button>
		<button
			class="tab"
			class:tab--active={filter === 'rejected'}
			onclick={() => (filter = 'rejected')}
		>
			Rejected <span class="tab__count">{counts.rejected}</span>
		</button>
		<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
			All <span class="tab__count">{counts.all}</span>
		</button>
	</div>

	<div class="panel">
		{#if filtered.length === 0}
			<p class="empty">No companies in this view.</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Company</th>
							<th>Contact</th>
							<th>Website</th>
							<th>Signed up</th>
							<th>Status</th>
							<th class="actions-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as company (company.id)}
							<tr>
								<td>
									<p class="cell__name">{company.companyName}</p>
									<p class="cell__sub">{company.email}</p>
								</td>
								<td>
									{#if company.contactName}
										<p class="cell__name">{company.contactName}</p>
									{:else}
										<p class="cell__sub">—</p>
									{/if}
								</td>
								<td>
									{#if company.website}
										<a
											class="link"
											href={company.website}
											target="_blank"
											rel="noopener noreferrer"
										>
											{company.website.replace(/^https?:\/\//, '')}
										</a>
									{:else}
										<p class="cell__sub">—</p>
									{/if}
								</td>
								<td><p class="cell__sub">{fmtDate(company.createdAt)}</p></td>
								<td>
									<span class="badge badge--{company.status}">{company.status}</span>
									{#if company.status === 'rejected' && company.rejectionReason}
										<p class="cell__reason">Reason: {company.rejectionReason}</p>
									{/if}
								</td>
								<td class="actions-col">
									<div class="actions">
										{#if company.status === 'pending'}
											<button class="btn btn--primary" onclick={() => approve(company.id)}
												>Approve</button
											>
											<button class="btn" onclick={() => openReject(company.id)}>Reject</button>
										{:else if company.status === 'verified'}
											<button class="btn" onclick={() => revertToPending(company.id)}>Revert</button
											>
											<button class="btn" onclick={() => openReject(company.id)}>Reject</button>
										{:else}
											<button class="btn" onclick={() => approve(company.id)}>Approve</button>
											<button class="btn" onclick={() => revertToPending(company.id)}>Revert</button
											>
										{/if}
										<button
											class="btn btn--danger"
											onclick={() => remove(company.id, company.companyName)}>Delete</button
										>
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

{#if rejectingId}
	<div class="modal-backdrop">
		<button
			type="button"
			class="modal-close-area"
			aria-label="Cancel rejection"
			onclick={cancelReject}
		></button>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1">
			<h3>Reject company</h3>
			<p class="modal__sub">Optionally add a reason — shown on the company's dashboard.</p>
			<label class="field">
				<span>Reason (optional)</span>
				<textarea bind:value={rejectReason} rows="3" placeholder="e.g. Not affiliated with TIC"
				></textarea>
			</label>
			<div class="modal__actions">
				<button class="btn" onclick={cancelReject}>Cancel</button>
				<button class="btn btn--danger" onclick={confirmReject}>Reject account</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;
	@use '$styles/admin' as *;

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 13px;
		font-weight: $font-weight-medium;
		color: #555;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: 999px;
		cursor: pointer;
		&--active {
			color: #fff;
			background: #111;
			border-color: #111;
		}
	}

	.tab__count {
		font-size: 11px;
		opacity: 0.7;
	}

	.panel {
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		overflow: hidden;
	}

	.empty {
		margin: 0;
		padding: 40px 18px;
		text-align: center;
		font-size: 13px;
		color: $admin-ink-3;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-family: $font-family-base;
		font-size: 13px;
		min-width: 760px;
	}

	thead th {
		text-align: left;
		padding: 10px 14px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-2;
		background: $admin-sunken;
		border-bottom: 1px solid $admin-line-soft;
	}

	tbody td {
		padding: 12px 14px;
		border-bottom: 1px solid $admin-line-soft;
		vertical-align: top;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.cell__name {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.cell__sub {
		margin: 2px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.cell__reason {
		margin: 6px 0 0;
		font-size: 11px;
		color: #a01515;
		max-width: 200px;
	}

	.link {
		color: #2050d4;
		font-size: 12px;
		text-decoration: none;
	}

	.badge {
		display: inline-block;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-radius: 999px;

		&--pending {
			background: #fff4d4;
			color: #6a4f00;
		}

		&--verified {
			background: #d6f5e1;
			color: #0e6b2c;
		}

		&--rejected {
			background: #fde0e0;
			color: #9a1515;
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
		padding: 6px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		&--primary {
			color: #fff;
			background: #111;
			border-color: #111;
		}

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
			background: #fff;
		}
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		z-index: 100;
	}

	.modal-close-area {
		position: absolute;
		inset: 0;
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	.modal {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 440px;
		background: #fff;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		padding: 22px;
		font-family: $font-family-base;

		h3 {
			margin: 0 0 6px;
			font-size: 16px;
			font-weight: $font-weight-semibold;
			color: #111;
		}
	}

	.modal__sub {
		margin: 0 0 16px;
		font-size: 13px;
		color: $admin-ink-2;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			font-size: 11px;
			font-weight: $font-weight-semibold;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: #444;
		}

		textarea {
			padding: 10px 12px;
			font: inherit;
			font-family: $font-family-base;
			font-size: 13px;
			color: #111;
			background: #fff;
			border: 1px solid $admin-line;
			border-radius: $admin-radius-sm;
			resize: vertical;

			&:focus {
				outline: none;
				border-color: #111;
				box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
			}
		}
	}

	.modal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 18px;
	}
</style>
