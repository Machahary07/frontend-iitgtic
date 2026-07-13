<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { isTicAdminAuthed, logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		getAllCompanies,
		setCompanyStatus,
		deleteCompanyById,
		type CompanyAccount,
		type CompanyStatus
	} from '$lib/utils/companyAuth';

	const navItems = [
		{ label: 'Overview', href: '/tic-admin' },
		{ label: 'Companies', href: '/tic-admin/companies' },
		{ label: 'Posted jobs', href: '/tic-admin/jobs' },
		{ separator: true as const },
		{ label: 'Home page', href: '/tic-admin/home-page' }
	];

	type Filter = 'all' | CompanyStatus;

	let mounted = $state(false);
	let companies = $state<CompanyAccount[]>([]);
	let filter = $state<Filter>('pending');
	let rejectingId = $state<string | null>(null);
	let rejectReason = $state('');

	onMount(() => {
		if (!isTicAdminAuthed()) {
			goto('/tic-admin/login');
			return;
		}
		refresh();
		mounted = true;
	});

	function refresh() {
		companies = getAllCompanies();
	}

	const filtered = $derived(
		filter === 'all' ? companies : companies.filter((c) => c.status === filter)
	);

	const counts = $derived({
		all: companies.length,
		pending: companies.filter((c) => c.status === 'pending').length,
		verified: companies.filter((c) => c.status === 'verified').length,
		rejected: companies.filter((c) => c.status === 'rejected').length
	});

	function approve(id: string) {
		setCompanyStatus(id, 'verified');
		refresh();
	}

	function openReject(id: string) {
		rejectingId = id;
		rejectReason = '';
	}

	function confirmReject() {
		if (!rejectingId) return;
		setCompanyStatus(rejectingId, 'rejected', rejectReason.trim() || undefined);
		rejectingId = null;
		rejectReason = '';
		refresh();
	}

	function cancelReject() {
		rejectingId = null;
		rejectReason = '';
	}

	function remove(id: string, name: string) {
		if (!confirm(`Permanently delete the account for "${name}"? This cannot be undone.`)) return;
		deleteCompanyById(id);
		refresh();
	}

	function revertToPending(id: string) {
		setCompanyStatus(id, 'pending');
		refresh();
	}

	function handleLogout() {
		logoutTicAdmin();
		goto('/tic-admin/login');
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

{#if mounted}
	<AdminShell
		brand="TIC Team Admin"
		brandSub="Internal"
		{navItems}
		title="Companies"
		eyebrow="Moderation"
		user="TIC Team"
		onLogout={handleLogout}
	>
		<div class="tabs">
			<button class="tab" class:tab--active={filter === 'pending'} onclick={() => (filter = 'pending')}>
				Pending <span class="tab__count">{counts.pending}</span>
			</button>
			<button class="tab" class:tab--active={filter === 'verified'} onclick={() => (filter = 'verified')}>
				Verified <span class="tab__count">{counts.verified}</span>
			</button>
			<button class="tab" class:tab--active={filter === 'rejected'} onclick={() => (filter = 'rejected')}>
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
											<a class="link" href={company.website} target="_blank" rel="noopener noreferrer">
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
												<button class="btn btn--primary" onclick={() => approve(company.id)}>Approve</button>
												<button class="btn" onclick={() => openReject(company.id)}>Reject</button>
											{:else if company.status === 'verified'}
												<button class="btn" onclick={() => revertToPending(company.id)}>Revert</button>
												<button class="btn" onclick={() => openReject(company.id)}>Reject</button>
											{:else}
												<button class="btn" onclick={() => approve(company.id)}>Approve</button>
												<button class="btn" onclick={() => revertToPending(company.id)}>Revert</button>
											{/if}
											<button class="btn btn--danger" onclick={() => remove(company.id, company.companyName)}>Delete</button>
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
					<textarea bind:value={rejectReason} rows="3" placeholder="e.g. Not affiliated with TIC"></textarea>
				</label>
				<div class="modal__actions">
					<button class="btn" onclick={cancelReject}>Cancel</button>
					<button class="btn btn--danger" onclick={confirmReject}>Reject account</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

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
		border: 1px solid #e6e8ec;
		border-radius: 999px;
		cursor: pointer;

		&:hover {
			background: #f6f7f9;
		}

		&--active {
			color: #fff;
			background: #111;
			border-color: #111;

			&:hover {
				background: #000;
			}
		}
	}

	.tab__count {
		font-size: 11px;
		opacity: 0.7;
	}

	.panel {
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		overflow: hidden;
	}

	.empty {
		margin: 0;
		padding: 40px 18px;
		text-align: center;
		font-size: 13px;
		color: #777;
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
		color: #666;
		background: #fafbfc;
		border-bottom: 1px solid #eef0f3;
	}

	tbody td {
		padding: 12px 14px;
		border-bottom: 1px solid #f1f2f4;
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
		color: #777;
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

		&:hover {
			text-decoration: underline;
		}
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
		border: 1px solid #d8dbe0;
		border-radius: 6px;
		cursor: pointer;

		&:hover {
			background: #f3f4f6;
		}

		&--primary {
			color: #fff;
			background: #111;
			border-color: #111;

			&:hover {
				background: #000;
			}
		}

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
			background: #fff;

			&:hover {
				background: #fdecec;
			}
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
		border-radius: 10px;
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
		color: #666;
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
			border: 1px solid #d8dbe0;
			border-radius: 6px;
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
