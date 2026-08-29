<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { adminSetApplicationStatus, type ApplicationStatus } from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';

	type Filter = 'all' | ApplicationStatus;

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const applications = $derived(data.applications);

	let filter = $state<Filter>('submitted');

	const refresh = () => invalidateAll();

	const filtered = $derived(
		filter === 'all' ? applications : applications.filter((a) => a.status === filter)
	);

	const counts = $derived({
		all: applications.length,
		submitted: applications.filter((a) => a.status === 'submitted').length,
		'under-review': applications.filter((a) => a.status === 'under-review').length,
		accepted: applications.filter((a) => a.status === 'accepted').length,
		rejected: applications.filter((a) => a.status === 'rejected').length
	});

	async function setStatus(id: string, status: ApplicationStatus) {
		await adminSetApplicationStatus(id, status);
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

	function statusLabel(status: ApplicationStatus) {
		return status === 'under-review' ? 'under review' : status;
	}
</script>

<svelte:head>
	<title>TIC Admin · Applications</title>
</svelte:head>

<AdminShell
		brand="TIC Team Admin"
		brandSub="Internal"
		navItems={TIC_ADMIN_NAV}
		title="Applications"
		eyebrow="Incubation"
		user={adminName}
		onLogout={handleLogout}
	>
		<div class="tabs">
			<button
				class="tab"
				class:tab--active={filter === 'submitted'}
				onclick={() => (filter = 'submitted')}
			>
				New <span class="tab__count">{counts.submitted}</span>
			</button>
			<button
				class="tab"
				class:tab--active={filter === 'under-review'}
				onclick={() => (filter = 'under-review')}
			>
				Under review <span class="tab__count">{counts['under-review']}</span>
			</button>
			<button
				class="tab"
				class:tab--active={filter === 'accepted'}
				onclick={() => (filter = 'accepted')}
			>
				Accepted <span class="tab__count">{counts.accepted}</span>
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
				{#if applications.length === 0}
					<div class="empty-state">
						<p class="empty-state__title">No applications yet</p>
						<p class="empty-state__body">
							Submissions from <a href={resolve('/application')}>the incubation form</a> land here the
							moment
							a founder completes all eight steps.
						</p>
					</div>
				{:else}
					<p class="empty">No applications in this view.</p>
				{/if}
			{:else}
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th>Startup</th>
								<th>Founder</th>
								<th>Submitted</th>
								<th>Status</th>
								<th class="actions-col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filtered as application (application.id)}
								<tr>
									<td>
										<p class="cell__name">{application.startup_name || 'Untitled startup'}</p>
										<p class="cell__sub">
											<a
												class="link"
												href={resolve('/tic-admin/applications/[id]', { id: application.id })}
											>
												Open full application →
											</a>
										</p>
									</td>
									<td>
										<p class="cell__name">{application.full_name || '—'}</p>
										<p class="cell__sub">{application.email}</p>
									</td>
									<td><p class="cell__sub">{fmtDate(application.created_at)}</p></td>
									<td>
										<span class="badge badge--{application.status}">
											{statusLabel(application.status)}
										</span>
										{#if application.review_note}
											<p class="cell__reason">{application.review_note}</p>
										{/if}
									</td>
									<td class="actions-col">
										<div class="actions">
											{#if application.status !== 'under-review'}
												<button class="btn" onclick={() => setStatus(application.id, 'under-review')}>
													Review
												</button>
											{/if}
											{#if application.status !== 'accepted'}
												<button
													class="btn btn--primary"
													onclick={() => setStatus(application.id, 'accepted')}
												>
													Accept
												</button>
											{/if}
											{#if application.status !== 'rejected'}
												<button
													class="btn btn--danger"
													onclick={() => setStatus(application.id, 'rejected')}
												>
													Reject
												</button>
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

	.empty-state {
		padding: 48px 24px;
		text-align: center;
	}

	.empty-state__title {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.empty-state__body {
		margin: 0 auto;
		max-width: 380px;
		font-size: 13px;
		line-height: 1.6;
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
		color: #666;
		max-width: 220px;
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

		&--submitted {
			background: #e2e8f5;
			color: #24427e;
		}

		&--under-review {
			background: #fff4d4;
			color: #6a4f00;
		}

		&--accepted {
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
</style>
