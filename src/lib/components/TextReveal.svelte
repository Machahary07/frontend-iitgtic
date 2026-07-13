<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { loadScrollGsap, prefersReducedMotion } from '$lib/utils/animation';

	interface Props {
		text?: string;
		children?: Snippet;
		delay?: number;
		duration?: number;
		once?: boolean;
		tag?: string;
		class?: string;
	}

	let {
		text,
		children,
		delay = 0,
		duration = 1.2,
		once = true,
		tag = 'div',
		class: className = ''
	}: Props = $props();

	let element: HTMLElement;
	let inner: HTMLElement;

	onMount(() => {
		let cleanup: (() => void) | undefined;

		(async () => {
			const { gsap } = await loadScrollGsap();

			gsap.set(inner, { yPercent: 102 });
			if (prefersReducedMotion()) {
				gsap.set(inner, { yPercent: 0 });
				return;
			}

			const anim = gsap.to(inner, {
				yPercent: 0,
				duration,
				delay,
				ease: 'hop',
				scrollTrigger: {
					trigger: element,
					start: 'top 95%',
					toggleActions: once ? 'play none none none' : 'play reverse play reverse'
				}
			});

			cleanup = () => {
				anim.kill();
			};
		})();

		return () => cleanup?.();
	});
</script>

<svelte:element this={tag} class="text-reveal {className}" bind:this={element}>
	<span class="text-reveal-inner" bind:this={inner}>
		{#if text}
			{text}
		{:else if children}
			{@render children()}
		{/if}
	</span>
</svelte:element>

<style lang="scss">
	.text-reveal {
		display: block;
		overflow: hidden;
		// The clip-path ensures the text is only visible within its container bounds
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);

		&-inner {
			display: block;
			will-change: transform;
		}
	}
</style>
