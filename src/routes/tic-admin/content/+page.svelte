<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
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

	const changedCount = $derived(data.sections.filter((s) => s.updatedBy).length);

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}

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
	brandSub="Internal"
	navItems={TIC_ADMIN_NAV}
	title="Content"
	eyebrow="Public site"
	user={adminName}
	onLogout={handleLogout}
>
	<p class="note">
		Every word on the public site is editable here, and saving publishes straight away. Sections
		marked green have been changed by someone; the rest still match the copy that ships with the
		code. {changedCount} of {data.sections.length} sections have been changed; all are stored in the database — anything
		missing falls back to <code>content.json</code>, so the site never depends on this table.
	</p>

	{#each groups as [group, sections] (group)}
		<section class="block">
			<h2 class="block__title">{group}</h2>
			<div class="cards">
				{#each sections as section (section.key)}
					<a class="card" href={resolve('/tic-admin/content/[...key]', { key: section.key })}>
						<span class="card__label">{section.label}</span>
						<span class="card__key">{section.key}</span>
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

	.note code {
		font-size: 11px;
		background: #eef0f3;
		padding: 1px 5px;
		border-radius: 3px;
	}

	.note {
		margin: 0 0 20px;
		font-size: 12px;
		color: #666;
		padding: 10px 12px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-left: 3px solid #2050d4;
		border-radius: 6px;
		max-width: 78ch;
	}

	.block {
		margin-bottom: 26px;
	}

	.block__title {
		@include admin-section-title;
		margin-bottom: 10px;
		font-size: 12px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #777;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 12px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 16px 18px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		text-decoration: none;
		font-family: $font-family-base;

		&:hover {
			border-color: #111;
		}
	}

	.card__label {
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.card__key {
		font-size: 11px;
		color: #9aa1ab;
	}

	.card__meta {
		margin-top: 10px;
		font-size: 11px;
		line-height: 1.5;
		color: #777;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 5px;
		border-radius: 50%;
		background: #c8ccd3;

		&--edited {
			background: #0e6b2c;
		}

		&--stored {
			background: #2050d4;
		}
	}
</style>
