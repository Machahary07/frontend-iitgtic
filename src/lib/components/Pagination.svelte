<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { PAGE_SIZES, type Pageable } from '$lib/utils/pager.svelte';

	// The one pagination bar every console list uses. Hand it a Pager for a list
	// already in the page, or page/size/total and two callbacks for a list the
	// server pages (see $lib/utils/pager).

	interface Props {
		pager?: Pageable;
		page?: number;
		size?: number;
		total?: number;
		onpage?: (page: number) => void;
		onsize?: (size: number) => void;
		/** What the rows are, for "Showing 1–25 of 132 companies". */
		noun?: string;
		/** Greys the bar out while a server page is on its way. */
		loading?: boolean;
	}

	let {
		pager,
		page = 1,
		size = 25,
		total = 0,
		onpage,
		onsize,
		noun = '',
		loading: loadingProp = false
	}: Props = $props();

	const loading = $derived(loadingProp || Boolean(pager?.loading));

	const current = $derived(pager ? pager.current : page);
	const perPage = $derived(pager ? pager.size : size);
	const count = $derived(pager ? pager.total : total);
	const pages = $derived(Math.max(1, Math.ceil(count / perPage)));
	const from = $derived(count === 0 ? 0 : (current - 1) * perPage + 1);
	const to = $derived(Math.min(count, current * perPage));

	let bar = $state<HTMLElement | null>(null);

	// A new page starts at its first row, so the list's top comes back into
	// view — the bar sits at the bottom, and the reader is down there.
	function toTop() {
		const list = bar?.parentElement;
		if (!list) return;
		const top = list.getBoundingClientRect().top;
		if (top < 0) window.scrollBy({ top: top - 90, behavior: 'smooth' });
	}

	function go(target: number) {
		const next = Math.min(Math.max(1, target), pages);
		if (next === current) return;
		if (pager) pager.go(next);
		else onpage?.(next);
		toTop();
	}

	function resize(next: number) {
		if (pager) pager.resize(next);
		else onsize?.(next);
	}

	// First, last, and a window around the current page, with gaps marked —
	// 1 … 4 5 6 … 12 — so the bar stays one short row however long the list.
	const numbers = $derived.by(() => {
		const out: (number | 'gap')[] = [];
		// A plain list, deduplicated below: this is a throwaway, not reactive state.
		const window = [1, pages, current - 1, current, current + 1];
		if (current <= 3) window.push(2, 3, 4);
		if (current >= pages - 2) window.push(pages - 1, pages - 2, pages - 3);
		const sorted = window
			.filter((n, i) => n >= 1 && n <= pages && window.indexOf(n) === i)
			.sort((a, b) => a - b);
		for (const [i, n] of sorted.entries()) {
			if (i > 0 && n - sorted[i - 1] > 1) out.push('gap');
			out.push(n);
		}
		return out;
	});
</script>

{#if count > 0}
	<nav class="pager" class:pager--loading={loading} aria-label="Pagination" bind:this={bar}>
		<p class="pager__summary">
			Showing <b>{from}–{to}</b> of <b>{count}</b>{noun ? ` ${noun}` : ''}
		</p>

		<label class="pager__size">
			<span>Rows</span>
			<select
				value={perPage}
				onchange={(event) => resize(Number((event.currentTarget as HTMLSelectElement).value))}
				aria-label="Rows per page"
			>
				{#each PAGE_SIZES as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>

		{#if pages > 1}
			<div class="pager__nav">
				<button
					type="button"
					class="pager__btn"
					onclick={() => go(current - 1)}
					disabled={current === 1 || loading}
					aria-label="Previous page"
				>
					<ChevronLeft size={15} strokeWidth={2.2} />
				</button>
				{#each numbers as n, i (n === 'gap' ? `gap-${i}` : n)}
					{#if n === 'gap'}
						<span class="pager__gap" aria-hidden="true">…</span>
					{:else}
						<button
							type="button"
							class="pager__btn"
							class:pager__btn--on={n === current}
							aria-current={n === current ? 'page' : undefined}
							aria-label="Page {n}"
							disabled={loading}
							onclick={() => go(n)}
						>
							{n}
						</button>
					{/if}
				{/each}
				<button
					type="button"
					class="pager__btn"
					onclick={() => go(current + 1)}
					disabled={current === pages || loading}
					aria-label="Next page"
				>
					<ChevronRight size={15} strokeWidth={2.2} />
				</button>
			</div>
		{/if}
	</nav>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.pager {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 16px;
		padding: 12px 18px;
		border-top: 1px solid $admin-line-soft;
		font-family: $font-family-base;
		transition: opacity 0.15s;

		&--loading {
			opacity: 0.6;
		}
	}

	.pager__summary {
		margin: 0 auto 0 0;
		font-size: 12px;
		color: $admin-ink-3;

		b {
			font-weight: $font-weight-semibold;
			color: $admin-ink-2;
			font-variant-numeric: tabular-nums;
		}
	}

	.pager__size {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		color: $admin-ink-3;

		select {
			height: 30px;
			padding: 0 26px 0 10px;
			font: inherit;
			font-size: 12px;
			font-weight: $font-weight-semibold;
			color: $admin-ink;
			background: $admin-surface
				url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E")
				no-repeat right 9px center;
			border: 1px solid $admin-line;
			border-radius: $admin-radius-pill;
			appearance: none;
			cursor: pointer;
			@include admin-focus-ring;
		}
	}

	.pager__nav {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.pager__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 30px;
		height: 30px;
		padding: 0 8px;
		font: inherit;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		font-variant-numeric: tabular-nums;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover:not(:disabled):not(.pager__btn--on) {
			color: $admin-ink;
			border-color: $admin-line;
		}

		&:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		&--on {
			color: $color-white;
			background: $admin-ink;
			border-color: $admin-ink;
		}
	}

	.pager__gap {
		min-width: 18px;
		text-align: center;
		font-size: 12px;
		color: $admin-ink-3;
	}

	@media (max-width: 560px) {
		.pager__summary {
			width: 100%;
		}
	}
</style>
