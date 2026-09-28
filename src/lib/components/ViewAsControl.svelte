<script lang="ts">
	import { page } from '$app/state';
	import Eye from '@lucide/svelte/icons/eye';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import Search from '@lucide/svelte/icons/search';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { ACCOUNT_ROLES, ROLE_INFO, roleLabel } from '$lib/utils/roles';
	import { exitViewAs, searchViewAs, viewAs, type ViewAsAccount } from '$lib/utils/viewAs';
	import { showToast } from '$lib/utils/toast.svelte';

	// "View as", for developers — the topbar pill that opens the console as
	// another account. Both consoles' layouts send the same two fields, so it
	// works from /tic-admin and from inside a founder's console alike.

	type Viewing = { userId: string; name: string; email: string; role: string } | null;

	const canViewAs = $derived(Boolean(page.data.canViewAs));
	const viewing = $derived((page.data.viewAs ?? null) as Viewing);

	let open = $state(false);
	let query = $state('');
	// Narrows who is listed. You always end up as a real account, never as a
	// role in the abstract, so the audit trail names a person.
	let roleFilter = $state<string | null>(null);
	let results = $state<ViewAsAccount[]>([]);
	let loading = $state(false);
	let switching = $state('');
	let root = $state<HTMLDivElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);

	function toggle() {
		if (!open) {
			// Reopening while viewing as someone starts where you are.
			roleFilter = viewing?.role ?? null;
			query = '';
		}
		open = !open;
	}

	// Debounced search while the picker is open.
	$effect(() => {
		if (!open) return;
		const term = query;
		const role = roleFilter;
		let active = true;
		const timer = setTimeout(async () => {
			loading = true;
			const found = await searchViewAs(term, role);
			if (active) {
				results = found;
				loading = false;
			}
		}, 200);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	});

	$effect(() => {
		if (open) setTimeout(() => input?.focus(), 30);
	});

	// Outside click and Escape close it.
	$effect(() => {
		if (!open) return;
		const onDown = (event: MouseEvent) => {
			if (root && !root.contains(event.target as Node)) open = false;
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') open = false;
		};
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	});

	async function pick(account: ViewAsAccount) {
		open = false;
		switching = `Opening as ${account.name || account.email}…`;
		const result = await viewAs(account.id);
		if (!result.ok) {
			switching = '';
			showToast(result.error, 'err');
		}
	}

	async function exit() {
		open = false;
		switching = 'Back to your own console…';
		const result = await exitViewAs();
		if (!result.ok) {
			switching = '';
			showToast(result.error, 'err');
		}
	}
</script>

