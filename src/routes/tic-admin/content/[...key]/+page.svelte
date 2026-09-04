<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { beforeNavigate } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import ContentField from '$lib/components/ContentField.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import type { PageData } from './$types';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	// The editor works on a deep copy so nothing is written until Save, and so
	// Discard can put the original back without another round trip.
	// Deliberately a snapshot, not a derived: the draft must not be rewritten
	// under the editor while someone is typing into it.
	let draft = $state<{ root: unknown }>(
		untrack(() => ({ root: structuredClone($state.snapshot(data.value)) }))
	);
	let saved = $state(untrack(() => JSON.stringify(data.value)));

	const dirty = $derived(JSON.stringify(draft.root) !== saved);

	let saving = $state(false);
	let message = $state<{ tone: 'ok' | 'err'; text: string } | null>(null);

	// Reload when navigating between sections.
	let loadedKey = $state(untrack(() => data.section.key));
	$effect(() => {
		if (data.section.key !== loadedKey) {
			loadedKey = data.section.key;
			draft = { root: structuredClone($state.snapshot(data.value)) };
			saved = JSON.stringify(data.value);
			message = null;
		}
	});

	// A custom dialog cannot answer inside beforeNavigate the way a blocking
	// confirm() could. So the navigation is always cancelled first and replayed
	// once the question has been answered — leaving guards against the replay
	// asking again.
	let leaving = $state(false);

	beforeNavigate((nav) => {
		if (!dirty || leaving) return;
		const to = nav.to?.url;
		nav.cancel();
		if (!to) return;

		askConfirm({
			title: 'Leave without saving?',
			body: 'You have unsaved changes to this section.',
			confirmLabel: 'Leave',
			cancelLabel: 'Stay',
			tone: 'danger'
		}).then((ok) => {
			if (!ok) return;
			leaving = true;
			goto(to);
		});
	});

	async function save() {
		saving = true;
		message = null;
		try {
			const res = await fetch('/api/tic-admin/content', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					key: data.section.key,
					value: $state.snapshot(draft.root),
					label: data.section.label
				})
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { message?: string };
				message = { tone: 'err', text: body.message ?? 'Could not save.' };
				return;
			}
			saved = JSON.stringify($state.snapshot(draft.root));
			message = { tone: 'ok', text: 'Saved. The public site is showing this now.' };
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function discard() {
		const ok = await askConfirm({
			title: 'Discard your unsaved changes?',
			body: 'The section goes back to the last saved version.',
			confirmLabel: 'Discard',
			tone: 'danger'
		});
		if (!ok) return;
		draft = { root: JSON.parse(saved) };
		message = null;
	}

	async function resetToDefault() {
		const ok = await askConfirm({
			title: `Reset ${data.section.label} to the shipped copy?`,
			body: 'Your edits to this section are lost.',
			confirmLabel: 'Reset section',
			tone: 'danger'
		});
		if (!ok) return;
		saving = true;
		const res = await fetch(`/api/tic-admin/content?key=${encodeURIComponent(data.section.key)}`, {
			method: 'DELETE'
		});
		saving = false;
		if (!res.ok) {
			message = { tone: 'err', text: 'Could not reset the section.' };
			return;
		}
		await invalidateAll();
		draft = { root: structuredClone($state.snapshot(data.value)) };
		saved = JSON.stringify(data.value);
		message = { tone: 'ok', text: 'Reset to the default copy.' };
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}
</script>

<svelte:head>
	<title>{data.section.label} · TIC Admin</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	brandSub="Internal"
	navItems={TIC_ADMIN_NAV}
	title={data.section.label}
	eyebrow="Content"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="btn" href={resolve('/tic-admin/content')}>← All sections</a>
		<button class="btn" disabled={!dirty || saving} onclick={discard}>Discard</button>
		<button class="btn btn--primary" disabled={!dirty || saving} onclick={save}>
			{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
		</button>
	{/snippet}

	{#if message}
		<p class="msg msg--{message.tone}" role="status">{message.text}</p>
	{/if}

	{#if dirty}
		<p class="dirty" role="status">Unsaved changes.</p>
	{/if}

	<div class="editor">
		<ContentField node={draft} field="root" label={data.section.label} />
	</div>

	<footer class="foot">
		<button class="btn btn--danger" disabled={saving} onclick={resetToDefault}>
			Reset to default copy
		</button>
		<p class="foot__note">
			Restores this section to what ships in <code>content.json</code>. Every change here is
			recorded in Activity with a before and after.
		</p>
	</footer>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.editor {
		display: grid;
		gap: 14px;
	}

	.btn {
		@include admin-btn-small;
	}

	.msg {
		margin: 0 0 14px;

		&--ok {
			@include admin-msg-ok;
		}
		&--err {
			@include admin-msg-err;
		}
	}

	.dirty {
		margin: 0 0 14px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #6a4f00;
		background: #fff4d4;
		border: 1px solid #f0e0b0;
		border-radius: 6px;
		padding: 8px 12px;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		margin-top: 24px;
		padding-top: 18px;
		border-top: 1px solid #e6e8ec;
	}

	.foot__note {
		margin: 0;
		font-size: 12px;
		color: #777;
		max-width: 58ch;

		code {
			font-size: 11px;
			background: #eef0f3;
			padding: 1px 5px;
			border-radius: 3px;
		}
	}
</style>
