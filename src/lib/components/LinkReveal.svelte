<script lang="ts">
	import { onMount } from 'svelte';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	interface Props {
		text: string;
		href: string;
		class?: string;
		role?: string;
		onclick?: (event: MouseEvent) => void;
		// Plays the reveal on its own every 1.5s (hold 0.9s, slide 0.6s); hover/focus pauses it.
		autoplay?: boolean;
	}

	let {
		text,
		href,
		class: className = '',
		role = '',
		onclick,
		autoplay = false
	}: Props = $props();

	let inner: HTMLElement;
	let loop: ReturnType<typeof import('gsap').gsap.timeline> | undefined;

	onMount(() => {
		if (!autoplay || prefersReducedMotion()) return;

		let destroyed = false;
		loadGsap().then(({ gsap }) => {
			if (destroyed) return;
			// Both lines are identical, so snapping back to 0 at each repeat is invisible.
			loop = gsap
				.timeline({ repeat: -1 })
				.fromTo(inner, { yPercent: 0 }, { yPercent: -50, duration: 0.6, ease: 'hop' }, 0.9);
		});

		return () => {
			destroyed = true;
			loop?.kill();
		};
	});

	async function animate(yPercent: number) {
		if (autoplay) {
			if (yPercent === 0) loop?.resume();
			else loop?.pause();
			return;
		}
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
