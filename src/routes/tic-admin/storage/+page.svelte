<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { StoredObject } from '$lib/server/storageUsage';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const snapshot = $derived(data.storage);

	let filter = $state<string>('all');
	let busy = $state<string | null>(null);

	// The lightbox. Private objects have no URL until one is signed, so the
	// preview holds whatever link it was handed rather than deriving one.
	let preview = $state<{ object: StoredObject; url: string | null; loading: boolean } | null>(null);

	const objects = $derived(snapshot.objects as StoredObject[]);
	const shown = $derived(filter === 'all' ? objects : objects.filter((o) => o.bucket === filter));

	const usedPct = $derived(
		snapshot.quotaBytes > 0 ? Math.min(100, (snapshot.totalBytes / snapshot.quotaBytes) * 100) : 0
	);
	const remaining = $derived(Math.max(0, snapshot.quotaBytes - snapshot.totalBytes));
	const avgSize = $derived(
		snapshot.totalObjects > 0 ? snapshot.totalBytes / snapshot.totalObjects : 0
	);
	const orphans = $derived(objects.filter((o) => !o.referenced).length);

	// Each bucket's share of the plan allowance, the same basis as the meter at the
	// top — so a near-empty project reads as near-empty rather than pinning the
	// largest bucket at full. A bucket with anything in it keeps a thin sliver so
	// it is still visible.
	function bucketPct(bytes: number): number {
		if (snapshot.quotaBytes <= 0 || bytes <= 0) return 0;
		return Math.max(0.6, Math.min(100, (bytes / snapshot.quotaBytes) * 100));
	}

	function fmtBytes(bytes: number): string {
		if (bytes <= 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];

		let i = 0;
		let value = bytes;
		while (value >= 1024 && i < units.length - 1) {
			value /= 1024;
			i += 1;
		}

		// Rounding can land back on the boundary the loop just left: a byte short
		// of a gigabyte is 1023.9999 MB, which prints as "1024 MB". Carry it up
		// rather than show a figure nobody writes.
		const show = (v: number, unit: number) =>
			v >= 100 || unit === 0 ? Math.round(v) : Number(v.toFixed(1));

		if (show(value, i) >= 1024 && i < units.length - 1) {
			value /= 1024;
			i += 1;
		}

		return `${show(value, i)} ${units[i]}`;
	}

	function fmtDate(iso: string): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	/** Public objects carry their URL already; a private one is signed on demand. */
	async function linkFor(object: StoredObject): Promise<string | null> {
		if (object.url) return object.url;
		const params = new URLSearchParams({ bucket: object.bucket, path: object.path });
		const res = await fetch(`/api/tic-admin/storage?${params}`);
		if (!res.ok) return null;
		const body = (await res.json().catch(() => ({}))) as { url?: string };
		return body.url ?? null;
	}

	async function openPreview(object: StoredObject) {
		preview = { object, url: object.url, loading: !object.url };
		if (object.url) return;
		const url = await linkFor(object);
		// Guard against a second preview having replaced this one while we waited.
		if (preview?.object.path === object.path) preview = { object, url, loading: false };
	}

	async function openInTab(object: StoredObject) {
		const url = await linkFor(object);
		if (url) window.open(url, '_blank', 'noopener');
		else showToast('Could not open that file.', 'err');
	}

	async function remove(object: StoredObject) {
		const first = await askConfirm({
			title: `Delete ${object.name}?`,
			body: `It is removed from the ${object.bucket} bucket for good. This cannot be undone.`,
			confirmLabel: 'Delete file',
			tone: 'danger'
		});
		if (!first) return;

		busy = object.path;
		try {
			let res = await send(object, false);

			// 409 means the site still points at it. That deserves its own, blunter
			// question rather than being folded into the first one, which most
			// files would not have needed.
			if (res.status === 409) {
				const anyway = await askConfirm({
					title: 'This file is still in use',
					body: `${object.name} is referenced by a content section or an email template. Deleting it leaves a broken image where it is shown.`,
					confirmLabel: 'Delete anyway',
					tone: 'danger'
				});
				if (!anyway) return;
				res = await send(object, true);
			}

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				showToast(body.message ?? 'Could not delete that file.', 'err');
				return;
			}
			if (preview?.object.path === object.path) preview = null;
			showToast(`Deleted ${object.name}.`, 'ok');
			await invalidateAll();
		} finally {
			busy = null;
		}
	}

	function send(object: StoredObject, force: boolean) {
		const params = new URLSearchParams({ bucket: object.bucket, path: object.path });
		if (force) params.set('force', '1');
		return fetch(`/api/tic-admin/storage?${params}`, { method: 'DELETE' });
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Storage</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Storage"
	eyebrow="Files"
	user={adminName}
	onLogout={handleLogout}
>
	{#if snapshot.problem}
		<p class="msg msg--err">Could not read storage — {snapshot.problem}</p>
	{/if}

	<div class="tiles">
		<div class="tile">
			<span class="tile__label">Total used</span>
			<strong class="tile__value">{fmtBytes(snapshot.totalBytes)}</strong>
			<span class="tile__sub"
				>{usedPct < 0.1 && snapshot.totalBytes > 0 ? '<0.1' : usedPct.toFixed(1)}% of {fmtBytes(
					snapshot.quotaBytes
				)}</span
			>
		</div>
		<div class="tile">
			<span class="tile__label">Remaining</span>
			<strong class="tile__value">{fmtBytes(remaining)}</strong>
			<span class="tile__sub">on the configured plan limit</span>
		</div>
		<div class="tile">
			<span class="tile__label">Files stored</span>
			<strong class="tile__value">{snapshot.totalObjects}</strong>
			<span class="tile__sub">across {snapshot.buckets.length} buckets</span>
		</div>
		<div class="tile">
			<span class="tile__label">Avg. file size</span>
			<strong class="tile__value">{fmtBytes(avgSize)}</strong>
			<span class="tile__sub">{orphans} not referenced anywhere</span>
		</div>
	</div>

	<div class="panel">
		<h2 class="panel__title">Storage breakdown</h2>

		<div class="meter" role="img" aria-label="{usedPct.toFixed(1)} percent of the plan limit used">
			<div
				class="meter__fill"
				style="width: {Math.max(usedPct, snapshot.totalBytes > 0 ? 0.6 : 0)}%"
			></div>
		</div>
		<p class="meter__caption">
			{fmtBytes(snapshot.totalBytes)} of {fmtBytes(snapshot.quotaBytes)} used · {fmtBytes(
				remaining
			)}
			left
		</p>

		<ul class="buckets">
			{#each snapshot.buckets as bucket (bucket.id)}
				<li class="bucket">
					<div class="bucket__head">
						<span class="bucket__name">{bucket.id}</span>
						<span
							class="badge"
							class:badge--good={bucket.public}
							class:badge--info={!bucket.public}
						>
							{bucket.public ? 'Public' : 'Private'}
						</span>
						<span class="bucket__stat">{bucket.objects} files · {fmtBytes(bucket.bytes)}</span>
					</div>
					<div class="bucket__bar">
						<div class="bucket__bar-fill" style="width: {bucketPct(bucket.bytes)}%"></div>
					</div>
				</li>
			{/each}
		</ul>
	</div>

	<div class="tabs">
		<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
			All files <span class="tab__count">{objects.length}</span>
		</button>
		{#each snapshot.buckets as bucket (bucket.id)}
			<button
				class="tab"
				class:tab--active={filter === bucket.id}
				onclick={() => (filter = bucket.id)}
			>
				{bucket.id} <span class="tab__count">{bucket.objects}</span>
			</button>
		{/each}
	</div>

	<div class="panel">
		{#if shown.length === 0}
			<div class="empty">
				<p class="empty__title">Nothing stored here yet</p>
				<p class="empty__body">
					Images uploaded from <a href="/tic-admin/content">Content</a> and
					<a href="/tic-admin/email">Email</a> land in these buckets, along with the documents people
					attach to an application.
				</p>
			</div>
		{:else}
			<div class="files">
				{#each shown as object (object.bucket + '/' + object.path)}
					<div class="file" class:file--busy={busy === object.path}>
						<button
							type="button"
							class="file__thumb"
							onclick={() => openPreview(object)}
							title="Preview {object.name}"
						>
							{#if object.isImage && object.url}
								<img src={object.url} alt="" loading="lazy" />
							{:else}
								<span class="file__ext">{object.name.split('.').pop()?.slice(0, 4) ?? 'file'}</span>
							{/if}
						</button>

						<div class="file__meta">
							<span class="file__name" title={object.path}>{object.name}</span>
							<span class="file__sub">
								{object.bucket}{object.folder ? ` · ${object.folder}` : ''} · {fmtDate(
									object.updatedAt
								)}
							</span>
						</div>

						<span
							class="badge"
							class:badge--good={object.referenced}
							class:badge--warn={!object.referenced}
						>
							{object.referenced ? 'In use' : 'Unused'}
						</span>

						<span class="file__size">{fmtBytes(object.size)}</span>

						<div class="file__actions">
							<button
								type="button"
								class="btn-sm btn-sm--primary"
								onclick={() => openPreview(object)}
							>
								Preview
							</button>
							<button type="button" class="btn-sm" onclick={() => openInTab(object)}>Open</button>
							<button
								type="button"
								class="btn-sm btn-sm--danger"
								disabled={busy === object.path}
								onclick={() => remove(object)}
							>
								{busy === object.path ? '…' : 'Delete'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</AdminShell>

{#if preview}
	<!-- Custom lightbox rather than opening the raw file: a private object needs a
	     signed link, and a gallery should not depend on a popup being allowed. -->
	<div
		class="lightbox"
		role="button"
		tabindex="-1"
		aria-label="Close preview"
		onclick={(e) => {
			if (e.target === e.currentTarget) preview = null;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') preview = null;
		}}
	>
		<div class="lightbox__panel">
			<header class="lightbox__bar">
				<div class="lightbox__id">
					<strong>{preview.object.name}</strong>
					<span
						>{preview.object.bucket} · {fmtBytes(preview.object.size)} · {preview.object
							.mimeType}</span
					>
				</div>
				<button
					type="button"
					class="lightbox__close"
					onclick={() => (preview = null)}
					aria-label="Close"
				>
					✕
				</button>
			</header>

			<div class="lightbox__stage">
				{#if preview.loading}
					<p class="lightbox__note">Signing a link…</p>
				{:else if !preview.url}
					<p class="lightbox__note">That file could not be opened.</p>
				{:else if preview.object.isImage}
					<img src={preview.url} alt={preview.object.name} />
				{:else}
					<p class="lightbox__note">
						No inline preview for {preview.object.mimeType}.
						<a href={preview.url} target="_blank" rel="noopener">Open it in a new tab</a>.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.msg {
		margin: 0 0 16px;
		&--err {
			@include admin-msg-err;
		}
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.tile {
		@include admin-card;
		gap: 4px;
		padding: 18px;
	}

	.tile__label {
		@include admin-field-label;
	}

	.tile__value {
		font-size: 24px;
		font-weight: $font-weight-semibold;
		color: #111;
		line-height: 1.15;
	}

	.tile__sub {
		font-size: 12px;
		color: $admin-ink-3;
	}

	.panel {
		@include admin-panel;
		padding: 20px;
		margin-bottom: 20px;
	}

	.panel__title {
		@include admin-section-title;
		margin: 0 0 14px;
	}

	.meter {
		height: 10px;
		border-radius: 999px;
		background: $admin-line-soft;
		overflow: hidden;
	}

	.meter__fill {
		height: 100%;
		background: #111;
		border-radius: 999px;
	}

	.meter__caption {
		margin: 10px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.buckets {
		list-style: none;
		margin: 20px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.bucket__head {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}

	.bucket__name {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.bucket__stat {
		margin-left: auto;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.bucket__bar {
		height: 6px;
		border-radius: 999px;
		background: #f2f3f5;
		overflow: hidden;
	}

	.bucket__bar-fill {
		height: 100%;
		background: #6b7280;
		border-radius: 999px;
	}

	.badge {
		@include admin-badge;

		&--good {
			@include admin-badge-tone('good');
		}
		&--warn {
			@include admin-badge-tone('warn');
		}
		&--info {
			@include admin-badge-tone('info');
		}
	}

	.tabs {
		@include admin-tabs;
		flex-wrap: wrap;
	}

	.tab {
		@include admin-tab;

		&--active {
			background: #111;
			color: #fff;
			border-color: #111;
		}
	}

	.tab__count {
		@include admin-tab-count;
	}

	.empty {
		@include admin-empty;
		padding: 24px 0;
		text-align: left;
	}

	.empty__title {
		margin: 0 0 6px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.empty__body {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
	}

	.files {
		display: flex;
		flex-direction: column;
	}

	.file {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 0;
		border-bottom: 1px solid #f0f1f4;

		&:first-child {
			padding-top: 2px;
		}

		&:last-child {
			padding-bottom: 2px;
			border-bottom: 0;
		}

		&--busy {
			opacity: 0.55;
		}
	}

	.file__thumb {
		flex: none;
		width: 48px;
		height: 48px;
		padding: 0;
		display: grid;
		place-items: center;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
		overflow: hidden;
		cursor: pointer;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		&:focus-visible {
			outline: 2px solid #111;
			outline-offset: 2px;
		}
	}

	.file__ext {
		font-size: 10px;
		font-weight: $font-weight-semibold;
		text-transform: uppercase;
		color: #8a9099;
	}

	.file__meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.file__name {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file__sub {
		font-size: 11.5px;
		color: $admin-ink-3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file__size {
		flex: none;
		font-size: 12px;
		color: #555;
		min-width: 64px;
		text-align: right;
	}

	.file__actions {
		flex: none;
		display: inline-flex;
		gap: 6px;
	}

	.btn-sm {
		@include admin-btn-small;
	}

	@media (max-width: $bp-sm) {
		.file {
			flex-wrap: wrap;
		}

		.file__size {
			text-align: left;
		}

		.file__actions {
			width: 100%;
		}
	}

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 24px;
		background: rgb(12 14 18 / 0.72);
	}

	.lightbox__panel {
		width: min(880px, 100%);
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		background: #fff;
		border-radius: 12px;
		overflow: hidden;
		font-family: $font-family-base;
	}

	.lightbox__bar {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 16px 18px;
		border-bottom: 1px solid $admin-line-soft;
	}

	.lightbox__id {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;

		strong {
			font-size: 14px;
			color: #111;
		}

		span {
			font-size: 12px;
			color: $admin-ink-3;
		}
	}

	.lightbox__close {
		margin-left: auto;
		flex: none;
		width: 44px;
		height: 44px;
		font: inherit;
		font-size: 14px;
		color: #444;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
		cursor: pointer;
		&:focus-visible {
			outline: 2px solid #111;
			outline-offset: 2px;
		}
	}

	.lightbox__stage {
		flex: 1;
		min-height: 0;
		display: grid;
		place-items: center;
		padding: 20px;
		background: $admin-sunken;
		overflow: auto;

		img {
			max-width: 100%;
			max-height: 70vh;
			object-fit: contain;
		}
	}

	.lightbox__note {
		margin: 0;
		font-size: 13px;
		color: #555;
		text-align: center;
	}
</style>
