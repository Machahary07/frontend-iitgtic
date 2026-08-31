<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	// Grouped the way the definitions are ordered, so the layout sits at the top
	// and each flow's messages stay together in the order they are sent.
	const groups = $derived.by(() => {
		const names: string[] = [];
		for (const t of data.templates) if (!names.includes(t.group)) names.push(t.group);
		return names.map((name) => [name, data.templates.filter((t) => t.group === name)] as const);
	});

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>TIC Admin · Email templates</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	brandSub="Internal"
	navItems={TIC_ADMIN_NAV}
	title="Email templates"
	eyebrow="Email"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="head-btn" href={resolve('/tic-admin/email')}>← Log and usage</a>
	{/snippet}

	<p class="note">
		Every message the site sends is one of these. The copy bundled in the codebase is what runs
		until you edit a template here; <strong>Reset</strong> in the editor puts the bundled copy back. Switching
		a template off stops that message being sent at all — the attempt is still recorded in the log as
		blocked.
	</p>

	{#each groups as [group, templates] (group)}
		<section class="group">
			<h2 class="group__title">{group}</h2>
			<div class="cards">
				{#each templates as template (template.key)}
					<a class="card" href={resolve('/tic-admin/email/templates/[key]', { key: template.key })}>
						<div class="card__head">
							<p class="card__name">{template.name}</p>
							<div class="card__flags">
								{#if !template.enabled}<span class="badge badge--off">Off</span>{/if}
								{#if template.customised}<span class="badge badge--edited">Edited</span>{/if}
							</div>
						</div>
						<p class="card__desc">{template.description}</p>
						<p class="card__subject">{template.subject}</p>
						<p class="card__meta">
							{template.trigger}{#if template.updatedAt}
								· changed {fmtDate(template.updatedAt)}{/if}
						</p>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.head-btn {
		padding: 6px 12px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid #d8dbe0;
		border-radius: 6px;
		text-decoration: none;
		white-space: nowrap;

		&:hover {
			background: #f3f4f6;
		}
	}

	.note {
		margin: 0 0 24px;
		padding: 12px 14px;
		font-size: 12px;
		line-height: 1.6;
		color: #555;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-left: 3px solid #2050d4;
		border-radius: 6px;
	}

	.group {
		margin-bottom: 28px;
	}

	.group__title {
		@include admin-eyebrow;
		margin-bottom: 10px;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}

	.card {
		display: block;
		padding: 16px 18px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		text-decoration: none;
		transition:
			border-color 0.12s ease,
			box-shadow 0.12s ease;

		&:hover {
			border-color: #c9ced6;
			box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
		}
	}

	.card__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.card__name {
		margin: 0;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.card__flags {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.badge {
		@include admin-badge;
		font-size: 10px;
		padding: 2px 8px;

		&--off {
			@include admin-badge-tone('bad');
		}

		&--edited {
			@include admin-badge-tone('info');
		}
	}

	.card__desc {
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 1.55;
		color: #666;
	}

	.card__subject {
		margin: 12px 0 0;
		padding: 7px 10px;
		font-size: 12px;
		color: #333;
		background: #fafbfc;
		border: 1px solid #eef0f3;
		border-radius: 5px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card__meta {
		margin: 10px 0 0;
		font-size: 11px;
		color: #999;
		line-height: 1.5;
	}
</style>
