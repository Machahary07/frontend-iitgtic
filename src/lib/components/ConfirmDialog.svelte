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
			<div class="dlg__head">
				<span
					class="dlg__icon"
					class:dlg__icon--danger={active.tone === 'danger'}
					aria-hidden="true"
				>
					{#if active.tone === 'danger'}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
							/>
							<path d="M12 9v4" />
							<path d="M12 17h.01" />
						</svg>
					{:else}
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="9" />
							<path d="M12 8h.01" />
							<path d="M11 12h1v4h1" />
						</svg>
					{/if}
				</span>

				<div class="dlg__copy">
					<h2 class="dlg__title">{active.title}</h2>
					{#if active.body}<p class="dlg__body">{active.body}</p>{/if}
				</div>
			</div>

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
		// A corner popover, in the same spot as the toasts, rather than a centred
		// modal — but still a <dialog> so showModal() keeps the focus trap and Esc.
		position: fixed;
		inset: auto 16px 16px auto;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		width: min(400px, calc(100vw - 32px));
		color: #111;

		&::backdrop {
			// No dim: it sits over the page like a toast, not a blocking sheet.
			background: transparent;
		}
	}

	.dlg__panel {
		padding: 20px;
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 14px;
		box-shadow:
			0 18px 48px rgb(12 14 18 / 0.22),
			0 3px 8px rgb(12 14 18 / 0.08);
		font-family: $font-family-base;
	}

	.dlg__head {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}

	.dlg__icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 10px;
		background: #eef0f3;
		color: #4a4f57;

		svg {
			width: 20px;
			height: 20px;
		}

		&--danger {
			background: #fdecec;
			color: #b0181c;
		}
	}

	.dlg__copy {
		flex: 1;
		min-width: 0;
		padding-top: 2px;
	}

	.dlg__title {
		margin: 0;
		font-size: 16px;
		font-weight: $font-weight-semibold;
		line-height: 1.35;
		color: #111;
	}

	.dlg__body {
		margin: 6px 0 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: #565b63;
	}

	.dlg__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 22px;
	}

	.dlg__btn {
		// 44px tall so the target is thumb-sized on a phone, where these land on
		// top of a form someone is midway through.
		min-height: 42px;
		padding: 0 18px;
		font: inherit;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid #d8dbe0;
		border-radius: 9px;
		cursor: pointer;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;

		&:hover {
			background: #f1f3f5;
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
			background: #b0181c;
			border-color: #b0181c;

			&:hover {
				background: #971216;
			}

			&:focus-visible {
				outline-color: #b0181c;
			}
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.dlg[open] .dlg__panel {
			animation: dlg-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
		}
	}

	@keyframes dlg-in {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
</style>
