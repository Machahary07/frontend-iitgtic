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
	import { showToast } from '$lib/utils/toast.svelte';

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

	// Reload when navigating between sections.
	let loadedKey = $state(untrack(() => data.section.key));
	$effect(() => {
		if (data.section.key !== loadedKey) {
			loadedKey = data.section.key;
			draft = { root: structuredClone($state.snapshot(data.value)) };
			saved = JSON.stringify(data.value);
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
				showToast(body.message ?? 'Could not save.', 'err');
				return;
			}
			saved = JSON.stringify($state.snapshot(draft.root));
			showToast('Saved. The public site is showing this now.', 'ok');
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
		showToast('Changes discarded.', 'ok');
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
			showToast('Could not reset the section.', 'err');
			return;
		}
		await invalidateAll();
		draft = { root: structuredClone($state.snapshot(data.value)) };
		saved = JSON.stringify(data.value);
		showToast('Reset to the default copy.', 'ok');
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
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
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

	.dirty {
		margin: 0 0 14px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #6a4f00;
		background: #fff4d4;
		border: 1px solid #f0e0b0;
		border-radius: $admin-radius-sm;
		padding: 8px 12px;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		margin-top: 24px;
		padding-top: 18px;
		border-top: 1px solid $admin-line-soft;
	}

	.foot__note {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
		max-width: 58ch;

		code {
			font-size: 11px;
			background: $admin-line-soft;
			padding: 1px 5px;
			border-radius: 3px;
		}
	}
</style>
