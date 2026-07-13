<script lang="ts">
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	interface Props {
		text: string;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		text,
		type = 'button',
		class: className = '',
		disabled = false,
		onclick
	}: Props = $props();

	let inner: HTMLElement;

	async function animate(yPercent: number) {
		if (disabled || prefersReducedMotion()) return;
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
	{disabled}
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
</button>

<style lang="scss">
	.button-reveal {
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
