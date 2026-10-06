<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminSetApplicationStatus,
		type ApplicationStatus,
		type ApplicationSummary
	} from '$lib/utils/ticAdmin';
	import ReviewProgress, {
		REVIEW_STAGES,
		type ReviewStage
	} from '$lib/components/ReviewProgress.svelte';
	import Info from '@lucide/svelte/icons/info';
	import { floating } from '$lib/utils/floating';
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
		goto(resolve('/login'));
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// The dots legend floats above the table, so its scroll box cannot clip it.
	let tipAnchor = $state<HTMLElement | null>(null);
	const showTip = (event: Event) => (tipAnchor = event.currentTarget as HTMLElement);
	const hideTip = () => (tipAnchor = null);

	// Where it sits in the chain; for a rejection, the step it was turned down at.
	function stageOf(application: Pick<ApplicationSummary, 'status' | 'review_stage' | 'rejected_stage'>): ReviewStage {
		const stage = application.status === 'rejected' ? application.rejected_stage : application.review_stage;
		return (stage ?? 0) as ReviewStage;
	}

	// Admin decides; the CEO may also turn one down. Everyone else reviews.
	const canReject = $derived(data.scope === 'admin' || data.scope === 'ceo');

	function statusLabel(status: ApplicationStatus) {
		return status === 'under-review' ? 'under review' : status;
	}

	// A page at a time; back to the first page whenever the view changes.
	const pager = new Pager(
		() => filtered,
		() => [filter]
	);
</script>

<svelte:head>
	<title>TIC Admin · Applications</title>
</svelte:head>

{#if tipAnchor}
	<div class="tip" role="tooltip" use:floating={{ anchor: tipAnchor, align: 'center', gap: 8 }}>
		<div class="tip__head">
			<span class="tip__title">Review progress</span>
			<span class="tip__bar"></span>
		</div>
		<ol class="tip__steps">
			{#each REVIEW_STAGES as s, i (s.label)}
				<li class="tip__step" style:--c={s.color}>
					<span class="tip__dot">{i + 1}</span>
					<span class="tip__text">
						<span class="tip__label">
							{s.label}
							<span class="tip__role">{s.role}</span>
						</span>
						<span class="tip__detail">{s.detail}</span>
					</span>
				</li>
			{/each}
		</ol>
		<p class="tip__foot"><span class="tip__glow"></span> Glowing dot = step in progress</p>
	</div>
{/if}

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
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
						Submissions from <a href={resolve('/founder/application')}>the incubation form</a> land here
						the moment a founder completes all eight steps.
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
							<th>
								<span class="th-info">
									Status
									<span
										class="info"
										tabindex="0"
										role="button"
										aria-label="What the dots mean"
										onmouseenter={showTip}
										onmouseleave={hideTip}
										onfocus={showTip}
										onblur={hideTip}
									>
										<Info size={13} strokeWidth={2} />
									</span>
								</span>
							</th>
							<th class="actions-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each pager.rows as application (application.id)}
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
									<div>
										<ReviewProgress
											stage={stageOf(application)}
											rejected={application.status === 'rejected'}
										/>
									</div>
									{#if application.review_note}
										<p class="cell__reason">{application.review_note}</p>
									{/if}
								</td>
								<td class="actions-col">
									<div class="actions">
										<a
											class="btn"
											href={resolve('/tic-admin/applications/[id]', { id: application.id })}
										>
											Review
										</a>
										{#if canReject && application.status !== 'rejected'}
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
			<Pagination {pager} noun="applications" />
		{/if}
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
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

	.th-info {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.info {
		position: relative;
		display: inline-flex;
		cursor: help;
		outline: none;
	}

	.tip {
		width: 300px;
		pointer-events: none;
		overflow: hidden;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
		box-shadow:
			0 1px 2px rgba(17, 20, 24, 0.06),
			0 18px 40px -12px rgba(17, 20, 24, 0.22);
		font-family: $font-family-base;
		font-size: 12px;
		line-height: 1.4;
		color: $admin-ink-2;
	}

	.tip__head {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px 10px;
		background: $admin-sunken;
		border-bottom: 1px solid $admin-line-soft;
	}

	.tip__title {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink;
	}

	.tip__bar {
		height: 4px;
		border-radius: $admin-radius-pill;
		background: linear-gradient(90deg, #e5484d, #f76b15, #f5a524, #d6c31f, #8bc34a, #30a46c);
	}

	.tip__steps {
		margin: 0;
		padding: 10px 14px 4px;
		list-style: none;
	}

	.tip__step {
		position: relative;
		display: flex;
		gap: 10px;
		padding-bottom: 10px;

		// The thread joining one step to the next.
		&:not(:last-child)::before {
			content: '';
			position: absolute;
			left: 9px;
			top: 20px;
			bottom: 0;
			width: 2px;
			background: color-mix(in srgb, var(--c) 30%, transparent);
		}
	}

	.tip__dot {
		flex: none;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--c) 16%, white);
		border: 1.5px solid var(--c);
		font-size: 10px;
		font-weight: $font-weight-bold;
		color: color-mix(in srgb, var(--c) 75%, black);
	}

	.tip__text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding-top: 1px;
	}

	.tip__label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.tip__role {
		padding: 1px 7px;
		border-radius: $admin-radius-pill;
		background: color-mix(in srgb, var(--c) 14%, white);
		font-size: 10px;
		font-weight: $font-weight-semibold;
		color: color-mix(in srgb, var(--c) 70%, black);
	}

	.tip__detail {
		color: $admin-ink-3;
	}

	.tip__foot {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 9px 14px;
		border-top: 1px solid $admin-line-soft;
		font-size: 11px;
		color: $admin-ink-3;
	}

	.tip__glow {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f5a524;
		box-shadow: 0 0 0 3px rgba(245, 165, 36, 0.25), 0 0 8px 1px rgba(245, 165, 36, 0.7);
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
		color: $admin-ink-2;
		max-width: 220px;
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
		display: inline-block;
		padding: 6px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		text-decoration: none;
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
</style>
