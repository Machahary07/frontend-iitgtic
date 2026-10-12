<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import ProfileEditor from '$lib/components/startup/ProfileEditor.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { StartupProfileData } from '$lib/utils/startupProfile';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	let draft = $state<StartupProfileData>(untrack(() => structuredClone(data.profile.draft)));
	let busy = $state(false);

	async function save(publish: boolean) {
		if (publish) {
			const ok = await askConfirm({
				title: 'Publish these changes?',
				body: 'They replace what the website shows straight away, without going through Approvals.',
				confirmLabel: 'Publish'
			});
			if (!ok) return;
		}
		busy = true;
		const res = await fetch('/api/tic-admin/startups', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: data.profile.id, draft, publish })
		});
		busy = false;
		if (!res.ok) {
			const b = (await res.json().catch(() => ({}))) as { message?: string };
			showToast(b.message ?? 'Could not save.', 'err');
			return;
		}
		showToast(publish ? 'Published.' : 'Draft saved.');
		await invalidateAll();
	}

	async function upload(file: File): Promise<string | null> {
		const form = new FormData();
		form.set('id', data.profile.id);
		form.set('file', file);
		const res = await fetch('/api/tic-admin/startups', { method: 'POST', body: form });
		const b = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
		if (!res.ok || !b.url) {
			showToast(b.message ?? 'Could not upload that image.', 'err');
			return null;
		}
		return b.url;
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · {draft.name || 'Profile'}</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title={draft.name || 'Public profile'}
	eyebrow="Incubatees"
	user={adminName}
	onLogout={handleLogout}
>
	<div class="bar">
		<a class="btn" href={resolve('/tic-admin/startups')}>← All incubatees</a>
		<span class="bar__note">
			{data.profile.status === 'in_review'
				? 'The founder has changes waiting in Approvals. Editing here changes that draft.'
				: 'Saving changes the draft; publishing puts it on the website.'}
		</span>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="btn" href={`/incubated-startups/preview/${data.profile.id}`} target="_blank" rel="noopener">Preview draft</a>
		<button class="btn" disabled={busy} onclick={() => save(false)}>Save draft</button>
		<button class="btn btn--primary" disabled={busy} onclick={() => save(true)}>Save and publish</button>
	</div>

	<ProfileEditor bind:value={draft} sectors={data.sectors} {upload} />
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.bar {
		@include admin-card;
		// The card mixin stacks its children; this one is a row of actions.
		flex-direction: row;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-bottom: 18px;
	}

	.bar__note {
		flex: 1;
		min-width: 200px;
		font-size: 13px;
		color: $admin-ink-2;
	}

	.btn {
		@include admin-btn-base;
		text-decoration: none;
	}

	.btn--primary {
		@include admin-btn-primary;
	}
</style>