{#if canViewAs}
	<div class="viewas" bind:this={root}>
		<button
			type="button"
			class="pill"
			class:pill--on={viewing}
			onclick={toggle}
			aria-expanded={open}
			aria-haspopup="dialog"
			title={viewing
				? `Viewing as ${viewing.name || viewing.email}`
				: 'View the console as another account'}
		>
			{#if viewing}
				<UserCog size={14} strokeWidth={2} aria-hidden="true" />
				<span class="pill__label">
					{viewing.name || viewing.email}<span class="pill__role">
						· {roleLabel(viewing.role)}</span
					>
				</span>
			{:else}
				<Eye size={14} strokeWidth={2} aria-hidden="true" />
				<span class="pill__label">View as</span>
			{/if}
		</button>

		{#if open}
			<div class="pop" role="dialog" aria-label="View as another account">
				{#if viewing}
					<div class="pop__now">
						<UserCog size={14} strokeWidth={2} aria-hidden="true" />
						<span class="pop__nowtext">
							Viewing as <b>{viewing.name || viewing.email}</b> · {roleLabel(viewing.role)}
						</span>
						<button type="button" class="pop__exit" onclick={exit}>
							<LogOut size={13} strokeWidth={2} aria-hidden="true" /> Exit
						</button>
					</div>
				{/if}

				<label class="pop__search">
					<Search size={14} strokeWidth={2} aria-hidden="true" />
					<input
						bind:this={input}
						bind:value={query}
						type="search"
						placeholder="Search by name or email"
						aria-label="Search accounts"
					/>
				</label>

				<div class="pop__roles" role="group" aria-label="Filter by role">
					<button
						type="button"
						class="chip"
						class:chip--on={roleFilter === null}
						onclick={() => (roleFilter = null)}>All</button
					>
					{#each ACCOUNT_ROLES.filter((r) => r !== 'developer') as role (role)}
						<button
							type="button"
							class="chip"
							class:chip--on={roleFilter === role}
							onclick={() => (roleFilter = role)}>{ROLE_INFO[role].label}</button
						>
					{/each}
				</div>

				<ul class="pop__list">
					{#if loading && results.length === 0}
						<li class="pop__empty">Searching…</li>
					{:else if results.length === 0}
						<li class="pop__empty">No accounts match.</li>
					{:else}
						{#each results as account (account.id)}
							<li>
								<button type="button" class="acct" onclick={() => pick(account)}>
									<span class="acct__avatar" aria-hidden="true">
										{(account.name || account.email).charAt(0).toUpperCase()}
									</span>
									<span class="acct__text">
										<span class="acct__name">{account.name || account.email}</span>
										<span class="acct__email">{account.email}</span>
									</span>
									<span class="acct__role">{account.roleLabel}</span>
									{#if viewing?.userId === account.id}
										<span class="acct__now">Viewing now</span>
									{/if}
								</button>
							</li>
						{/each}
					{/if}
				</ul>
			</div>
		{/if}
	</div>
{/if}

{#if switching}
	<div class="switching" role="status" aria-live="polite">
		<div class="switching__card">
			<span class="switching__spin" aria-hidden="true"></span>
			{switching}
		</div>
	</div>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;
	@use '$styles/admin' as *;

	.viewas {
		position: relative;
		min-width: 0;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		max-width: 260px;
		height: 36px;
		padding: 0 14px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
		box-shadow: $admin-shadow-card;
		cursor: pointer;
		@include admin-focus-ring;

		&:active {
			transform: translateY(0.5px);
		}

		// Who you are pretending to be is the one thing that must never be missed,
		// so it is dark, and it stays at every width.
		&--on {
			color: $color-white;
			background: $admin-ink;
			border-color: $admin-ink;
		}
	}

	.pill__label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pill__role {
		margin-left: 4px;
		opacity: 0.7;
		font-weight: $font-weight-medium;
	}

	.pill:not(.pill--on) .pill__label {
		@include breakpoint-down($bp-sm) {
			display: none;
		}
	}

	.pop {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		z-index: 70;
		width: min(460px, calc(100vw - 32px));
		max-height: min(70vh, 560px);
		display: flex;
		flex-direction: column;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-raised;
		overflow: hidden;
		animation: pop-in 0.16s ease-out;
		transform-origin: top right;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: scale(0.97) translateY(-2px);
		}
	}

	.pop__now {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		font-size: 12.5px;
		color: $admin-ink-2;
		background: $admin-sunken;
		border-bottom: 1px solid $admin-line-soft;
	}

	.pop__nowtext {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		b {
			color: $admin-ink;
		}
	}

	.pop__exit {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 11px;
		font: inherit;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $color-white;
		background: $admin-ink;
		border: 0;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;
	}

	.pop__search {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 14px 0;
		padding: 0 12px;
		color: $admin-ink-3;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;

		input {
			flex: 1;
			min-width: 0;
			height: 38px;
			font: inherit;
			font-size: 13px;
			color: $admin-ink;
			background: none;
			border: 0;
			outline: none;
		}

		&:focus-within {
			border-color: $admin-ink-3;
		}
	}

	.pop__roles {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 14px 12px;
		border-bottom: 1px solid $admin-line-soft;
	}

	.chip {
		padding: 5px 10px;
		font: inherit;
		font-size: 11.5px;
		font-weight: $font-weight-medium;
		color: $admin-ink-2;
		background: $admin-sunken;
		border: 1px solid transparent;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&--on {
			color: $color-white;
			background: $admin-ink;
		}
	}

	.pop__list {
		list-style: none;
		margin: 0;
		padding: 6px;
		overflow-y: auto;
	}

	.pop__empty {
		padding: 18px 10px;
		font-size: 12.5px;
		color: $admin-ink-3;
		text-align: center;
	}

	.acct {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		font: inherit;
		text-align: left;
		background: none;
		border: 0;
		border-radius: $admin-radius-md;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			background: $admin-sunken;
		}
	}

	.acct__avatar {
		@include admin-icon-tile('info', 30px);
		border-radius: $admin-radius-pill;
		font-size: 12px;
		font-weight: $font-weight-bold;
	}

	.acct__text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.acct__name,
	.acct__email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.acct__name {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.acct__email {
		font-size: 11.5px;
		color: $admin-ink-3;
	}

	.acct__role,
	.acct__now {
		flex: none;
		padding: 3px 8px;
		font-size: 10.5px;
		font-weight: $font-weight-semibold;
		border-radius: $admin-radius-pill;
	}

	.acct__role {
		color: admin-tone-fg('violet');
		background: admin-tone-bg('violet');
	}

	.acct__now {
		color: admin-tone-fg('good');
		background: admin-tone-bg('good');
	}

	.switching {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.6);
		backdrop-filter: blur(4px);
	}

	.switching__card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		font-size: 13px;
		font-weight: $font-weight-medium;
		color: $admin-ink;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-raised;
	}

	.switching__spin {
		width: 16px;
		height: 16px;
		border: 2px solid $admin-line;
		border-top-color: $admin-ink;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pop {
			animation: none;
		}
	}
</style>
