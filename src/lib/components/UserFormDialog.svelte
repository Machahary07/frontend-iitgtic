<script lang="ts" module>
	import type { AccountRole } from '$lib/utils/roles';

	export type UserRecord = {
		id: string;
		email: string;
		role: AccountRole;
		fullName: string;
		phone: string;
		responsibility: string;
		department: string;
		lastSignInAt?: string | null;
		createdAt?: string;
		banned?: boolean;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import PasswordStrength from '$lib/components/PasswordStrength.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import X from '@lucide/svelte/icons/x';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Select from '$lib/components/Select.svelte';
	import { phoneInput, isValidPhone } from '$lib/utils/phone';
	import { roleLabel } from '$lib/utils/roles';
	import { showToast } from '$lib/utils/toast.svelte';

	// One form for an account, used two ways: blank, to add a member of staff;
	// and filled in, opened by clicking a row, where it reads first and the
	// pencil turns it into the same form for editing. Every field is required —
	// except, when editing, the password, which only changes if one is typed.

	type Option = { value: string; label: string; hint?: string };

	interface Props {
		/** null adds a new account; a record opens that one to read and edit. */
		user: UserRecord | null;
		open: boolean;
		roleOptions: Option[];
		/** The person may change this account at all. */
		canEdit: boolean;
		/** …and may also give it a new password by typing one. */
		canSetPassword: boolean;
		/** …and may change its role (never your own). */
		canChangeRole: boolean;
		/** Open straight into the form rather than the read view (the pencil). */
		startEditing?: boolean;
		onclose: () => void;
		onsaved: () => void;
		/** The account's own actions, shown in the read view. Each is left out
		 *  when the person may not do it. */
		onviewas?: () => void;
		ontoggleactive?: () => void;
		ondelete?: () => void;
		busy?: boolean;
	}

	let {
		user,
		open,
		roleOptions,
		canEdit,
		canSetPassword,
		canChangeRole,
		startEditing = false,
		onclose,
		onsaved,
		onviewas,
		ontoggleactive,
		ondelete,
		busy = false
	}: Props = $props();

	const creating = $derived(user === null);

	let editing = $state(false);
	let saving = $state(false);
	let showPassword = $state(false);
	let errors = $state<Record<string, string>>({});

	let fullName = $state('');
	let email = $state('');
	let password = $state('');
	let phone = $state('');
	let role = $state<string>('admin');
	let responsibility = $state('');
	let department = $state('');

	// Reset from the record each time the dialog opens on an account, so a
	// cancelled edit never leaks into the next one. Keyed on the id alone: the
	// record is refreshed underneath (after Deactivate, say) and that must not
	// throw away what is being typed.
	$effect(() => {
		if (!open) return;
		void user?.id;
		untrack(reset);
	});

	function reset() {
		editing = user === null || (startEditing && canEdit);
		saving = false;
		showPassword = false;
		errors = {};
		fullName = user?.fullName ?? '';
		email = user?.email ?? '';
		password = '';
		phone = user?.phone ?? '';
		// A new account starts as an Admin, never a Developer, whatever the list
		// happens to lead with.
		role =
			user?.role ??
			(roleOptions.find((option) => option.value === 'admin') ?? roleOptions[0])?.value ??
			'admin';
		responsibility = user?.responsibility ?? '';
		department = user?.department ?? '';
	}

	let dialog = $state<HTMLDialogElement | null>(null);
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (!fullName.trim()) next.fullName = 'Required';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email';
		if (creating && password.length < 8) next.password = 'At least 8 characters';
		if (!creating && password && password.length < 8) next.password = 'At least 8 characters';
		if (!isValidPhone(phone)) next.phone = 'Exactly 10 digits';
		if (!role) next.role = 'Required';
		if (!responsibility.trim()) next.responsibility = 'Required';
		if (!department.trim()) next.department = 'Required';
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function readError(res: Response): Promise<string> {
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		return body.message ?? 'Something went wrong.';
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!validate()) return;
		saving = true;

		const details = {
			fullName: fullName.trim(),
			email: email.trim(),
			phone,
			responsibility: responsibility.trim(),
			department: department.trim()
		};

		try {
			const res = creating
				? await fetch('/api/tic-admin/users', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ ...details, password, role })
					})
				: await fetch('/api/tic-admin/users', {
						method: 'PATCH',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							id: user!.id,
							details: { ...details, ...(password ? { password } : {}) },
							...(canChangeRole && role !== user!.role ? { role } : {})
						})
					});
			if (!res.ok) {
				showToast(await readError(res), 'err');
				return;
			}
			showToast(
				creating
					? `${roleLabel(role)} account added for ${details.email}.`
					: `${details.fullName} updated${password ? ', with a new password' : ''}.`
			);
			onsaved();
			onclose();
		} catch {
			showToast('Could not reach the server. Please try again.', 'err');
		} finally {
			saving = false;
		}
	}

	function fmt(iso: string | null | undefined) {
		if (!iso) return 'Never';
		return new Date(iso).toLocaleString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	{onclose}
	onclick={(event) => {
		if (event.target === dialog) onclose();
	}}
>
	{#if open}
		<form class="sheet__panel" onsubmit={save} novalidate>
			<header class="sheet__head">
				<div class="sheet__titles">
					<h2 class="sheet__title">
						{#if creating}Add an account{:else if editing}Edit account{:else}{user?.fullName ||
								user?.email}{/if}
					</h2>
					<p class="sheet__sub">
						{#if creating}
							They sign in with this email and password. Founders sign themselves up; this is for
							TIC staff.
						{:else if editing}
							{canSetPassword
								? 'Type a new password only to change it — leave it blank to keep the current one.'
								: 'Changes apply as soon as you save.'}
						{:else}
							{roleLabel(user?.role)} · {user?.email}
						{/if}
					</p>
				</div>
				{#if !creating && !editing && canEdit}
					<button
						type="button"
						class="icon-btn"
						onclick={() => (editing = true)}
						title="Edit"
						aria-label="Edit this account"
					>
						<Pencil size={15} strokeWidth={2} />
					</button>
				{/if}
				<button type="button" class="icon-btn" onclick={onclose} aria-label="Close">
					<X size={16} strokeWidth={2} />
				</button>
			</header>

			{#if !editing && user}
				<dl class="facts">
					<div>
						<dt>Name</dt>
						<dd>{user.fullName || '—'}</dd>
					</div>
					<div>
						<dt>Email</dt>
						<dd>{user.email}</dd>
					</div>
					<div>
						<dt>Phone</dt>
						<dd>{user.phone || '—'}</dd>
					</div>
					<div>
						<dt>Role</dt>
						<dd>{roleLabel(user.role)}</dd>
					</div>
					<div>
						<dt>Responsibility / domain area</dt>
						<dd>{user.responsibility || '—'}</dd>
					</div>
					<div>
						<dt>Department</dt>
						<dd>{user.department || '—'}</dd>
					</div>
					<div>
						<dt>Last signed in</dt>
						<dd>{fmt(user.lastSignInAt)}</dd>
					</div>
					<div>
						<dt>Status</dt>
						<dd>{user.banned ? 'Deactivated' : 'Active'}</dd>
					</div>
				</dl>

				{#if onviewas || ontoggleactive || ondelete}
					<footer class="acts">
						{#if onviewas}
							<button
								type="button"
								class="act"
								onclick={onviewas}
								disabled={busy || user.banned}
								title="Open the console as {user.fullName || user.email}"
							>
								<UserCog size={15} strokeWidth={2} aria-hidden="true" /> View as
							</button>
						{/if}
						{#if ontoggleactive}
							<button
								type="button"
								class="act"
								class:act--good={user.banned}
								onclick={ontoggleactive}
								disabled={busy}
								title={user.banned
									? 'Let them sign in again'
									: 'Stop them signing in — reversible, nothing is deleted'}
							>
								<Power size={15} strokeWidth={2} aria-hidden="true" />
								{user.banned ? 'Activate' : 'Deactivate'}
							</button>
						{/if}
						{#if ondelete}
							<button
								type="button"
								class="act act--danger"
								onclick={ondelete}
								disabled={busy}
								title="Delete the account for good"
							>
								<Trash2 size={15} strokeWidth={2} aria-hidden="true" /> Delete
							</button>
						{/if}
					</footer>
				{/if}
			{:else}
				<div class="grid">
					<label class="field" class:field--err={errors.fullName}>
						<span class="field__label">Name <em class="req">*</em></span>
						<input type="text" bind:value={fullName} autocomplete="off" required />
						{#if errors.fullName}<span class="field__error">{errors.fullName}</span>{/if}
					</label>

					<label class="field" class:field--err={errors.email}>
						<span class="field__label">Email <em class="req">*</em></span>
						<input type="email" bind:value={email} autocomplete="off" required />
						{#if errors.email}<span class="field__error">{errors.email}</span>{/if}
					</label>

					{#if creating || canSetPassword}
						<label class="field" class:field--err={errors.password}>
							<span class="field__label">
								{creating ? 'Password' : 'New password'}
								{#if creating}<em class="req">*</em>{/if}
							</span>
							<span class="field__row">
								{#if showPassword}
									<input
										type="text"
										bind:value={password}
										autocomplete="new-password"
										placeholder={creating ? 'At least 8 characters' : 'Leave blank to keep'}
										required={creating}
									/>
								{:else}
									<input
										type="password"
										bind:value={password}
										autocomplete="new-password"
										placeholder={creating ? 'At least 8 characters' : 'Leave blank to keep'}
										required={creating}
									/>
								{/if}
								<button
									type="button"
									class="field__eye"
									onclick={() => (showPassword = !showPassword)}
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
								</button>
							</span>
							<PasswordStrength {password} />
							{#if errors.password}<span class="field__error">{errors.password}</span>{/if}
						</label>
					{/if}

					<label class="field" class:field--err={errors.phone}>
						<span class="field__label">Phone no. <em class="req">*</em></span>
						<input
							type="tel"
							bind:value={phone}
							use:phoneInput
							autocomplete="off"
							placeholder="10 digits"
							required
						/>
						{#if errors.phone}<span class="field__error">{errors.phone}</span>{/if}
					</label>

					<div class="field" class:field--err={errors.role}>
						<span class="field__label">Role <em class="req">*</em></span>
						<Select
							id="user-form-role"
							value={role}
							options={roleOptions}
							disabled={!creating && !canChangeRole}
							ariaLabel="Role"
							onchange={(value) => (role = value)}
						/>
						{#if errors.role}<span class="field__error">{errors.role}</span>{/if}
					</div>

					<label class="field" class:field--err={errors.department}>
						<span class="field__label">Department <em class="req">*</em></span>
						<input
							type="text"
							bind:value={department}
							autocomplete="off"
							placeholder="e.g. Incubation, Finance"
							required
						/>
						{#if errors.department}<span class="field__error">{errors.department}</span>{/if}
					</label>

					<label class="field field--wide" class:field--err={errors.responsibility}>
						<span class="field__label">Responsibility / domain area <em class="req">*</em></span>
						<input
							type="text"
							bind:value={responsibility}
							autocomplete="off"
							placeholder="e.g. Startup onboarding, deep-tech mentoring"
							required
						/>
						{#if errors.responsibility}
							<span class="field__error">{errors.responsibility}</span>
						{/if}
					</label>
				</div>

				<footer class="sheet__foot">
					<button
						type="button"
						class="btn"
						onclick={() => (creating ? onclose() : (editing = false))}
						disabled={saving}
					>
						Cancel
					</button>
					<button type="submit" class="btn btn--primary" disabled={saving}>
						{saving ? 'Saving…' : creating ? 'Add' : 'Save changes'}
					</button>
				</footer>
			{/if}
		</form>
	{/if}
</dialog>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.sheet {
		padding: 0;
		border: 0;
		background: transparent;
		max-width: none;
		max-height: none;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;

		&:not([open]) {
			display: none;
		}

		&::backdrop {
			background: rgba(10, 12, 16, 0.38);
			backdrop-filter: blur(2px);
		}
	}

	.sheet__panel {
		width: min(640px, calc(100vw - 24px));
		max-height: calc(100svh - 32px);
		overflow-y: auto;
		padding: 22px;
		background: $admin-surface;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-raised;
		font-family: $font-family-base;
		color: $admin-ink;
		animation: sheet-in 0.18s ease-out;
	}

	@keyframes sheet-in {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.99);
		}
	}

	.sheet__head {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 18px;
	}

	.sheet__titles {
		flex: 1;
		min-width: 0;
	}

	.sheet__title {
		margin: 0;
		font-size: 18px;
		font-weight: $font-weight-bold;
		letter-spacing: -0.02em;
	}

	.sheet__sub {
		margin: 4px 0 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: $admin-ink-2;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 32px;
		height: 32px;
		padding: 0;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			color: $admin-ink;
		}
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px 18px;
		margin: 0;

		div {
			min-width: 0;
		}

		dt {
			@include admin-field-label;
			margin-bottom: 3px;
		}

		dd {
			margin: 0;
			font-size: 13.5px;
			color: $admin-ink;
			overflow-wrap: anywhere;
		}
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;

		@media (max-width: 560px) {
			grid-template-columns: 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;

		input {
			@include admin-input;
			font-size: 13px;
			width: 100%;
		}

		&--wide {
			grid-column: 1 / -1;
		}

		&--err input {
			border-color: #c43b3b;
		}
	}

	.field__label {
		@include admin-field-label;
	}

	.req {
		font-style: normal;
		color: #d11a1a;
		margin-left: 2px;
	}

	.field__error {
		font-size: 11.5px;
		color: #b42323;
	}

	.field__row {
		position: relative;
		display: block;

		input {
			padding-right: 40px;
		}
	}

	.field__eye {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		padding: 6px;
		color: $admin-ink-3;
		background: none;
		border: 0;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		@include admin-focus-ring;
	}

	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid $admin-line-soft;
	}

	.act {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 36px;
		padding: 0 14px;
		font: inherit;
		font-size: 12.5px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover:not(:disabled) {
			background: $admin-sunken;
		}

		&:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}

		&--good {
			color: admin-tone-fg('good');
			background: admin-tone-bg('good');
			border-color: transparent;
		}

		&--danger {
			margin-left: auto;
			color: admin-tone-fg('bad');
			background: admin-tone-bg('bad');
			border-color: transparent;
		}
	}

	.sheet__foot {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 20px;
	}

	.btn {
		@include admin-btn-base;

		&--primary {
			@include admin-btn-primary;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet__panel {
			animation: none;
		}
	}
</style>
