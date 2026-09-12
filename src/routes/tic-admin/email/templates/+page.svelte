<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import Mail from '@lucide/svelte/icons/mail';
	import MailX from '@lucide/svelte/icons/mail-x';
	import FilePenLine from '@lucide/svelte/icons/file-pen-line';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Info from '@lucide/svelte/icons/info';
	import { EMAIL_LAYOUT_KEY, renderTemplate, sampleVariables } from '$lib/utils/emailTemplates';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	let showAbout = $state(false);

	// Grouped the way the definitions are ordered, so the layout sits at the top
	// and each flow's messages stay together in the order they are sent.
	const groups = $derived.by(() => {
		const names: string[] = [];
		for (const t of data.templates) if (!names.includes(t.group)) names.push(t.group);
		return names.map((name) => [name, data.templates.filter((t) => t.group === name)] as const);
	});

	// A template is in one of three states, and the state decides the tint and the
	// icon so the grid can be read without stopping to parse each badge.
	function stateOf(template: { enabled: boolean; customised: boolean }) {
		if (!template.enabled) return { tone: 'bad', icon: MailX, label: 'Off' } as const;
		if (template.customised) return { tone: 'info', icon: FilePenLine, label: 'Edited' } as const;
		return { tone: 'good', icon: Mail, label: 'Bundled' } as const;
	}

	// Subjects are stored with their {{placeholders}} intact — that is the template.
	// Filling them with the sample values makes the card read like the mail that
	// actually goes out, which is what someone browsing this list wants to see.
	// The shared layout has no subject of its own (its stored value is literally
	// {{subject}}, inherited from whatever it wraps), so it shows none.
	function previewSubject(template: (typeof data.templates)[number]) {
		if (template.key === EMAIL_LAYOUT_KEY) return '';
		return renderTemplate(template.subject, sampleVariables(template)).trim();
	}

	const counts = $derived({
		all: data.templates.length,
		edited: data.templates.filter((t) => t.customised).length,
		off: data.templates.filter((t) => !t.enabled).length
	});

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
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
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Email templates"
	eyebrow="Email"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="head-btn" href={resolve('/tic-admin/email')}>Log and usage</a>
	{/snippet}

	<div class="summary">
		<span class="tally"><b>{counts.all}</b> templates</span>
		<span class="tally tally--info"><b>{counts.edited}</b> edited</span>
		<span class="tally tally--bad"><b>{counts.off}</b> switched off</span>

		<button
			class="about-toggle"
			aria-expanded={showAbout}
			aria-controls="templates-about"
			onclick={() => (showAbout = !showAbout)}
		>
			<Info size={14} strokeWidth={2} />
			<span>How templates work</span>
		</button>
	</div>

	{#if showAbout}
		<p class="note" id="templates-about">
			Every message the site sends is one of these. The copy bundled in the codebase is what runs
			until you edit a template here; <strong>Reset</strong> in the editor puts the bundled copy back.
			Switching a template off stops that message being sent at all — the attempt is still recorded in
			the log as blocked.
		</p>
	{/if}

	{#each groups as [group, templates] (group)}
		<section class="group">
			<h2 class="group__title">
				{group}<span class="group__count">{templates.length}</span>
			</h2>
			<div class="cards">
				{#each templates as template (template.key)}
					{@const state = stateOf(template)}
					{@const StateIcon = state.icon}
					<a
						class="card"
						href={resolve('/tic-admin/email/templates/[key]', { key: template.key })}
						style="--tile-bg: var(--admin-tone-{state.tone}-bg); --tile-fg: var(--admin-tone-{state.tone}-fg);"
					>
						<div class="card__head">
							<span class="card__icon" aria-hidden="true">
								<StateIcon size={16} strokeWidth={1.9} />
							</span>
							<p class="card__name">{template.name}</p>
							<span class="card__flag">{state.label}</span>
							<span class="card__go" aria-hidden="true">
								<ChevronRight size={15} strokeWidth={2} />
							</span>
						</div>

						<p class="card__desc">{template.description}</p>
						{#if previewSubject(template)}
							<p class="card__subject" title={template.subject}>{previewSubject(template)}</p>
						{/if}

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
		padding: 7px 14px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		text-decoration: none;
		white-space: nowrap;
		@include admin-focus-ring;
	}

	.summary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}

	.tally {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		padding: 6px 13px;
		font-size: 12px;
		color: $admin-ink-2;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
		box-shadow: $admin-shadow-card;

		b {
			font-size: 13px;
			font-weight: $font-weight-bold;
			color: $admin-ink;
		}

		&--info b {
			color: admin-tone-fg('info');
		}

		&--bad b {
			color: admin-tone-fg('bad');
		}
	}

	// The explanation earns a click, not permanent space at the top of the page.
	.about-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
		padding: 5px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: $admin-ink-3;
		background: transparent;
		border: 1px solid transparent;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&[aria-expanded='true'] {
			color: $admin-accent;
			background: #fff;
			border-color: $admin-line;
		}
	}

	.note {
		margin: 0 0 24px;
		padding: 12px 16px;
		font-size: 12px;
		line-height: 1.6;
		color: $admin-ink-2;
		background: admin-tone-bg('info');
		border-radius: $admin-radius-md;
		max-width: 78ch;
	}

	.group {
		margin-bottom: 28px;
	}

	.group__title {
		@include admin-eyebrow;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.group__count {
		padding: 1px 8px;
		font-size: 10px;
		letter-spacing: 0;
		color: $admin-ink-3;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 14px;
	}

	.card {
		@include admin-card;
		gap: 0;
		padding: 16px 18px;
		text-decoration: none;
		@include admin-focus-ring;
	}

	.card__head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	// Tinted by state, so "off" and "edited" register before the label is read.
	.card__icon {
		@include admin-icon-tile('neutral', 30px);
		background: var(--tile-bg);
		color: var(--tile-fg);
		border-radius: $admin-radius-sm;
	}

	.card__name {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card__flag {
		flex: none;
		padding: 3px 9px;
		font-size: 10px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--tile-fg);
		background: var(--tile-bg);
		border-radius: $admin-radius-pill;
	}

	.card__go {
		flex: none;
		display: inline-flex;
		color: $admin-ink-3;
	}

	.card__desc {
		margin: 12px 0 0;
		font-size: 12px;
		line-height: 1.55;
		color: $admin-ink-2;
	}

	.card__subject {
		margin: 12px 0 0;
		padding: 8px 11px;
		font-size: 12px;
		color: $admin-ink;
		background: $admin-sunken;
		border-radius: $admin-radius-sm;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card__meta {
		margin: 10px 0 0;
		font-size: 11px;
		line-height: 1.5;
		color: $admin-ink-3;
	}
</style>
