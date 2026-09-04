<script lang="ts">
	// The single toast region, mounted once in the root layout beside the confirm
	// dialog. Fixed to the top-right so a message stays put over any scroll.
	import { fly, fade } from 'svelte/transition';
	import { toasts } from '$lib/utils/toast.svelte';
</script>

<div class="toasts" aria-live="polite" aria-atomic="false">
	{#each toasts.items as toast (toast.id)}
		<div
			class="toast toast--{toast.tone}"
			role="status"
			in:fly={{ x: 20, duration: 220 }}
			out:fade={{ duration: 140 }}
		>
			<span class="toast__icon" aria-hidden="true">
				{#if toast.tone === 'ok'}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 6 9 17l-5-5" />
					</svg>
				{:else if toast.tone === 'info'}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 8h.01" />
						<path d="M12 11v5" />
						<circle cx="12" cy="12" r="9" />
					</svg>
				{:else}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 8v5" />
						<path d="M12 16h.01" />
						<circle cx="12" cy="12" r="9" />
					</svg>
				{/if}
			</span>

			<span class="toast__text">{toast.text}</span>

			<button
				type="button"
				class="toast__close"
				onclick={() => toasts.dismiss(toast.id)}
				aria-label="Dismiss"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.toasts {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: calc(100vw - 32px);
		// The region spans the corner but must not swallow clicks meant for the
		// page under it; each toast turns pointer events back on for itself.
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 11px;
		width: min(384px, calc(100vw - 32px));
		padding: 12px 12px 12px 14px;
		background: #fff;
		border: 1px solid rgb(17 20 24 / 0.06);
		border-radius: 16px;
		box-shadow:
			0 18px 42px -12px rgb(12 14 18 / 0.22),
			0 2px 6px rgb(12 14 18 / 0.06);
		font-family: $font-family-base;
	}

	.toast__icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;

		svg {
			width: 14px;
			height: 14px;
		}
	}

	.toast--ok .toast__icon {
		background: #e3f6ea;
		color: #0e7a34;
	}

	.toast--err .toast__icon {
		background: #fdecec;
		color: #b0181c;
	}

	.toast--info .toast__icon {
		background: #e8eefc;
		color: #2050d4;
	}

	.toast__text {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		font-weight: $font-weight-medium;
		line-height: 1.4;
		color: #1a1c1f;
	}

	.toast__close {
		flex: none;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 6px;
		color: #9aa1ab;
		cursor: pointer;

		svg {
			width: 14px;
			height: 14px;
		}

		&:focus-visible {
			outline: 2px solid #111;
			outline-offset: 2px;
		}
	}
</style>
