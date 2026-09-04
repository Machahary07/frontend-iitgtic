<script lang="ts">
	// The single host for every confirmation in the app, mounted once in the root
	// layout. Built on <dialog> rather than a bare div: showModal() gives the
	// focus trap, the inert background and Esc-to-dismiss for free, which is most
	// of what made the native confirm() safe to use in the first place.
	import { dialog } from '$lib/utils/dialog.svelte';

	let el = $state<HTMLDialogElement | null>(null);

	const active = $derived(dialog.active);

	$effect(() => {
		if (!el) return;
		if (active && !el.open) el.showModal();
		else if (!active && el.open) el.close();
	});

	// Esc and a backdrop click both land here through the dialog's own close
	// event. Answering is idempotent, so the close that follows a button press
	// is a no-op rather than a second answer.
	function onClose() {
		dialog.answer(false);
	}

	// <dialog> treats its padding box as the element, so a click landing on the
	// element itself is a click on the backdrop around the panel.
	function onBackdrop(event: MouseEvent) {
		if (event.target === el) dialog.answer(false);
	}
</script>

<dialog bind:this={el} class="dlg" onclose={onClose} onclick={onBackdrop}>
	{#if active}
		<div class="dlg__panel">
			<h2 class="dlg__title">{active.title}</h2>
			{#if active.body}<p class="dlg__body">{active.body}</p>{/if}

			<div class="dlg__actions">
				<button type="button" class="dlg__btn" onclick={() => dialog.answer(false)}>
					{active.cancelLabel ?? 'Cancel'}
				</button>
				<button
					type="button"
					class="dlg__btn dlg__btn--go"
					class:dlg__btn--danger={active.tone === 'danger'}
					onclick={() => dialog.answer(true)}
				>
					{active.confirmLabel ?? 'Confirm'}
				</button>
			</div>
		</div>
	{/if}
</dialog>

<style lang="scss">
	@use '$styles/variables' as *;

	.dlg {
		padding: 0;
		border: 0;
		background: transparent;
		max-width: min(440px, calc(100vw - 32px));
		width: 100%;
		color: #111;

		&::backdrop {
			background: rgb(12 14 18 / 0.55);
		}
	}

	.dlg__panel {
		padding: 24px;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 24px 64px rgb(12 14 18 / 0.28);
		font-family: $font-family-base;
	}

	.dlg__title {
		margin: 0;
		font-size: 16px;
		font-weight: $font-weight-semibold;
		line-height: 1.35;
	}

	.dlg__body {
		margin: 8px 0 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: #555;
	}

	.dlg__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 24px;
	}

	.dlg__btn {
		// 44px tall so the target is thumb-sized on a phone, where these land on
		// top of a form someone is midway through.
		min-height: 44px;
		padding: 0 16px;
		font: inherit;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid #d8dbe0;
		border-radius: 8px;
		cursor: pointer;

		&:hover {
			background: #eef0f3;
		}

		&:focus-visible {
			outline: 2px solid #111;
			outline-offset: 2px;
		}

		&--go {
			color: #fff;
			background: #111;
			border-color: #111;

			&:hover {
				background: #000;
			}
		}

		&--danger {
			background: #a01515;
			border-color: #a01515;

			&:hover {
				background: #8a1212;
			}

			&:focus-visible {
				outline-color: #a01515;
			}
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.dlg[open] .dlg__panel {
			animation: dlg-in 140ms ease-out;
		}
	}

	@keyframes dlg-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
