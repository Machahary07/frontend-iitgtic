<script lang="ts">
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	interface Props {
		text: string;
		href: string;
		class?: string;
		role?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		text,
		href,
		class: className = '',
		role = '',
		onclick
	}: Props = $props();

	let inner: HTMLElement;

	async function animate(yPercent: number) {
		if (prefersReducedMotion()) return;

		const { gsap } = await loadGsap();
		gsap.to(inner, {
			yPercent,
			duration: 0.6,
			ease: 'hop',
			overwrite: true
		});
	}
</script>

<a
	{href}
	class="link-reveal {className}"
	{role}
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
</a>

<style lang="scss">
	.link-reveal {
		display: inline-block;
		text-decoration: none;
		cursor: pointer;
		vertical-align: baseline;
	}

	.reveal-mask {
		display: block;
		overflow: hidden;
		// Using a height that matches standard line-height
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
