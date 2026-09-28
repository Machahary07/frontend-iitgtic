<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	type PendingCompany = {
		id: string;
		company_name: string;
		website: string;
		contact_name: string;
		contact_email: string;
		phone: string;
		created_at: string;
	};
	type Job = {
		id: string;
		company_id: string;
		role: string;
		company: string;
		location: string;
		type: string;
		sector: string;
		description: string;
		apply_link: string;
		submitted_at: string;
	};
	type Member = {
		id: string;
		company_id: string;
		full_name: string;
		email: string;
		created_at: string;
	};
	type Change = {
		id: string;
		company_id: string;
		changes: Record<string, { from: string; to: string }>;
		created_at: string;
	};

	const newCompanies = $derived(data.pendingCompanies as PendingCompany[]);
	const jobs = $derived(data.pendingJobs as Job[]);
	const members = $derived(data.pendingMembers as Member[]);
	const changes = $derived(data.pendingChanges as Change[]);
	const companies = $derived(
		data.companies as { id: string; company_name: string; status: string }[]
	);

	const total = $derived(newCompanies.length + jobs.length + members.length + changes.length);

	const LABEL: Record<string, string> = {
		companyName: 'Company name',
		website: 'Website',
		contactName: 'Contact person',
		contactEmail: 'Contact email',
		phone: 'Phone'
	};

	function companyName(id: string) {
		return companies.find((c) => c.id === id)?.company_name ?? 'Unknown company';
	}

	function companyVerified(id: string) {
		return companies.find((c) => c.id === id)?.status === 'verified';
	}

	let openId = $state('');
	let notes = $state<Record<string, string>>({});
	let busy = $state('');

	async function decide(
		kind: 'company' | 'job' | 'member' | 'profile',
		id: string,
		decision: 'approve' | 'reject'
	) {
		if (busy) return;
		// A refusal the founder cannot read is a dead end, so it has to say why.
		if (decision === 'reject' && !notes[id]?.trim()) {
			showToast('Write a reason first — the founder reads it in their console.', 'err');
			openId = id;
			return;
		}
		busy = id;
		try {
			const res = await fetch('/api/tic-admin/approvals', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind, id, decision, note: notes[id] ?? '' })
			});
			if (!res.ok) {
				showToast('That did not go through. Try again.', 'err');
				return;
			}
			showToast(decision === 'approve' ? 'Approved.' : 'Sent back.', 'ok');
			notes = { ...notes, [id]: '' };
			openId = '';
			await invalidateAll();
		} finally {
			busy = '';
		}
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}

	function when(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// A page at a time; back to the first page whenever the view changes.
	const companyPager = new Pager(
		() => newCompanies,
		() => []
	);

	// A page at a time; back to the first page whenever the view changes.
	const jobPager = new Pager(
		() => jobs,
		() => []
	);

	// A page at a time; back to the first page whenever the view changes.
	const memberPager = new Pager(
		() => members,
		() => []
	);

	// A page at a time; back to the first page whenever the view changes.
	const changePager = new Pager(
		() => changes,
		() => []
	);
</script>

<svelte:head>
	<title>TIC Admin · Approvals</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Approvals"
	eyebrow="Queue"
	user={adminName}
	onLogout={handleLogout}
>
	<p class="lede">
		Nothing a founder writes reaches the public site until it is approved here. A refusal needs a
		reason, which the founder reads in their own console.
	</p>

	{#if total === 0}
		<div class="empty"><p>Nothing waiting. Everything founders have sent has been decided.</p></div>
	{/if}

	{#if newCompanies.length > 0}
		<section class="group">
			<h2 class="group__title">
				New startups <span class="group__count">{newCompanies.length}</span>
			</h2>
			{#each companyPager.rows as startup (startup.id)}
				<article class="item">
					<div class="item__head">
						<div class="item__text">
							<p class="item__name">{startup.company_name}</p>
							<p class="item__sub">
								{startup.contact_name} · {startup.contact_email} · {startup.phone} · registered
								{when(startup.created_at)}
							</p>
							{#if startup.website}
								<p class="item__sub">{startup.website}</p>
							{/if}
						</div>
					</div>
					<div class="decide">
						<input
							type="text"
							class="note"
							placeholder="Reason, if refusing"
							value={notes[startup.id] ?? ''}
							oninput={(e) => (notes = { ...notes, [startup.id]: e.currentTarget.value })}
						/>
						<button
							class="btn-small btn-small--primary"
							disabled={busy === startup.id}
							onclick={() => decide('company', startup.id, 'approve')}
						>
							Verify
						</button>
						<button
							class="btn-small btn-small--danger"
							disabled={busy === startup.id}
							onclick={() => decide('company', startup.id, 'reject')}
						>
							Refuse
						</button>
					</div>
				</article>
			{/each}
			<Pagination pager={companyPager} noun="startups" />
		</section>
	{/if}

	{#if jobs.length > 0}
		<section class="group">
			<h2 class="group__title">Job postings <span class="group__count">{jobs.length}</span></h2>
			{#each jobPager.rows as job (job.id)}
				<article class="item">
					<div class="item__head">
						<div class="item__text">
							<p class="item__name">{job.role}</p>
							<p class="item__sub">
								{companyName(job.company_id)} · {job.type} · {job.location || 'no location given'} · sent
								{when(job.submitted_at)}
							</p>
							{#if !companyVerified(job.company_id)}
								<p class="item__flag">
									This company is not verified, so approving the role will not put it on the board
									yet.
								</p>
							{/if}
						</div>
						<button class="btn-small" onclick={() => (openId = openId === job.id ? '' : job.id)}>
							{openId === job.id ? 'Hide' : 'Read'}
						</button>
					</div>

					{#if openId === job.id}
						<div class="detail">
							<p class="detail__label">Sector</p>
							<p class="detail__text">{job.sector || '—'}</p>
							<p class="detail__label">Description</p>
							<p class="detail__text">{job.description}</p>
							<p class="detail__label">Apply link</p>
							<p class="detail__text">{job.apply_link}</p>
						</div>
					{/if}

					<div class="decide">
						<input
							type="text"
							class="note"
							placeholder="Reason, if sending it back"
							value={notes[job.id] ?? ''}
							oninput={(e) => (notes = { ...notes, [job.id]: e.currentTarget.value })}
						/>
						<button
							class="btn-small btn-small--primary"
							disabled={busy === job.id}
							onclick={() => decide('job', job.id, 'approve')}
						>
							Approve
						</button>
						<button
							class="btn-small btn-small--danger"
							disabled={busy === job.id}
							onclick={() => decide('job', job.id, 'reject')}
						>
							Send back
						</button>
					</div>
				</article>
			{/each}
			<Pagination pager={jobPager} noun="postings" />
		</section>
	{/if}

	{#if members.length > 0}
		<section class="group">
			<h2 class="group__title">Team members <span class="group__count">{members.length}</span></h2>
			{#each memberPager.rows as member (member.id)}
				<article class="item">
					<div class="item__head">
						<div class="item__text">
							<p class="item__name">{member.full_name || member.email}</p>
							<p class="item__sub">
								added to {companyName(member.company_id)} · {member.email} · {when(
									member.created_at
								)}
							</p>
						</div>
					</div>
					<div class="decide">
						<input
							type="text"
							class="note"
							placeholder="Reason, if refusing"
							value={notes[member.id] ?? ''}
							oninput={(e) => (notes = { ...notes, [member.id]: e.currentTarget.value })}
						/>
						<button
							class="btn-small btn-small--primary"
							disabled={busy === member.id}
							onclick={() => decide('member', member.id, 'approve')}
						>
							Approve
						</button>
						<button
							class="btn-small btn-small--danger"
							disabled={busy === member.id}
							onclick={() => decide('member', member.id, 'reject')}
						>
							Refuse
						</button>
					</div>
				</article>
			{/each}
			<Pagination pager={memberPager} noun="members" />
		</section>
	{/if}

	{#if changes.length > 0}
		<section class="group">
			<h2 class="group__title">
				Company details <span class="group__count">{changes.length}</span>
			</h2>
			{#each changePager.rows as change (change.id)}
				<article class="item">
					<div class="item__head">
						<div class="item__text">
							<p class="item__name">{companyName(change.company_id)}</p>
							<p class="item__sub">asked {when(change.created_at)}</p>
							<ul class="diff">
								{#each Object.entries(change.changes) as [field, value] (field)}
									<li>
										<span class="diff__label">{LABEL[field] ?? field}</span>
										<span class="diff__from">{value.from || '—'}</span>
										<span aria-hidden="true">→</span>
										<span class="diff__to">{value.to || '—'}</span>
									</li>
								{/each}
							</ul>
							{#if change.changes.companyName}
								<p class="item__flag">
									Approving a rename also renames the company on every role it has posted.
								</p>
							{/if}
						</div>
					</div>
					<div class="decide">
						<input
							type="text"
							class="note"
							placeholder="Reason, if refusing"
							value={notes[change.id] ?? ''}
							oninput={(e) => (notes = { ...notes, [change.id]: e.currentTarget.value })}
						/>
						<button
							class="btn-small btn-small--primary"
							disabled={busy === change.id}
							onclick={() => decide('profile', change.id, 'approve')}
						>
							Apply
						</button>
						<button
							class="btn-small btn-small--danger"
							disabled={busy === change.id}
							onclick={() => decide('profile', change.id, 'reject')}
						>
							Refuse
						</button>
					</div>
				</article>
			{/each}
			<Pagination pager={changePager} noun="changes" />
		</section>
	{/if}
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.lede {
		margin: 0 0 18px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 76ch;
	}

	.empty {
		@include admin-empty;
	}

	.group {
		margin-bottom: 26px;
	}

	.group__title {
		@include admin-section-title;
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 0 0 12px;
	}

	.group__count {
		@include admin-badge;
		@include admin-badge-tone('warn');
	}

	.item {
		@include admin-panel;
		padding: 16px 18px;
		margin-bottom: 12px;
	}

	.item__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
	}

	.item__text {
		min-width: 0;
	}

	.item__name {
		@include admin-cell-name;
		font-size: 14px;
	}

	.item__sub {
		@include admin-cell-sub;
	}

	.item__flag {
		margin: 8px 0 0;
		font-size: 12px;
		color: admin-tone-fg('warn');
		max-width: 62ch;
	}

	.detail {
		margin-top: 14px;
		padding: 14px;
		background: $admin-sunken;
		border-radius: $admin-radius-md;
	}

	.detail__label {
		@include admin-field-label;
		margin: 12px 0 4px;

		&:first-child {
			margin-top: 0;
		}
	}

	.detail__text {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.diff {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;

		li {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			gap: 8px;
			font-size: 13px;
			color: $admin-ink-2;
		}
	}

	.diff__label {
		min-width: 120px;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.diff__from {
		text-decoration: line-through;
		color: $admin-ink-3;
	}

	.diff__to {
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.decide {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 14px;
		flex-wrap: wrap;

		@include breakpoint-down($bp-sm) {
			flex-direction: column;
			align-items: stretch;
		}
	}

	.note {
		@include admin-input;
		flex: 1;
		min-width: 220px;
	}

	.btn-small {
		@include admin-btn-small;
		flex: none;
	}
</style>
