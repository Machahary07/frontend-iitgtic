<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminGetEmailMessage,
		adminLiftSuppression,
		adminListEmailLog,
		adminListNewsletter,
		type EmailLogEntry,
		type EmailMessage,
		type EmailStatus
	} from '$lib/utils/ticAdmin';
	import { downloadCsv, stampedFileName, toCsv } from '$lib/utils/csv';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const config = $derived(data.config);
	const usage = $derived(data.usage);

	// The log is paged, so it lives in state seeded from the load rather than
	// being read straight off `data` — "Load more" appends to it.
	let entries = $state<EmailLogEntry[]>([]);
	let hasMore = $state(false);
	let statusFilter = $state<EmailStatus | 'all'>('all');
	let showTests = $state(false);
	let loadingMore = $state(false);
	let lifting = $state('');
	let exportingList = $state(false);

	// Pulled on demand rather than shipped with the page: the console shows a
	// count, and only the export needs the addresses themselves.
	async function exportNewsletter() {
		exportingList = true;
		try {
			const subscribers = await adminListNewsletter();
			if (subscribers.length === 0) return;

			downloadCsv(
				stampedFileName('newsletter'),
				toCsv(
					['Email', 'Source', 'Subscribed'],
					subscribers.map((sub) => [sub.email, sub.source, fmtWhen(sub.created_at)])
				)
			);
		} finally {
			exportingList = false;
		}
	}

	// Suppression is the right default — mailing a hard bounce again is what gets
	// a sending domain blocked — but it is not permanent. A mailbox that was full
	// gets emptied, and this is how it starts receiving again.
	async function liftSuppression(email: string) {
		lifting = email;
		try {
			await adminLiftSuppression(email);
			await invalidateAll();
		} finally {
			lifting = '';
		}
	}

	// A fresh server load (a filter change navigates, a save invalidates) replaces
	// the page rather than appending to it.
	$effect(() => {
		entries = data.log as EmailLogEntry[];
		hasMore = data.hasMore;
	});

	const visible = $derived(
		entries.filter(
			(e) => (statusFilter === 'all' || e.status === statusFilter) && (showTests || !e.is_test)
		)
	);

	const counts = $derived({
		all: entries.filter((e) => showTests || !e.is_test).length,
		sent: entries.filter((e) => e.status === 'sent' && (showTests || !e.is_test)).length,
		failed: entries.filter((e) => e.status === 'failed' && (showTests || !e.is_test)).length,
		blocked: entries.filter((e) => e.status === 'blocked' && (showTests || !e.is_test)).length
	});

	// Tests are hidden by default, so an all-test log would otherwise read as an
	// empty one — worth saying which it is.
	const hiddenTests = $derived(showTests ? 0 : entries.filter((e) => e.is_test).length);

	const customised = $derived(data.templates.filter((t) => t.customised).length);
	const disabled = $derived(data.templates.filter((t) => !t.enabled).length);

	// The trend chart is scaled to its own busiest day, so a quiet month still
	// shows shape instead of a flat line at the bottom of the box.
	const trendPeak = $derived(Math.max(1, ...data.trend.map((d) => d.sent + d.failed + d.blocked)));

	async function loadMore() {
		const oldest = entries.at(-1)?.created_at;
		if (!oldest || loadingMore) return;

		loadingMore = true;
		const next = await adminListEmailLog({ before: oldest });
		entries = [...entries, ...next];
		hasMore = next.length === 25;
		loadingMore = false;
	}

	// --- preview -------------------------------------------------------------

	let preview = $state<EmailMessage | null>(null);
	let previewing = $state<string | null>(null);

	async function openPreview(id: string) {
		previewing = id;
		preview = await adminGetEmailMessage(id);
		previewing = null;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') preview = null;
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	function fmtWhen(iso: string) {
		return new Date(iso).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function fmtDay(day: string) {
		return new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	function fmtNumber(value: number) {
		return value.toLocaleString('en-GB');
	}

	function fmtReset(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	function templateName(key: string) {
		return data.templates.find((t) => t.key === key)?.name ?? key;
	}
</script>

<svelte:head>
	<title>TIC Admin · Email</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<AdminShell
	brand="TIC Team Admin"
	brandSub="Internal"
	navItems={TIC_ADMIN_NAV}
	title="Email"
	eyebrow="Delivery"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="head-btn" href={resolve('/tic-admin/email/templates')}>Templates →</a>
	{/snippet}

	{#if !config.configured}
		<div class="banner banner--warn">
			<p class="banner__title">Email is not configured</p>
			<p class="banner__body">
				<code>RESEND_API_KEY</code> is not set, so nothing is being delivered. Everything the app
				tries to send is still rendered and recorded below as <strong>blocked</strong>, so you can
				see exactly what would have gone out. Add the key to <code>.env.local</code> and to the Vercel
				environment, then restart.
			</p>
		</div>
	{:else if data.sendingDomain.state === 'sandbox'}
		<div class="banner banner--info">
			<p class="banner__title">Sending from Resend's sandbox address</p>
			<p class="banner__body">
				<code>{config.from}</code> only delivers to the address that owns the API key — real
				applicants will not receive anything. Add your domain in Resend, publish the DNS records it
				gives you, then set <code>RESEND_FROM</code> to an address on it.
			</p>
		</div>
	{:else if data.sendingDomain.state !== 'verified'}
		<div
			class="banner banner--info"
			class:banner--warn={data.sendingDomain.state === 'failed' ||
				data.sendingDomain.state === 'not-added'}
		>
			<p class="banner__title">
				{data.sendingDomain.state === 'unknown'
					? 'Could not check the sending domain'
					: `${data.sendingDomain.domain} is not verified`}
			</p>
			<p class="banner__body">{data.sendingDomain.description}</p>

			{#if 'records' in data.sendingDomain && data.sendingDomain.records.length > 0}
				<p class="banner__body">Publish these at your DNS provider, then press Verify in Resend:</p>
				<div class="dns">
					<table>
						<thead>
							<tr><th>Type</th><th>Name</th><th>Value</th><th>Status</th></tr>
						</thead>
						<tbody>
							{#each data.sendingDomain.records as record (record.name + record.type)}
								<tr>
									<td>{record.type}</td>
									<td><code>{record.name}</code></td>
									<td><code class="dns__value">{record.value}</code></td>
									<td>{record.status ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<div class="meters">
		{#each [usage.month, usage.day] as meter (meter.label)}
			<div class="meter meter--{meter.tone}">
				<div class="meter__head">
					<p class="meter__label">{meter.label}</p>
					<span class="meter__plan">{config.plan.name} plan</span>
				</div>

				{#if meter.limit === null}
					<p class="meter__value">{fmtNumber(meter.used)}<span class="meter__unit">sent</span></p>
					<p class="meter__foot">No cap on {config.plan.name} — set a limit to track one here.</p>
				{:else}
					<p class="meter__value">
						{fmtNumber(meter.used)}<span class="meter__unit">of {fmtNumber(meter.limit)}</span>
					</p>
					<div
						class="bar"
						role="img"
						aria-label="{Math.round(meter.percent)}% of the allowance used"
					>
						<div
							class="bar__fill"
							style="width: {Math.max(meter.percent, meter.used > 0 ? 2 : 0)}%"
						></div>
					</div>
					<p class="meter__foot">
						<strong>{fmtNumber(meter.remaining ?? 0)} left</strong> · resets {fmtReset(
							meter.resetsAt
						)}
					</p>
				{/if}
			</div>
		{/each}

		<div class="plan">
			<p class="plan__label">Plan</p>
			<p class="plan__name">Resend {config.plan.name}</p>
			<p class="plan__note">{config.plan.note}</p>
			<dl class="plan__rows">
				<div>
					<dt>From</dt>
					<dd>{config.from}</dd>
				</div>
				{#if config.replyTo}<div>
						<dt>Reply-to</dt>
						<dd>{config.replyTo}</dd>
					</div>{/if}
				<div>
					<dt>Status</dt>
					<dd>{config.configured ? 'Connected' : 'No API key'}</dd>
				</div>
			</dl>
		</div>
	</div>

	<div class="stats">
		<div class="stat">
			<p class="stat__label">Delivered all time</p>
			<p class="stat__value">{fmtNumber(usage.totals.sent)}</p>
		</div>
		<div class="stat">
			<p class="stat__label">Failed</p>
			<p class="stat__value" class:stat__value--bad={usage.totals.failed > 0}>
				{fmtNumber(usage.totals.failed)}
			</p>
		</div>
		<div class="stat">
			<p class="stat__label">Blocked</p>
			<p class="stat__value" class:stat__value--warn={usage.totals.blocked > 0}>
				{fmtNumber(usage.totals.blocked)}
			</p>
		</div>
		<div class="stat">
			<p class="stat__label">Templates</p>
			<p class="stat__value">{data.templates.length}</p>
			<a class="stat__link" href={resolve('/tic-admin/email/templates')}>
				{customised} edited{disabled > 0 ? `, ${disabled} off` : ''} →
			</a>
		</div>
	</div>

	<section class="panel">
		<header class="panel__head">
			<h2>Last 30 days</h2>
			<div class="legend">
				<span class="key key--sent"></span>Sent
				<span class="key key--failed"></span>Failed
				<span class="key key--blocked"></span>Blocked
			</div>
		</header>
		<div class="trend">
			{#each data.trend as day (day.day)}
				{@const total = day.sent + day.failed + day.blocked}
				<div
					class="trend__col"
					title="{fmtDay(day.day)} — {day.sent} sent, {day.failed} failed, {day.blocked} blocked"
				>
					<div class="trend__stack" style="height: {(total / trendPeak) * 100}%">
						{#if day.blocked}<div
								class="trend__seg trend__seg--blocked"
								style="flex: {day.blocked}"
							></div>{/if}
						{#if day.failed}<div
								class="trend__seg trend__seg--failed"
								style="flex: {day.failed}"
							></div>{/if}
						{#if day.sent}<div
								class="trend__seg trend__seg--sent"
								style="flex: {day.sent}"
							></div>{/if}
					</div>
				</div>
			{/each}
		</div>
		<div class="trend__axis">
			<span>{fmtDay(data.trend[0].day)}</span>
			<span>Peak {trendPeak} a day</span>
			<span>{fmtDay(data.trend.at(-1)!.day)}</span>
		</div>
	</section>

	<section class="panel">
		<header class="panel__head">
			<h2>Newsletter list</h2>
			<button
				class="btn"
				onclick={exportNewsletter}
				disabled={exportingList || data.newsletterCount === 0}
			>
				{exportingList ? 'Exporting…' : 'Export CSV'}
			</button>
		</header>
		<p class="panel__body">
			{#if data.newsletterCount === 0}
				Nobody has subscribed from the footer form yet.
			{:else}
				<strong>{fmtNumber(data.newsletterCount)}</strong>
				{data.newsletterCount === 1 ? 'person has' : 'people have'} subscribed from the footer form. Nothing
				is sent to them automatically — this is a list to export, not a campaign.
			{/if}
		</p>
	</section>

	{#if data.suppressions.length > 0}
		<section class="panel">
			<header class="panel__head">
				<h2>Suppressed addresses</h2>
				<p class="panel__note">
					Reported by Resend. Nothing is sent to these, so a message to one is logged as blocked.
				</p>
			</header>
			<ul class="suppressions">
				{#each data.suppressions as item (item.email)}
					<li>
						<div>
							<p class="suppressions__email">{item.email}</p>
							<p class="suppressions__why">
								<span class="badge badge--{item.reason}">{item.reason}</span>
								{item.detail ?? ''}
							</p>
						</div>
						<button
							class="btn"
							onclick={() => liftSuppression(item.email)}
							disabled={lifting === item.email}
						>
							{lifting === item.email ? 'Lifting…' : 'Allow again'}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="tabs">
		<button
			class="tab"
			class:tab--active={statusFilter === 'all'}
			onclick={() => (statusFilter = 'all')}
		>
			All <span class="tab__count">{counts.all}</span>
		</button>
		<button
			class="tab"
			class:tab--active={statusFilter === 'sent'}
			onclick={() => (statusFilter = 'sent')}
		>
			Sent <span class="tab__count">{counts.sent}</span>
		</button>
		<button
			class="tab"
			class:tab--active={statusFilter === 'failed'}
			onclick={() => (statusFilter = 'failed')}
		>
			Failed <span class="tab__count">{counts.failed}</span>
		</button>
		<button
			class="tab"
			class:tab--active={statusFilter === 'blocked'}
			onclick={() => (statusFilter = 'blocked')}
		>
			Blocked <span class="tab__count">{counts.blocked}</span>
		</button>
		<label class="toggle">
			<input type="checkbox" bind:checked={showTests} />
			Include test sends
		</label>
	</div>

	<p class="scope">
		{entries.length === 1
			? 'Filtering the most recent message.'
			: `Filtering the ${entries.length} most recent messages.`}
		{#if hasMore}Load older ones below to widen it.{/if}
	</p>

	<div class="panel">
		{#if visible.length === 0}
			<p class="empty">
				{#if entries.length === 0}
					Nothing has been sent yet. Verifying a company or moving an applicant along will put the
					first message here.
				{:else if hiddenTests > 0}
					Only test sends here — tick <strong>Include test sends</strong> to show
					{hiddenTests === 1 ? 'it' : `all ${hiddenTests}`}.
				{:else}
					No messages match this filter.
				{/if}
			</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>When</th>
							<th>Template</th>
							<th>To</th>
							<th>Subject</th>
							<th>Status</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each visible as entry (entry.id)}
							<tr>
								<td><p class="cell__sub">{fmtWhen(entry.created_at)}</p></td>
								<td>
									<p class="cell__name">{templateName(entry.template_key)}</p>
									{#if entry.is_test}<span class="tag">test</span>{/if}
								</td>
								<td>
									<p class="cell__name">{entry.to_email}</p>
									{#if entry.to_name}<p class="cell__sub">{entry.to_name}</p>{/if}
								</td>
								<td><p class="cell__sub cell__subject">{entry.subject || '—'}</p></td>
								<td>
									<span class="badge badge--{entry.status}">{entry.status}</span>
									{#if entry.error}<p class="cell__err">{entry.error}</p>{/if}
								</td>
								<td class="actions-col">
									<button
										class="btn"
										onclick={() => openPreview(entry.id)}
										disabled={previewing === entry.id}
									>
										{previewing === entry.id ? 'Opening…' : 'Preview'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if hasMore}
				<div class="more">
					<button class="btn" onclick={loadMore} disabled={loadingMore}>
						{loadingMore ? 'Loading…' : 'Load older messages'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</AdminShell>

{#if preview}
	<div class="modal" role="dialog" aria-modal="true" aria-label="Email preview">
		<button class="modal__scrim" aria-label="Close preview" onclick={() => (preview = null)}
		></button>
		<div class="modal__box">
			<header class="modal__head">
				<div>
					<p class="modal__eyebrow">{preview.to_email} · {fmtWhen(preview.created_at)}</p>
					<h2>{preview.subject}</h2>
				</div>
				<button class="btn" onclick={() => (preview = null)}>Close</button>
			</header>
			<!-- Sandboxed with no allow-* flags: the body is stored markup, and it is
			     rendered here only to be looked at. -->
			<iframe class="modal__frame" title="Rendered email" sandbox="" srcdoc={preview.body}></iframe>
		</div>
	</div>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.head-btn {
		padding: 6px 12px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		text-decoration: none;
		white-space: nowrap;
	}

	// --- banners --------------------------------------------------------------

	.banner {
		margin: 0 0 20px;
		padding: 14px 16px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-left: 3px solid #004ebb;
		border-radius: $admin-radius-sm;

		&--warn {
			border-left-color: #c98a00;
			background: #fffdf6;
		}

		&--info {
			border-left-color: #004ebb;
			background: #f8faff;
		}
	}

	.banner__title {
		margin: 0 0 4px;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.banner__body {
		margin: 0;
		font-size: 12px;
		line-height: 1.6;
		color: #555;
	}

	.banner code {
		font-size: 11px;
		background: $admin-line-soft;
		padding: 1px 5px;
		border-radius: 3px;
	}

	// --- meters ---------------------------------------------------------------

	.meters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 12px;
		margin-bottom: 12px;
	}

	.meter {
		padding: 18px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;

		&--warn .bar__fill {
			background: #c98a00;
		}

		&--full .bar__fill {
			background: #a01515;
		}
	}

	.meter__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.meter__label {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.meter__plan {
		font-size: 11px;
		color: $admin-ink-3;
	}

	.meter__value {
		margin: 10px 0 12px;
		font-size: 30px;
		font-weight: $font-weight-semibold;
		letter-spacing: -0.02em;
		color: #111;
		line-height: 1;
	}

	.meter__unit {
		margin-left: 8px;
		font-size: 13px;
		font-weight: $font-weight-regular;
		color: $admin-ink-3;
		letter-spacing: 0;
	}

	.bar {
		height: 6px;
		background: $admin-line-soft;
		border-radius: 999px;
		overflow: hidden;
	}

	.bar__fill {
		height: 100%;
		background: #0eb05b;
		border-radius: 999px;
		transition: width 0.3s ease;
	}

	.meter__foot {
		margin: 10px 0 0;
		font-size: 12px;
		color: $admin-ink-3;

		strong {
			color: #111;
			font-weight: $font-weight-semibold;
		}
	}

	.plan {
		padding: 18px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
	}

	.plan__label {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.plan__name {
		margin: 8px 0 4px;
		font-size: 16px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.plan__note {
		margin: 0 0 12px;
		font-size: 12px;
		line-height: 1.5;
		color: $admin-ink-3;
	}

	.plan__rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding-top: 10px;
		border-top: 1px solid $admin-line-soft;

		div {
			display: flex;
			gap: 8px;
			font-size: 11px;
		}

		dt {
			color: #999;
			min-width: 62px;
		}

		dd {
			margin: 0;
			color: #444;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	// --- stats ----------------------------------------------------------------

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.stat {
		padding: 16px 18px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
	}

	.stat__label {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.stat__value {
		margin: 8px 0 0;
		font-size: 24px;
		font-weight: $font-weight-semibold;
		letter-spacing: -0.02em;
		color: #111;

		&--bad {
			color: #a01515;
		}

		&--warn {
			color: #8a6100;
		}
	}

	.stat__link {
		display: inline-block;
		margin-top: 6px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #2050d4;
		text-decoration: none;
	}

	// --- trend ----------------------------------------------------------------

	.panel {
		@include admin-panel;
		margin-bottom: 20px;
	}

	.panel__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 18px;
		border-bottom: 1px solid $admin-line-soft;

		h2 {
			@include admin-section-title;
		}
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: $admin-ink-3;
	}

	.key {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		display: inline-block;

		&--sent {
			background: #0eb05b;
		}

		&--failed {
			background: #a01515;
		}

		&--blocked {
			background: #c98a00;
		}

		& + & {
			margin-left: 8px;
		}
	}

	.trend {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 90px;
		padding: 18px 18px 0;
	}

	.trend__col {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
		min-width: 0;
	}

	.trend__stack {
		width: 100%;
		min-height: 2px;
		display: flex;
		flex-direction: column;
		border-radius: 2px;
		overflow: hidden;
		background: $admin-line-soft;
	}

	.trend__seg {
		&--sent {
			background: #0eb05b;
		}

		&--failed {
			background: #a01515;
		}

		&--blocked {
			background: #c98a00;
		}
	}

	.trend__axis {
		display: flex;
		justify-content: space-between;
		padding: 8px 18px 16px;
		font-size: 11px;
		color: #999;
	}

	// --- log ------------------------------------------------------------------

	.tabs {
		@include admin-tabs;
		align-items: center;
	}

	.tab {
		@include admin-tab;
	}

	.tab__count {
		@include admin-tab-count;
	}

	.scope {
		margin: -6px 0 12px;
		font-size: 11px;
		color: #999;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		margin-left: 6px;
		font-size: 12px;
		color: $admin-ink-2;
		cursor: pointer;

		input {
			accent-color: #111;
			width: 14px;
			height: 14px;
		}
	}

	.empty {
		@include admin-empty;
		max-width: 460px;
		margin: 0 auto;
		line-height: 1.6;
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

	.cell__name {
		@include admin-cell-name;
	}

	.cell__sub {
		@include admin-cell-sub;
	}

	.cell__subject {
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell__err {
		margin: 4px 0 0;
		font-size: 11px;
		color: #a01515;
		max-width: 220px;
	}

	.badge {
		@include admin-badge;

		&--sent {
			@include admin-badge-tone('good');
		}

		&--failed,
		&--bounced {
			@include admin-badge-tone('bad');
		}

		&--blocked,
		&--complained,
		&--manual {
			@include admin-badge-tone('warn');
		}
	}

	.dns {
		overflow-x: auto;
		margin-top: 10px;

		table {
			width: 100%;
			border-collapse: collapse;
			font-size: 12px;
		}

		th {
			text-align: left;
			padding: 6px 10px 6px 0;
			font-weight: $font-weight-semibold;
			color: #555;
			border-bottom: 1px solid $admin-line-soft;
			white-space: nowrap;
		}

		td {
			padding: 6px 10px 6px 0;
			border-bottom: 1px solid #f2f3f5;
			vertical-align: top;
		}

		code {
			font-size: 11px;
			overflow-wrap: anywhere;
		}
	}

	// A DKIM value is a long base64 key; it must wrap rather than stretch the row.
	.dns__value {
		display: inline-block;
		max-width: 46ch;
	}

	.panel__body {
		margin: 0;
		padding: 14px 18px;
		font-size: 13px;
		line-height: 1.6;
		color: #444;
	}

	.panel__note {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-2;
		text-align: right;
		max-width: 42ch;
	}

	.suppressions {
		list-style: none;
		margin: 0;
		padding: 0;

		li {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			padding: 12px 18px;

			& + li {
				border-top: 1px solid $admin-line-soft;
			}
		}
	}

	.suppressions__email {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		overflow-wrap: anywhere;
	}

	.suppressions__why {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 4px 0 0;
		font-size: 12px;
		color: $admin-ink-2;
		overflow-wrap: anywhere;
	}

	.tag {
		display: inline-block;
		margin-top: 4px;
		padding: 1px 7px;
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #24427e;
		background: #e2e8f5;
		border-radius: 999px;
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.btn {
		@include admin-btn-small;
	}

	.more {
		padding: 14px 18px;
		border-top: 1px solid $admin-line-soft;
		text-align: center;
	}

	// --- preview modal --------------------------------------------------------

	.modal {
		position: fixed;
		inset: 0;
		z-index: $z-modal;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;

		@include breakpoint-down($bp-sm) {
			padding: 0;
		}
	}

	.modal__scrim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.42);
		border: 0;
		cursor: pointer;
	}

	.modal__box {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 680px;
		max-height: 100%;
		background: #fff;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);

		@include breakpoint-down($bp-sm) {
			border-radius: 0;
			max-height: 100svh;
		}
	}

	.modal__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 18px;
		border-bottom: 1px solid $admin-line-soft;

		h2 {
			margin: 0;
			font-family: $font-family-base;
			font-size: 15px;
			font-weight: $font-weight-semibold;
			color: #111;
		}
	}

	.modal__eyebrow {
		margin: 0 0 3px;
		font-size: 11px;
		color: $admin-ink-3;
	}

	.modal__frame {
		flex: 1;
		width: 100%;
		min-height: 60svh;
		border: 0;
		background: $admin-sunken;
	}
</style>
