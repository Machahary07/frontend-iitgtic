<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import AssistantPanel from '$lib/components/AssistantPanel.svelte';
	import { assistantPanel } from '$lib/utils/assistantPanel.svelte';
	import { canOpen } from '$lib/utils/roles';
	import { liveRefresh } from '$lib/utils/liveRefresh';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// The assistant docks beside every console page, the way it does in the
	// school ERP: a column of its own on a wide screen, a panel floating in from
	// the right on a narrower one, the whole screen on a phone. It is mounted
	// once, here, and only hidden when closed — the layout outlives navigation,
	// so a conversation carries on from one page to the next.
	const hasAssistant = $derived(Boolean(data.admin) && canOpen(data.admin?.role, 'assistant'));
	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');

	$effect(() => {
		assistantPanel.available = hasAssistant;
		if (!hasAssistant) assistantPanel.close();
	});

	// /tic-admin/ai used to be the assistant's page. It now lands here with
	// ?assistant=open, which opens the panel and then drops out of the address
	// bar so a reload does not keep reopening it.
	// Queues, counts and tables stay current without a reload — see liveRefresh.
	// Not on the first-admin setup screen, which has nothing live to show.
	onMount(() => (data.admin ? liveRefresh() : undefined));

	onMount(() => {
		if (page.url.searchParams.get('assistant') !== 'open') return;
		if (hasAssistant) assistantPanel.show();
		const url = new URL(page.url);
		url.searchParams.delete('assistant');
		// Same page, only the query changes, so there is no route to resolve.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(url, page.state);
	});

	// Phone: the panel is the whole screen, so the page must not scroll under it.
	const covers = $derived(assistantPanel.open && hasAssistant && !assistantPanel.docked);
	$effect(() => {
		if (!covers) return;
		const phone = window.matchMedia('(max-width: 768px)').matches;
		if (!phone) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	function onKeydown(event: KeyboardEvent) {
		// Scoped to the panel, so Escape inside a page's own dialog stays theirs.
		if (event.key === 'Escape' && !event.defaultPrevented) assistantPanel.close();
	}
</script>

<div class="console">
	<div class="console__page">
		{@render children()}
	</div>

	{#if hasAssistant}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<aside
			id="console-assistant"
			class="assist"
			class:assist--open={assistantPanel.open}
			aria-label="Assistant"
			inert={!assistantPanel.open}
			onkeydown={onKeydown}
		>
			<AssistantPanel
				{adminName}
				hasServerKey={data.assistant.hasServerKey}
				defaultModel={data.assistant.defaultModel}
			/>
		</aside>
	{/if}
</div>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	$dock: 1280px;
	$panel-w: 400px;
	$gap: 14px;

	.console {
		display: flex;
		align-items: flex-start;
		min-height: 100svh;
	}

	.console__page {
		flex: 1;
		min-width: 0;
	}

	.assist {
		z-index: 60;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;

		// Wide: a third column beside the sidebar and the page. It covers
		// nothing, so there is nothing to dim, and it holds still while the page
		// beside it scrolls.
		@media (min-width: $dock) {
			position: sticky;
			top: $gap;
			flex: none;
			width: $panel-w;
			height: calc(100svh - #{$gap * 2});
			margin: $gap $gap $gap 0;

			&:not(.assist--open) {
				display: none;
			}
		}

		// Narrower: floating over the page from the right, so the page keeps
		// its full width underneath.
		@media (max-width: #{$dock - 0.02px}) {
			position: fixed;
			top: 12px;
			right: 12px;
			bottom: 12px;
			width: min(420px, calc(100vw - 24px));
			box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.35);
			transform: translateX(calc(100% + 24px));
			visibility: hidden;
			transition:
				transform 0.22s cubic-bezier(0.32, 0.72, 0, 1),
				visibility 0.22s;

			&.assist--open {
				transform: none;
				visibility: visible;
			}
		}

		// Phone: a 400px column is the whole screen anyway, and a sliver of page
		// behind it would be a backdrop nobody can tap.
		@media (max-width: #{$bp-sm}) {
			inset: 0;
			width: auto;
			border: 0;
			border-radius: 0;
			padding-top: env(safe-area-inset-top);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.assist {
			transition: none;
		}
	}
</style>
