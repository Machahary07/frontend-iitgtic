<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { showToast } from '$lib/utils/toast.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	const groups = $derived.by(() => {
		const order: string[] = [];
		const byGroup: Record<string, typeof data.sections> = {};
		for (const section of data.sections) {
			if (!byGroup[section.group]) {
				byGroup[section.group] = [];
				order.push(section.group);
			}
			byGroup[section.group].push(section);
		}
		return order.map((group) => [group, byGroup[group]] as const);
	});

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

	// Orientation note: shown on every visit to the content page so the reminder
	// that saves publish straight away is always in front of whoever is editing.
	onMount(() => {
		showToast(
			'Every word on the public site is editable here — saving publishes straight away.',
			'info'
		);
	});

	function fmtDate(iso: string | null) {
		if (!iso) return null;
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>TIC Admin · Content</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	title="Content"
	eyebrow="Public site"
	user={adminName}
	onLogout={handleLogout}
>
	{#each groups as [group, sections] (group)}
		<section class="block">
			<h2 class="block__title">{group}</h2>
			<div class="cards">
				{#each sections as section (section.key)}
					<a class="card" href={resolve('/tic-admin/content/[...key]', { key: section.key })}>
						<span class="card__head">
							<span class="card__text">
								<span class="card__label">{section.label}</span>
								<span class="card__key">{section.key}</span>
							</span>
							<span class="card__go" aria-hidden="true">
								<ChevronRight size={15} strokeWidth={2} />
							</span>
						</span>
						<span class="card__meta">
							{#if section.updatedBy}
								<span class="dot dot--edited"></span>
								Edited {fmtDate(section.updatedAt)}<br />by {section.updatedBy}
							{:else if section.stored}
								<span class="dot dot--stored"></span>
								Editable · matches the code
							{:else}
								<span class="dot"></span>
								Not yet imported
							{/if}
						</span>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.block {
		margin-bottom: 26px;
	}

	.block__title {
		@include admin-section-title;
		margin-bottom: 10px;
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 12px;
	}

	.card {
		@include admin-card;
		gap: 3px;
		padding: 16px 18px;
		text-decoration: none;
		@include admin-focus-ring;
	}

	// The chevron is the layer cue: this card opens the editor one level down.
	.card__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.card__text {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.card__go {
		@include admin-icon-tile('neutral', 24px);
		border-radius: $admin-radius-sm;
		margin-top: 1px;
	}

	.card__label {
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.card__key {
		font-size: 11px;
		color: $admin-ink-3;
	}

	.card__meta {
		margin-top: 10px;
		font-size: 11px;
		line-height: 1.5;
		color: $admin-ink-3;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 5px;
		border-radius: 50%;
		background: #c8ccd3;

		&--edited {
			background: admin-tone-fg('good');
		}

		&--stored {
			background: $admin-accent;
		}
	}
</style>
