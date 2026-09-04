<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminGetImpressions,
		adminListAudit,
		type AuditEntry,
		type Impression,
		type PageViewEntry
	} from '$lib/utils/ticAdmin';
	import type { PageData } from './$types';

	type View = 'audit' | 'impressions';
	type Range = 'all' | '7d' | '30d';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	let view = $state<View>('audit');

	// --- audit ---------------------------------------------------------------
	let extraEntries = $state<AuditEntry[]>([]);
	let auditTable = $state('all');
	let filteredEntries = $state<AuditEntry[] | null>(null);
	let loadingMore = $state(false);
	let exhausted = $state(false);
	let expanded = $state<number | null>(null);

	const entries = $derived(filteredEntries ?? [...(data.entries as AuditEntry[]), ...extraEntries]);

	const TABLES = ['all', 'companies', 'jobs', 'applications', 'profiles'];

	async function reloadAudit(table: string) {
		auditTable = table;
		exhausted = false;
		expanded = null;
		extraEntries = [];
		filteredEntries = table === 'all' ? null : await adminListAudit({ table });
	}

	async function loadMore() {
		if (loadingMore || entries.length === 0) return;
		loadingMore = true;
		const older = await adminListAudit({
			table: auditTable,
			before: entries[entries.length - 1].id
		});
		loadingMore = false;
		if (older.length === 0) {
			exhausted = true;
			return;
		}
		if (filteredEntries) filteredEntries = [...filteredEntries, ...older];
		else extraEntries = [...extraEntries, ...older];
	}

	// --- impressions ---------------------------------------------------------
	let range = $state<Range>('all');
	let rangeImpressions = $state<Impression[] | null>(null);
	let loadingRange = $state(false);

	const impressions = $derived(rangeImpressions ?? (data.impressions as Impression[]));
	const recent = $derived(data.recent as PageViewEntry[]);

	const totals = $derived({
		views: impressions.reduce((sum, i) => sum + Number(i.total), 0),
		visitors: impressions.reduce((sum, i) => sum + Number(i.visitors), 0),
		bots: impressions.reduce((sum, i) => sum + Number(i.bots), 0),
		pages: impressions.length
	});

	async function changeRange(next: Range) {
		range = next;
		if (next === 'all') {
			rangeImpressions = null;
			return;
		}
		loadingRange = true;
		rangeImpressions = await adminGetImpressions(next);
		loadingRange = false;
	}

	// Card headings. Named routes get a proper label; anything else falls back to
	// title-casing the last segment, so "/about/governing-body" reads as
	// "Governing Body" without needing an entry here.
	const PAGE_NAMES: Record<string, string> = {
		'/': 'Home',
		'/about': 'About TIC',
		'/about/faq': 'FAQ',
		'/about/team': 'TIC Team',
		'/about/blog': 'Blog',
		'/about/what-happens': 'What Happens',
		'/apply': 'Sign Up',
		'/login': 'Login',
		'/application': 'Application Form',
		'/opportunities': 'Opportunities',
		'/incubated-startups': 'Incubated Startups',
		'/status': 'Build Status',
		'/tic-admin': 'Admin · Overview',
		'/tic-admin/login': 'Admin · Sign In',
		'/tic-admin/users': 'Admin · Users',
		'/tic-admin/activity': 'Admin · Activity',
		'/tic-admin/companies': 'Admin · Companies',
		'/tic-admin/applications': 'Admin · Applications',
		'/tic-admin/jobs': 'Admin · Posted Jobs',
		'/tic-admin/home-page': 'Admin · Home Page',
		'/opportunities/job-posting-admin': 'Company Portal'
	};

	function pageTitle(path: string): string {
		if (PAGE_NAMES[path]) return PAGE_NAMES[path];
		const segments = path.split('/').filter(Boolean);
		const last = segments[segments.length - 1] ?? path;
		return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function compact(n: number | string): string {
		const value = Number(n);
		if (value >= 1000) {
			const k = value / 1000;
			return `${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
		}
		return String(value);
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	function fmtTime(iso: string) {
		return new Date(iso).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	// The interesting part of an update is what actually moved, not the whole row.
	function changedFields(entry: AuditEntry): { field: string; from: unknown; to: unknown }[] {
		if (!entry.before || !entry.after) return [];
		const keys = new Set([...Object.keys(entry.before), ...Object.keys(entry.after)]);
		const changes: { field: string; from: unknown; to: unknown }[] = [];
		for (const key of keys) {
			const from = entry.before[key];
			const to = entry.after[key];
			if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field: key, from, to });
		}
		return changes;
	}

	function preview(value: unknown): string {
		if (value === null || value === undefined) return '—';
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		return text.length > 120 ? text.slice(0, 120) + '…' : text;
	}
</script>

<svelte:head>
	<title>TIC Admin · Activity</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	title="Activity"
	eyebrow="Audit & traffic"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="tabs">
		<button class="tab" class:tab--active={view === 'audit'} onclick={() => (view = 'audit')}>
			Audit log
		</button>
		<button
			class="tab"
			class:tab--active={view === 'impressions'}
			onclick={() => (view = 'impressions')}
		>
			Page impressions
		</button>
	</div>

	{#if view === 'audit'}
		<p class="note">
			Written by database triggers, so a row changed anywhere — this console, the company portal, or
			the SQL editor — is recorded. Entries cannot be edited or deleted from the app.
		</p>

		<div class="filters">
			{#each TABLES as table (table)}
				<button
					class="chip"
					class:chip--active={auditTable === table}
					onclick={() => reloadAudit(table)}
				>
					{table}
				</button>
			{/each}
		</div>

		<div class="panel">
			{#if entries.length === 0}
				<p class="empty">Nothing recorded yet.</p>
			{:else}
				<ul class="feed">
					{#each entries as entry (entry.id)}
						{@const changes = changedFields(entry)}
						<li class="event">
							<div class="event__main">
								<div class="event__line">
									<span class="who">{entry.actor_label}</span>
									<span class="what">{entry.action}</span>
									<span class="src src--{entry.source}">{entry.source}</span>
								</div>
								<p class="event__meta">
									{fmtTime(entry.occurred_at)}
									{#if entry.record_id}· <code>{entry.record_id.slice(0, 8)}</code>{/if}
								</p>
								{#if changes.length > 0 && expanded !== entry.id}
									<p class="event__fields">
										{changes
											.slice(0, 4)
											.map((c) => c.field)
											.join(', ')}{changes.length > 4 ? ` +${changes.length - 4} more` : ''}
									</p>
								{/if}
							</div>
							{#if entry.before || entry.after}
								<button
									class="btn"
									onclick={() => (expanded = expanded === entry.id ? null : entry.id)}
								>
									{expanded === entry.id ? 'Hide' : 'Detail'}
								</button>
							{/if}

							{#if expanded === entry.id}
								<div class="detail">
									{#if changes.length > 0}
										<table class="diff">
											<thead>
												<tr><th>Field</th><th>Before</th><th>After</th></tr>
											</thead>
											<tbody>
												{#each changes as change (change.field)}
													<tr>
														<td class="diff__field">{change.field}</td>
														<td class="diff__from">{preview(change.from)}</td>
														<td class="diff__to">{preview(change.to)}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									{:else}
										<pre>{JSON.stringify(entry.after ?? entry.before, null, 2)}</pre>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if entries.length > 0 && !exhausted}
			<button class="btn load-more" onclick={loadMore} disabled={loadingMore}>
				{loadingMore ? 'Loading…' : 'Load older entries'}
			</button>
		{/if}
	{:else}
		<div class="impressions__head">
			<div>
				<h2 class="impressions__title">Page impressions</h2>
				<p class="impressions__sub">
					{compact(totals.views)} views · {compact(totals.visitors)} visitors · {compact(
						totals.bots
					)} bot hits across {totals.pages} pages
				</p>
			</div>
			<div class="range" role="group" aria-label="Time range">
				<button
					class="range__opt"
					class:range__opt--on={range === 'all'}
					onclick={() => changeRange('all')}
				>
					All time
				</button>
				<button
					class="range__opt"
					class:range__opt--on={range === '30d'}
					onclick={() => changeRange('30d')}
				>
					30 days
				</button>
				<button
					class="range__opt"
					class:range__opt--on={range === '7d'}
					onclick={() => changeRange('7d')}
				>
					7 days
				</button>
			</div>
		</div>

		{#if loadingRange}
			<p class="empty">Loading…</p>
		{:else if impressions.length === 0}
			<div class="panel">
				<p class="empty">No page views recorded in this window yet.</p>
			</div>
		{:else}
			<div class="cards">
				{#each impressions as row (row.path)}
					<article class="metric" class:metric--admin={row.is_admin}>
						<header class="metric__head">
							<h3 class="metric__title" title={row.path}>{pageTitle(row.path)}</h3>
							{#if row.is_admin}<span class="metric__tag">admin</span>{/if}
						</header>
						<p class="metric__path">{row.path}</p>
						<p class="metric__value">
							{compact(row.total)}<span class="metric__unit">total</span>
						</p>
						<div class="metric__stats">
							<span class="stat stat--people" title="Unique human visitors">
								<svg viewBox="0 0 16 16" aria-hidden="true"
									><path
										d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1.5c-3 0-5 1.6-5 3.3V14h10v-1.2c0-1.7-2-3.3-5-3.3z"
									/></svg
								>
								{compact(row.visitors)}
							</span>
							<span class="stat stat--bots" title="Requests from bots and crawlers">
								<svg viewBox="0 0 16 16" aria-hidden="true"
									><path
										d="M8 1v2M4 5h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2zm2 3v2m4-2v2"
										fill="none"
										stroke="currentColor"
										stroke-width="1.4"
										stroke-linecap="round"
									/></svg
								>
								{compact(row.bots)}
							</span>
						</div>
					</article>
				{/each}
			</div>
		{/if}

		<section class="card recent">
			<h2>Recent visits</h2>
			{#if recent.length === 0}
				<p class="empty">No visits recorded yet.</p>
			{:else}
				<ul class="paths">
					{#each recent as visit (visit.id)}
						<li class="path">
							<div class="path__main">
								<span class="path__name">{visit.path}</span>
								{#if visit.actor_label}
									<span class="path__who">{visit.actor_label}</span>
								{:else}
									<span class="path__who path__who--anon">
										visitor {visit.visitor_id.slice(0, 6)}
									</span>
								{/if}
							</div>
							<span class="path__count">{fmtTime(visit.occurred_at)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
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
	.panel {
		@include admin-panel;
	}
	.empty {
		@include admin-empty;
	}
	.btn {
		@include admin-btn-small;
	}

	.note {
		margin: 0 0 14px;
		font-size: 12px;
		color: $admin-ink-2;
		padding: 10px 12px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-left: 3px solid #2050d4;
		border-radius: $admin-radius-sm;
		max-width: 78ch;
	}

	.filters {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}

	.chip {
		padding: 5px 11px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: #555;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		&--active {
			color: #111;
			border-color: #111;
			font-weight: $font-weight-semibold;
		}
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.event {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 8px 14px;
		padding: 12px 14px;
		border-bottom: 1px solid $admin-line-soft;

		&:last-child {
			border-bottom: 0;
		}
	}

	.event__main {
		min-width: 0;
	}

	.event__line {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}

	.who {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.what {
		font-size: 13px;
		color: #444;
	}

	.src {
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 1px 6px;
		border-radius: 999px;

		&--trigger {
			background: $admin-line-soft;
			color: #555;
		}

		&--app {
			background: #e2e8f5;
			color: #24427e;
		}
	}

	.event__meta {
		margin: 3px 0 0;
		font-size: 11px;
		color: #999;

		code {
			font-size: 11px;
			background: $admin-line-soft;
			padding: 1px 4px;
			border-radius: 3px;
		}
	}

	.event__fields {
		margin: 4px 0 0;
		font-size: 11px;
		color: $admin-ink-3;
		overflow-wrap: anywhere;
	}

	.detail {
		grid-column: 1 / -1;
		overflow-x: auto;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-sm;
		padding: 10px;

		pre {
			margin: 0;
			font-size: 11px;
			line-height: 1.55;
			color: #333;
		}
	}

	.diff {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;

		th {
			text-align: left;
			padding: 4px 8px;
			font-size: 10px;
			letter-spacing: 0.07em;
			text-transform: uppercase;
			color: $admin-ink-3;
		}

		td {
			padding: 4px 8px;
			vertical-align: top;
			overflow-wrap: anywhere;
			border-top: 1px solid $admin-line-soft;
		}
	}

	.diff__field {
		font-weight: $font-weight-semibold;
		color: #111;
		white-space: nowrap;
	}

	.diff__from {
		color: #9a1515;
	}

	.diff__to {
		color: #0e6b2c;
	}

	.load-more {
		margin-top: 14px;
	}

	.card {
		@include admin-card;

		h2 {
			@include admin-section-title;
			font-size: 15px;
		}
	}

	.impressions__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.impressions__title {
		@include admin-section-title;
		font-size: 16px;
	}

	.impressions__sub {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: $admin-ink-3;
		font-variant-numeric: tabular-nums;
	}

	.range {
		display: inline-flex;
		padding: 3px;
		background: $admin-line-soft;
		border-radius: $admin-radius-md;
		gap: 2px;
	}

	.range__opt {
		padding: 6px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #555;
		background: transparent;
		border: 0;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		&--on {
			color: #111;
			background: #fff;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		}
	}

	// One card per page, the way the impressions grid reads at a glance: name,
	// the number that matters, then people and bots split out beneath it.
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 12px;
	}

	.metric {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 18px 14px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		font-family: $font-family-base;

		&--admin {
			border-color: #d9e0f2;
			background: linear-gradient(180deg, #fbfcff 0%, #fff 60%);
		}
	}

	.metric__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.metric__title {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.metric__tag {
		flex: none;
		padding: 2px 7px;
		font-size: 9px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #24427e;
		background: #e2e8f5;
		border-radius: 999px;
	}

	.metric__path {
		margin: 0 0 10px;
		font-size: 11px;
		color: #9aa1ab;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.metric__value {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin: 0 0 12px;
		font-size: 30px;
		font-weight: $font-weight-bold;
		line-height: 1;
		color: #111;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.metric__unit {
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #9aa1ab;
	}

	.metric__stats {
		display: flex;
		gap: 6px;
	}

	.stat {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 9px;
		font-size: 11.5px;
		font-weight: $font-weight-semibold;
		border-radius: $admin-radius-sm;
		font-variant-numeric: tabular-nums;

		svg {
			width: 12px;
			height: 12px;
			flex: none;
		}

		&--people {
			color: #0e6b2c;
			background: #e8f7ee;

			svg {
				fill: currentColor;
			}
		}

		&--bots {
			color: #5b4b8a;
			background: #efecf8;

			svg {
				fill: none;
				stroke: currentColor;
			}
		}
	}

	.recent {
		margin-top: 16px;
	}

	.paths {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		max-height: 420px;
		overflow-y: auto;
	}

	.path {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		padding: 8px 0;
		border-bottom: 1px solid $admin-line-soft;

		&:last-child {
			border-bottom: 0;
		}
	}

	.path__main {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	.path__name {
		font-size: 12.5px;
		color: #111;
		overflow-wrap: anywhere;
	}

	.path__who {
		font-size: 11px;
		color: $admin-ink-2;
		white-space: nowrap;

		&--anon {
			color: $admin-ink-3;
		}
	}

	.path__count {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.badge {
		@include admin-badge;

		&--info {
			@include admin-badge-tone('info');
		}
	}
</style>
