<script lang="ts">
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	interface Props {
		text: string;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		disabled?: boolean;
		/** Shows a repeating line-ray below the button and makes it unclickable. */
		loading?: boolean;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		text,
		type = 'button',
		class: className = '',
		disabled = false,
		loading = false,
		onclick
	}: Props = $props();

	// A submitting button is unclickable; loading always implies disabled.
	const isDisabled = $derived(disabled || loading);

	let inner: HTMLElement;

	async function animate(yPercent: number) {
		if (isDisabled || prefersReducedMotion()) return;
		const { gsap } = await loadGsap();
		gsap.to(inner, {
			yPercent,
			duration: 0.6,
			ease: 'hop',
			overwrite: true
		});
	}
</script>

<button
	{type}
	class="button-reveal {className}"
	class:is-loading={loading}
	disabled={isDisabled}
	aria-busy={loading}
	{onclick}
	onmouseenter={() => animate(-50)}
	onmouseleave={() => animate(0)}
	onfocus={() => animate(-50)}
	onblur={() => animate(0)}
>
	<span class="reveal-mask">
		<span class="reveal-wrapper" bind:this={inner}>
			<span class="reveal-item">{text}</span>
			<span class="reveal-item" aria-hidden="true">{text}</span>
		</span>
	</span>
	{#if loading}
		<span class="reveal-ray" aria-hidden="true"><span class="reveal-ray__beam"></span></span>
	{/if}
</button>

<style lang="scss">
	.button-reveal {
		position: relative;
		display: inline-block;
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		vertical-align: baseline;

		&:disabled {
			cursor: not-allowed;
		}
	}

	// A thin line-ray attached just below the button that sweeps and repeats
	// while the form is submitting. Colour follows --reveal-ray, else the text.
	.reveal-ray {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 5px);
		height: 2px;
		overflow: hidden;
		pointer-events: none;
	}

	.reveal-ray__beam {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 40%;
		background: var(--reveal-ray, currentColor);
		animation: reveal-ray-slide 1s linear infinite;
	}

	@keyframes reveal-ray-slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}

	// No sweeping motion when the user opts out — a gentle pulse still signals work.
	@media (prefers-reduced-motion: reduce) {
		.reveal-ray__beam {
			width: 100%;
			transform: none;
			animation: reveal-ray-pulse 1.4s ease-in-out infinite;
		}

		@keyframes reveal-ray-pulse {
			0%,
			100% {
				opacity: 0.25;
			}
			50% {
				opacity: 0.7;
			}
		}
	}

	.reveal-mask {
		display: block;
		overflow: hidden;
		height: 1.2em;
		line-height: 1.2em;
	}

	.reveal-wrapper {
		display: flex;
		flex-direction: column;
		will-change: transform;
	}

	.reveal-item {
		display: block;
		white-space: nowrap;
		height: 1.2em;
	}
</style>
