<script lang="ts">
	import { tick } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	// One dropdown for the whole app, so a chooser looks and behaves the same on a
	// public form and inside either console — a native <select> renders as the
	// operating system draws it, which is why it never matched anything around it.
	//
	// It is a real listbox, not a styled box that only works with a mouse:
	// arrows move the highlight, Home/End jump, typing a letter or two jumps to a
	// match, Enter or Space chooses, Escape closes and hands focus back. The value
	// is bindable, so callers use it exactly as they used the element it replaces.

	export type SelectOption = {
		value: string;
		label: string;
		/** Second line under the label — a hint, a status, a count. */
		hint?: string;
		disabled?: boolean;
	};

	interface Props {
		value: string;
		options: SelectOption[];
		/** Shown when nothing is chosen yet. */
		placeholder?: string;
		disabled?: boolean;
		/** Matches the caller's own control height where one is expected. */
		size?: 'sm' | 'md';
		/** Accessible name when no visible <label> wraps the control. */
		ariaLabel?: string;
		id?: string;
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(),
		options,
		placeholder = 'Select…',
		disabled = false,
		size = 'md',
		ariaLabel,
		id,
		onchange
	}: Props = $props();

	let open = $state(false);
	let active = $state(-1);
	let trigger = $state<HTMLButtonElement>();
	let list = $state<HTMLDivElement>();
	let root = $state<HTMLDivElement>();

	// Opening upward when there is no room below: the console's tables put these
	// near the bottom of the viewport often enough that a list clipped off-screen
	// would be unusable.
	let dropUp = $state(false);

	const selected = $derived(options.find((o) => o.value === value) ?? null);
	const selectedIndex = $derived(options.findIndex((o) => o.value === value));

	// Typeahead: keystrokes inside a short window are one search string, so "in"
	// reaches Internship rather than stopping on the first I.
	let typed = '';
	let typedAt = 0;

	async function openList() {
		if (disabled) return;
		const box = trigger?.getBoundingClientRect();
		dropUp = box ? window.innerHeight - box.bottom < 260 && box.top > 260 : false;
		open = true;
		active = selectedIndex >= 0 ? selectedIndex : firstEnabled();
		await tick();
		list?.focus();
		scrollActiveIntoView();
	}

	function closeList(refocus = true) {
		open = false;
		active = -1;
		if (refocus) trigger?.focus();
	}

	function firstEnabled() {
		return options.findIndex((o) => !o.disabled);
	}

	function choose(index: number) {
		const option = options[index];
		if (!option || option.disabled) return;
		value = option.value;
		onchange?.(option.value);
		closeList();
	}

	// Steps over disabled entries rather than landing on one and stalling.
	function move(step: number) {
		if (options.length === 0) return;
		let next = active;
		for (let i = 0; i < options.length; i++) {
			next = (next + step + options.length) % options.length;
			if (!options[next]?.disabled) break;
		}
		active = next;
		scrollActiveIntoView();
	}

	function scrollActiveIntoView() {
		const node = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
		node?.scrollIntoView({ block: 'nearest' });
	}

	function jumpTo(edge: 'first' | 'last') {
		if (edge === 'first') {
			active = firstEnabled();
		} else {
			for (let i = options.length - 1; i >= 0; i--) {
				if (!options[i].disabled) {
					active = i;
					break;
				}
			}
		}
		scrollActiveIntoView();
	}

	function typeahead(key: string) {
		const now = Date.now();
		typed = now - typedAt > 700 ? key : typed + key;
		typedAt = now;
		const found = options.findIndex(
			(o) => !o.disabled && o.label.toLowerCase().startsWith(typed.toLowerCase())
		);
		if (found >= 0) {
			active = found;
			scrollActiveIntoView();
		}
	}

	function onTriggerKey(event: KeyboardEvent) {
		if (
			event.key === 'ArrowDown' ||
			event.key === 'ArrowUp' ||
			event.key === 'Enter' ||
			event.key === ' '
		) {
			event.preventDefault();
			void openList();
		}
	}

	function onListKey(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				move(-1);
				break;
			case 'Home':
				event.preventDefault();
				jumpTo('first');
				break;
			case 'End':
				event.preventDefault();
				jumpTo('last');
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				choose(active);
				break;
			case 'Escape':
				event.preventDefault();
				closeList();
				break;
			case 'Tab':
				// Leaving by keyboard closes rather than stranding an open list
				// behind whatever gets focus next.
				closeList(false);
				break;
			default:
				if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
					event.preventDefault();
					typeahead(event.key);
				}
		}
	}

	// A click anywhere else closes it. Bound while open only, so the app is not
	// carrying a document listener per dropdown on every page.
	$effect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!root?.contains(event.target as Node)) closeList(false);
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	});
</script>

