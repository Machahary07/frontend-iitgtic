<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import { PROFILE_LAYOUTS } from '$lib/utils/startupProfile';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	type Row = PageData['profiles'][number];
	type Filter = 'current' | 'virtual' | 'graduated' | 'unlisted';
	let filter = $state<Filter>('current');

	const inFilter = (p: Row, f: Filter) =>
		f === 'unlisted'
			? !p.listed || p.stage === 'exited'
			: p.listed &&
				(f === 'graduated' ? p.stage === 'graduated' : p.stage === 'current' && (f === 'current' || p.isVirtual));
	const rows = $derived(data.profiles.filter((p) => inFilter(p, filter)));
	const count = (f: Filter) => data.profiles.filter((p) => inFilter(p, f)).length;

	const STATUS: Record<string, string> = {
		draft: 'Founder editing',
		in_review: 'Waiting in Approvals',
		sent_back: 'Sent back',
		approved: 'Approved'
	};
	const layoutLabel = (v: string) => PROFILE_LAYOUTS.find((l) => l.value === v)?.label ?? v;

	let graduating = $state<string | null>(null);
	let outcome = $state('');
	let busy = $state('');

	async function act(id: string, action: string, extra: Record<string, unknown> = {}, done = 'Saved.') {
		busy = id;
		const res = await fetch('/api/tic-admin/startups', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id, action, ...extra })
		});
		busy = '';
		if (!res.ok) {
			const b = (await res.json().catch(() => ({}))) as { message?: string };
			showToast(b.message ?? 'That did not go through.', 'err');
			return;
		}
		graduating = null;
		outcome = '';
		showToast(done);
		await invalidateAll();
	}

	async function exit(p: Row) {
		const ok = await askConfirm({
			title: `Take ${p.name} off the website?`,
			body: 'Its page and listing disappear. The profile is kept, and it can be listed again.',
			confirmLabel: 'Take it off',
			tone: 'danger'
		});
		if (ok) await act(p.id, 'exit', {}, 'Taken off the site.');
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}

	const date = (iso: string | null) =>
		iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
</script>

<svelte:head>
	<title>TIC Admin · Incubatees</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Incubatees"
	eyebrow="On the website"
	user={adminName}
	onLogout={handleLogout}
>
	<p class="lede">
		Every incubated startup's public page. Founders write their profile and send it through Approvals;
		an admin marks the startup live from its application, then moves it between Current, Virtual and
		Graduated here.
	</p>

	<div class="tabs">
		{#each [['current', 'Current'], ['virtual', 'Virtual'], ['graduated', 'Graduated'], ['unlisted', 'Not listed']] as [key, label] (key)}
			<button class="tab" class:tab--active={filter === key} onclick={() => (filter = key as Filter)}>
				{label} <span class="tab__count">{count(key as Filter)}</span>
			</button>
		{/each}
	</div>

	<div class="panel">
		{#if rows.length === 0}
			<p class="empty">Nothing here yet.</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr><th>Startup</th><th>On the site</th><th>Profile</th><th>Dates</th><th class="actions-col">Actions</th></tr>
					</thead>
					<tbody>
						{#each rows as p (p.id)}
							<tr>
								<td>
									<p class="cell__name">{p.name}</p>
									<p class="cell__sub">{layoutLabel(p.layout)}</p>
								</td>
								<td>
									{#if !p.listed || p.stage === 'exited'}
										<span class="badge">Not listed</span>
									{:else}
										<span class="badge badge--good">{p.stage === 'graduated' ? 'Graduated' : 'Current'}</span>
										{#if p.isVirtual && p.stage === 'current'}<span class="badge badge--info">Virtual</span>{/if}
									{/if}
								</td>
								<td><p class="cell__sub">{STATUS[p.status] ?? p.status}</p></td>
								<td>
									<p class="cell__sub">Live {date(p.liveAt)}</p>
									{#if p.graduatedAt}<p class="cell__sub">Graduated {date(p.graduatedAt)}</p>{/if}
								</td>
								<td class="actions-col">
									<div class="actions">
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a class="btn" href={`/incubated-startups/preview/${p.id}${p.hasPublished ? '?v=live' : ''}`} target="_blank" rel="noopener">View</a>
										{#if data.canEdit}
											<a class="btn" href={resolve('/tic-admin/startups/[id]', { id: p.id })}>Edit</a>
										{/if}
										{#if data.canMove}
											{#if p.listed && p.stage === 'current'}
												<button class="btn" disabled={busy === p.id} onclick={() => act(p.id, 'virtual', { value: !p.isVirtual }, p.isVirtual ? 'Removed from Virtual.' : 'Added to Virtual.')}>
													{p.isVirtual ? 'Not virtual' : 'Make virtual'}
												</button>
												<button class="btn" disabled={busy === p.id} onclick={() => (graduating = graduating === p.id ? null : p.id)}>Graduate</button>
											{/if}
											{#if (!p.listed || p.stage === 'exited') && p.hasPublished}
												<button class="btn" disabled={busy === p.id} onclick={() => act(p.id, 'list', { virtual: p.isVirtual }, 'Listed as current.')}>List as current</button>
											{/if}
											{#if p.listed && p.stage !== 'exited'}
												<button class="btn btn--danger" disabled={busy === p.id} onclick={() => exit(p)}>Take off site</button>
											{/if}
										{/if}
									</div>
									{#if graduating === p.id}
										<div class="grad">
											<input placeholder="Outcome, e.g. Raised a seed round" bind:value={outcome} maxlength="300" />
											<button class="btn btn--primary" disabled={busy === p.id} onclick={() => act(p.id, 'graduate', { outcome }, 'Graduated.')}>
												Graduate and email founder
											</button>
										</div>
									{/if}
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

	.lede {
		margin: 0 0 18px;
		max-width: 76ch;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
	}

	.tabs {
		@include admin-tabs;
		margin-bottom: 16px;
	}

	.tab {
		@include admin-tab;
	}

	.tab__count {
		@include admin-tab-count;
	}

	.panel {
		@include admin-panel;
		overflow: hidden;
	}

	.empty {
		@include admin-empty;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		@include admin-table;
	}

	thead th {
		@include admin-thead;
	}

	td {
		@include admin-td;
	}

	.cell__name {
		@include admin-cell-name;
	}

	.cell__sub {
		@include admin-cell-sub;
	}

	.badge {
		@include admin-badge;
		margin: 0 4px 4px 0;
	}

	.badge--good {
		@include admin-badge-tone('good');
	}

	.badge--info {
		@include admin-badge-tone('info');
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: flex-end;
	}

	.actions-col {
		text-align: right;
	}

	.btn {
		@include admin-btn-small;
		text-decoration: none;
	}

	.btn--primary {
		@include admin-btn-primary;
	}

	.btn--danger {
		@include admin-btn-danger;
	}

	.grad {
		display: flex;
		gap: 6px;
		margin-top: 8px;
		justify-content: flex-end;

		input {
			@include admin-input;
			max-width: 280px;
		}
	}
</style>
