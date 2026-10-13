<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { adminDeleteCompany, adminSetCompanyStatus } from '$lib/utils/ticAdmin';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import { PROFILE_LAYOUTS } from '$lib/utils/startupProfile';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	type Row = PageData['rows'][number];
	type Filter = 'current' | 'virtual' | 'graduated' | 'off' | 'rejected' | 'all';
	let filter = $state<Filter>('current');

	// Where each startup sits. "Not on the site" is every accepted startup without
	// a listed page yet — profile still being written, waiting for approval, or
	// taken off.
	function inFilter(r: Row, f: Filter): boolean {
		const p = r.profile;
		const rejected = r.company?.status === 'rejected';
		if (f === 'all') return true;
		if (f === 'rejected') return rejected;
		if (rejected) return false;
		if (f === 'off') return !p?.onSite;
		if (!p?.onSite) return false;
		if (f === 'graduated') return p.stage === 'graduated';
		return p.stage === 'current' && (f === 'current' || p.isVirtual);
	}
	const TABS: [Filter, string][] = [
		['current', 'Current'],
		['virtual', 'Virtual'],
		['graduated', 'Graduated'],
		['off', 'Not on the site'],
		['rejected', 'Rejected'],
		['all', 'All']
	];
	const filtered = $derived(data.rows.filter((r) => inFilter(r, filter)));
	const count = (f: Filter) => data.rows.filter((r) => inFilter(r, f)).length;
	const pager = new Pager(
		() => filtered,
		() => [filter]
	);

	const PROFILE_STATUS: Record<string, string> = {
		draft: 'Founder editing',
		in_review: 'Waiting in Approvals',
		sent_back: 'Sent back to founder',
		approved: 'Approved'
	};
	const layoutLabel = (v: string) => PROFILE_LAYOUTS.find((l) => l.value === v)?.label ?? v;
	const date = (iso: string | null | undefined) =>
		iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

	// ---- website actions (admin) ----
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

	async function takeOff(r: Row) {
		const ok = await askConfirm({
			title: `Take ${r.name} off the website?`,
			body: 'Its page and listing disappear. The profile is kept, and it can be listed again.',
			confirmLabel: 'Take it off',
			tone: 'danger'
		});
		if (ok && r.profile) await act(r.profile.id, 'exit', {}, 'Taken off the site.');
	}

	// ---- company record actions ----
	let rejectingId = $state<string | null>(null);
	let rejectReason = $state('');

	async function setStatus(id: string, status: 'verified' | 'pending') {
		await adminSetCompanyStatus(id, status);
		await invalidateAll();
	}

	async function confirmReject() {
		if (!rejectingId) return;
		await adminSetCompanyStatus(rejectingId, 'rejected', rejectReason.trim() || undefined);
		rejectingId = null;
		rejectReason = '';
		await invalidateAll();
	}

	async function remove(id: string, name: string) {
		const ok = await askConfirm({
			title: `Permanently delete "${name}"?`,
			body: 'The startup, its roles and its public page go. The founder who created it keeps their account and any other startups they run. This cannot be undone.',
			confirmLabel: 'Delete startup',
			tone: 'danger'
		});
		if (!ok) return;
		await adminDeleteCompany(id);
		await invalidateAll();
	}

	async function startProfile(companyId: string) {
		busy = companyId;
		const res = await fetch('/api/tic-admin/startups', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ companyId })
		});
		busy = '';
		const b = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
		if (!res.ok || !b.id) {
			showToast(b.message ?? 'Could not start the profile.', 'err');
			return;
		}
		goto(resolve('/tic-admin/startups/[id]', { id: b.id }));
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Incubatees</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Incubatees"
	eyebrow="Accepted startups"
	user={adminName}
	onLogout={handleLogout}