<div class="select" class:select--sm={size === 'sm'} bind:this={root}>
	<button
		type="button"
		{id}
		class="select__trigger"
		class:select__trigger--open={open}
		class:select__trigger--placeholder={!selected}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={ariaLabel}
		bind:this={trigger}
		onclick={() => (open ? closeList() : openList())}
		onkeydown={onTriggerKey}
	>
		<span class="select__value">{selected?.label ?? placeholder}</span>
		<span class="select__caret" class:select__caret--open={open} aria-hidden="true">
			<ChevronDown size={15} strokeWidth={2} />
		</span>
	</button>

	{#if open}
		<!-- tabindex on the list rather than on each option: the listbox itself
		     takes focus and owns the keyboard, which is what aria-activedescendant
		     describes and what screen readers announce. -->
		<div
			class="select__list"
			class:select__list--up={dropUp}
			role="listbox"
			tabindex="-1"
			aria-label={ariaLabel}
			aria-activedescendant={active >= 0 ? `${id ?? 'select'}-opt-${active}` : undefined}
			bind:this={list}
			onkeydown={onListKey}
		>
			{#each options as option, i (option.value)}
				<!-- A real button so it is focusable and announced as interactive,
				     with tabindex -1 so Tab still leaves the list in one step: the
				     listbox above owns the keyboard, as aria-activedescendant says. -->
				<button
					type="button"
					tabindex="-1"
					id="{id ?? 'select'}-opt-{i}"
					class="select__option"
					class:select__option--active={i === active}
					class:select__option--selected={option.value === value}
					class:select__option--disabled={option.disabled}
					data-index={i}
					role="option"
					aria-selected={option.value === value}
					aria-disabled={option.disabled}
					onclick={() => choose(i)}
					onmousemove={() => {
						if (!option.disabled) active = i;
					}}
				>
					<span class="select__check" aria-hidden="true">
						{#if option.value === value}<Check size={14} strokeWidth={2.4} />{/if}
					</span>
					<span class="select__text">
						<span class="select__label">{option.label}</span>
						{#if option.hint}<span class="select__hint">{option.hint}</span>{/if}
					</span>
				</button>
			{/each}

			{#if options.length === 0}
				<p class="select__empty">Nothing to choose from</p>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.select {
		position: relative;
		width: 100%;
		font-family: $font-family-base;
	}

	.select__trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		font: inherit;
		font-size: 13px;
		color: $admin-ink;
		text-align: left;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover:not(:disabled) {
			border-color: $admin-ink-3;
		}

		&--open {
			border-color: $admin-accent;
			box-shadow: 0 0 0 3px rgba(32, 80, 212, 0.12);
		}

		&--placeholder {
			color: $admin-ink-3;
		}

		&:disabled {
			background: $admin-sunken;
			color: $admin-ink-3;
			cursor: not-allowed;
		}
	}

	.select--sm .select__trigger {
		padding: 6px 10px;
		font-size: 12px;
	}

	.select__value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select__caret {
		display: inline-flex;
		flex: none;
		color: $admin-ink-3;
		transition: transform $transition-fast;

		&--open {
			transform: rotate(180deg);
		}
	}

	.select__list {
		position: absolute;
		z-index: 60;
		top: calc(100% + 5px);
		left: 0;
		right: 0;
		max-height: 250px;
		overflow-y: auto;
		padding: 5px;
		background: $admin-surface;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
		box-shadow: $admin-shadow-raised;
		animation: select-in 0.12s ease-out;

		&--up {
			top: auto;
			bottom: calc(100% + 5px);
		}

		&:focus {
			outline: none;
		}
	}

	@keyframes select-in {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.select__option {
		display: flex;
		width: 100%;
		font: inherit;
		font-family: $font-family-base;
		text-align: left;
		background: none;
		border: 0;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 9px;
		font-size: 13px;
		color: $admin-ink-2;
		border-radius: $admin-radius-sm;
		cursor: pointer;

		&--active {
			background: $admin-sunken;
			color: $admin-ink;
		}

		&--selected {
			color: $admin-ink;
			font-weight: $font-weight-semibold;
		}

		&--disabled {
			color: $admin-ink-3;
			cursor: not-allowed;
			opacity: 0.65;
		}
	}

	// Holds its width whether or not the tick is there, so the labels do not
	// shuffle sideways as the selection moves.
	.select__check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 15px;
		height: 19px;
		color: $admin-accent;
	}

	.select__text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.select__label {
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.select__hint {
		font-size: 11px;
		font-weight: $font-weight-regular;
		color: $admin-ink-3;
		line-height: 1.4;
	}

	.select__empty {
		margin: 0;
		padding: 12px 9px;
		font-size: 12px;
		color: $admin-ink-3;
		text-align: center;
	}

	@media (prefers-reduced-motion: reduce) {
		.select__list {
			animation: none;
		}

		.select__caret {
			transition: none;
		}
	}
</style>
