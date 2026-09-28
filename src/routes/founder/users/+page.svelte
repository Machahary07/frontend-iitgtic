<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { invalidateAll } from '$app/navigation';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Member = {
		id: string;
		full_name: string;
		email: string;
		member_status: 'pending' | 'approved' | 'rejected';
		created_at: string;
	};

	const members = $derived(data.members as Member[]);
	// The founder who registered the startup is not in the members table — they
	// are its owner_id — so ownership is read from the switcher's own view of it.
	const isOwner = $derived(
		data.companies.find((c) => c.id === data.activeCompanyId)?.relation === 'owner'
	);

	const STATUS: Record<string, { label: string; tone: string }> = {
		pending: { label: 'Waiting for TIC', tone: 'warn' },
		approved: { label: 'Active', tone: 'good' },
		rejected: { label: 'Not approved', tone: 'bad' }
	};

	let adding = $state(false);
	let fullName = $state('');
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let formError = $state('');

	async function add(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		formError = '';
		try {
			const res = await fetch('/api/founder/users', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ companyId: data.activeCompanyId, fullName, email, password })
			});
			const body = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
				message?: string;
			};
			if (!res.ok || !body.ok) {
				formError = body.error ?? body.message ?? 'Could not add this person.';
				return;
			}
			showToast('Added. TIC will approve the account before it can be used.', 'ok');
			fullName = '';
			email = '';
			password = '';
			adding = false;
			await invalidateAll();
		} finally {
			submitting = false;
		}
	}

	async function remove(member: Member) {
		const ok = await askConfirm({
			title: `Remove ${member.full_name || member.email}?`,
			body: 'Their login is deleted and they lose access to this console. This cannot be undone.',
			confirmLabel: 'Remove person',
			tone: 'danger'
		});
		if (!ok) return;

		const res = await fetch(
			`/api/founder/users?companyId=${data.activeCompanyId}&id=${member.id}`,
			{ method: 'DELETE' }
		);
		if (!res.ok) {
			showToast('Could not remove this person.', 'err');
			return;
		}
		showToast('Removed.', 'ok');
		await invalidateAll();
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// A page at a time; back to the first page whenever the view changes.
	const pager = new Pager(() => members, () => []);
</script>

<svelte:head>
	<title>Founder Console · Team</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Team"
	eyebrow="Your company"
>
	{#snippet pageActions()}
		{#if isOwner}
			<button class="btn-primary" onclick={() => (adding = !adding)}>
				{adding ? 'Cancel' : 'Add someone'}
			</button>
		{/if}
	{/snippet}

	<p class="lede">
		Everyone here signs in at the same place you do and lands in this console. A person you add can
		sign in straight away, but cannot post roles, read applicants or change company details until a
		TIC admin approves them.
	</p>

	{#if !isOwner}
		<p class="lede lede--quiet">
			Only the account that registered {data.company?.companyName ?? 'this company'} can add or remove
			people.
		</p>
	{/if}

	{#if adding && isOwner}
		<form class="card" onsubmit={add} novalidate>
			<label class="field">
				<span>Full name</span>
				<input type="text" bind:value={fullName} required />
			</label>
			<label class="field">
				<span>Work email</span>
				<input type="email" bind:value={email} autocomplete="off" required />
			</label>
			<label class="field">
				<span>Temporary password</span>
				<input type="text" bind:value={password} autocomplete="off" required />
				<span class="hint">
					At least 8 characters. Give it to them directly, and ask them to change it from the
					sign-in page once TIC has approved the account.
				</span>
			</label>

			{#if formError}
				<p class="error" role="alert">{formError}</p>
			{/if}

			<div class="actions">
				<button type="submit" class="btn-primary" disabled={submitting}>
					{submitting ? 'Adding…' : 'Add to team'}
				</button>
				<button type="button" class="btn" onclick={() => (adding = false)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if members.length === 0 && !data.owner}
		<div class="empty"><p>No one on the team yet.</p></div>
	{:else}
		<div class="panel">
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Person</th>
							<th>Role</th>
							<th>Status</th>
							<th>Added</th>
							<th class="actions-col"></th>
						</tr>
					</thead>
					<tbody>
						{#if data.owner}
							<tr>
								<td>
									<p class="cell__name">{data.owner.name || '—'}</p>
									<p class="cell__sub">{data.owner.email}</p>
								</td>
								<td><span class="badge">Founder</span></td>
								<td><span class="badge badge--good">Active</span></td>
								<td><p class="cell__sub">Registered it</p></td>
								<td class="actions-col"></td>
							</tr>
						{/if}
						{#each pager.rows as member (member.id)}
							<tr>
								<td>
									<p class="cell__name">{member.full_name || '—'}</p>
									<p class="cell__sub">{member.email}</p>
								</td>
								<td><span class="badge">Member</span></td>
								<td>
									<span class="badge badge--{STATUS[member.member_status].tone}">
										{STATUS[member.member_status].label}
									</span>
								</td>
								<td><p class="cell__sub">{formatDate(member.created_at)}</p></td>
								<td class="actions-col">
									{#if isOwner}
										<button type="button" class="link link--danger" onclick={() => remove(member)}>
											Remove
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination pager={pager} noun="team members" />
		</div>
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.lede {
		margin: 0 0 16px;
		font-size: 13px;
		line-height: 1.6;
		color: $admin-ink-2;
		max-width: 76ch;

		&--quiet {
			color: $admin-ink-3;
		}
	}

	.card {
		@include admin-card;
		max-width: 520px;
		margin-bottom: 18px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		input {
			@include admin-input;
		}
	}

	.hint {
		font-size: 12px;
		line-height: 1.5;
		color: $admin-ink-3;
		text-transform: none;
		letter-spacing: 0;
		font-weight: $font-weight-regular;
	}

	.error {
		@include admin-msg-err;
	}

	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.empty {
		@include admin-empty;
	}

	.panel {
		@include admin-panel;
		overflow: hidden;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		@include admin-table(640px);
	}

	thead th {
		@include admin-thead;
	}

	tbody td {
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

		&--good {
			@include admin-badge-tone('good');
		}
		&--warn {
			@include admin-badge-tone('warn');
		}
		&--bad {
			@include admin-badge-tone('bad');
		}
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.link {
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		cursor: pointer;
		@include admin-focus-ring($admin-accent);

		&--danger {
			color: admin-tone-fg('bad');
		}
	}

	.btn-primary {
		@include admin-btn-primary;
	}

	.btn {
		@include admin-btn-base;
	}
</style>