>
	<p class="lede">
		Every startup TIC has accepted: its company record and its page on the website. Founders write
		their profile and send it through Approvals; an admin marks the startup live from its
		application, then moves it between Current, Virtual and Graduated here.
	</p>

	<div class="tabs">
		{#each TABS as [key, label] (key)}
			<button class="tab" class:tab--active={filter === key} onclick={() => (filter = key)}>
				{label} <span class="tab__count">{count(key)}</span>
			</button>
		{/each}
	</div>

	<div class="panel">
		{#if filtered.length === 0}
			<p class="empty">Nothing here yet.</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Startup</th>
							<th>Contact</th>
							<th>On the website</th>
							<th>Dates</th>
							<th class="actions-col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each pager.rows as r (r.key)}
							{@const p = r.profile}
							{@const c = r.company}
							<tr>
								<td>
									<p class="cell__name">{r.name}</p>
									{#if c}<p class="cell__sub">{c.email}</p>{/if}
									{#if c?.status === 'rejected'}
										<span class="badge badge--bad">Rejected</span>
										{#if c.rejectionReason}<p class="cell__reason">Reason: {c.rejectionReason}</p>{/if}
									{:else if c?.status === 'pending'}
										<span class="badge">Pending</span>
									{/if}
								</td>
								<td>
									{#if c}
										<p class="cell__name">{c.contactName || '—'}</p>
										{#if c.contactEmail}<p class="cell__sub">{c.contactEmail}</p>{/if}
										{#if c.phone}<p class="cell__sub">{c.phone}</p>{/if}
										{#if c.website}
											<!-- The startup's own site, outside this app. -->
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a class="link" href={c.website} target="_blank" rel="noopener noreferrer"
												>{c.website.replace(/^https?:\/\//, '')}</a
											>
										{/if}
									{:else}
										<p class="cell__sub">Listed before profiles were founder-run</p>
									{/if}
								</td>
								<td>
									{#if !p}
										<p class="cell__sub">Profile not started</p>
									{:else}
										{#if p.onSite}
											<span class="badge badge--good">{p.stage === 'graduated' ? 'Graduated' : 'Current'}</span>
											{#if p.isVirtual && p.stage === 'current'}<span class="badge badge--info">Virtual</span>{/if}
										{:else}
											<span class="badge">{p.stage === 'exited' ? 'Taken off' : 'Not listed'}</span>
										{/if}
										<p class="cell__sub">{PROFILE_STATUS[p.status] ?? p.status} · {layoutLabel(p.layout)}</p>
									{/if}
								</td>
								<td>
									{#if c}<p class="cell__sub">Signed up {date(c.createdAt)}</p>{/if}
									{#if p?.liveAt}<p class="cell__sub">Live {date(p.liveAt)}</p>{/if}
									{#if p?.graduatedAt}<p class="cell__sub">Graduated {date(p.graduatedAt)}</p>{/if}
								</td>
								<td class="actions-col">
									<div class="actions">
										{#if p}
											<!-- A public-site page, opened in a new tab. -->
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
											<a class="btn" href={p.viewHref} target="_blank" rel="noopener"
												>{p.onSite ? 'View profile' : 'Preview profile'}</a
											>
											{#if data.canEdit}
												<a class="btn" href={resolve('/tic-admin/startups/[id]', { id: p.id })}>Edit</a>
											{/if}
										{/if}
										{#if !p && c && c.status === 'verified' && data.canEdit}
											<button class="btn" disabled={busy === c.id} onclick={() => startProfile(c.id)}>Start profile</button>
										{/if}
										{#if data.canMove && p}
											{#if p.onSite && p.stage === 'current'}
												<button
													class="btn"
													disabled={busy === p.id}
													onclick={() =>
														act(p.id, 'virtual', { value: !p.isVirtual }, p.isVirtual ? 'Removed from Virtual.' : 'Added to Virtual.')}
												>
													{p.isVirtual ? 'Not virtual' : 'Make virtual'}
												</button>
												<button class="btn" disabled={busy === p.id} onclick={() => (graduating = graduating === p.id ? null : p.id)}
													>Graduate</button
												>
											{/if}
											{#if !p.onSite && p.hasPublished}
												<button class="btn" disabled={busy === p.id} onclick={() => act(p.id, 'list', { virtual: p.isVirtual }, 'Listed as current.')}
													>List as current</button
												>
											{/if}
											{#if p.onSite}
												<button class="btn btn--danger" disabled={busy === p.id} onclick={() => takeOff(r)}>Take off site</button>
											{/if}
										{/if}
										{#if c}
											{#if c.status === 'verified'}
												<button class="btn" onclick={() => setStatus(c.id, 'pending')}>Revert</button>
												<button class="btn" onclick={() => ((rejectingId = c.id), (rejectReason = ''))}>Reject</button>
											{:else if c.status === 'pending'}
												<button class="btn btn--primary" onclick={() => setStatus(c.id, 'verified')}>Approve</button>
												<button class="btn" onclick={() => ((rejectingId = c.id), (rejectReason = ''))}>Reject</button>
											{:else}
												<button class="btn" onclick={() => setStatus(c.id, 'verified')}>Approve</button>
												<button class="btn" onclick={() => setStatus(c.id, 'pending')}>Revert</button>
											{/if}
											<button class="btn btn--danger" onclick={() => remove(c.id, c.companyName)}>Delete</button>
										{/if}
									</div>
									{#if p && graduating === p.id}
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
			<Pagination {pager} noun="startups" />
		{/if}
	</div>
</AdminShell>

{#if rejectingId}
	<div class="modal-backdrop">
		<button type="button" class="modal-close-area" aria-label="Cancel rejection" onclick={() => (rejectingId = null)}></button>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1">
			<h3>Reject startup</h3>
			<p class="modal__sub">Optionally add a reason — shown to the founder in their console.</p>
			<label class="field">
				<span>Reason (optional)</span>
				<textarea bind:value={rejectReason} rows="3" placeholder="e.g. Not affiliated with TIC"></textarea>
			</label>
			<div class="modal__actions">
				<button class="btn" onclick={() => (rejectingId = null)}>Cancel</button>
				<button class="btn btn--danger" onclick={confirmReject}>Reject startup</button>
			</div>
		</div>
	</div>
{/if}

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
		@include admin-table(900px);
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

	.cell__reason {
		margin: 6px 0 0;
		max-width: 220px;
		font-size: 11px;
		color: admin-tone-fg('bad');
	}

	.link {
		font-size: 12px;
		color: $admin-accent;
		text-decoration: none;
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

	.badge--bad {
		@include admin-badge-tone('bad');
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

	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(0, 0, 0, 0.4);
	}

	.modal-close-area {
		position: absolute;
		inset: 0;
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	.modal {
		@include admin-card;
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 440px;

		h3 {
			margin: 0 0 6px;
			font-size: 16px;
		}
	}

	.modal__sub {
		margin: 0 0 16px;
		font-size: 13px;
		color: $admin-ink-2;
	}

	.field {
		display: grid;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		textarea {
			@include admin-input;
			resize: vertical;
		}
	}

	.modal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 18px;
	}
</style>
