<script lang="ts">
	import { onMount } from 'svelte';

	type Props = { images: string[]; children: import('svelte').Snippet };
	let { images, children }: Props = $props();

	const MIN_MS = 2200;
	const FADE_MS = 700;

	let progress = $state(0);
	let visible = $state(true);
	let fading = $state(false);

	onMount(() => {
		const t0 = Date.now();
		let loaded = 0;
		const total = images.length;

		function finish() {
			const remaining = Math.max(0, MIN_MS - (Date.now() - t0));
			setTimeout(() => {
				fading = true;
				setTimeout(() => (visible = false), FADE_MS);
			}, remaining);
		}

		if (!total) {
			finish();
			return;
		}

		images.forEach((src) => {
			const img = new Image();
			img.onload = img.onerror = () => {
				progress = ++loaded / total;
				if (loaded === total) finish();
			};
			img.src = src;
		});
	});
</script>

{#if visible}
	<div class="loader" class:fading aria-hidden="true">
		<div class="progress-track">
			<div class="progress-fill" style:width="{progress * 100}%"></div>
		</div>
	</div>
{/if}

{@render children()}

<style lang="scss">
	@use '$styles/variables' as *;

	.loader {
		position: fixed;
		inset: 0;
		z-index: $z-highest;
		background: $color-white;
		opacity: 1;
		transition: opacity 700ms ease;
		pointer-events: all;

		&.fading {
			opacity: 0;
			pointer-events: none;
		}
	}

	.progress-track {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 1px;
		background: $color-subtle;
	}

	.progress-fill {
		height: 100%;
		background: $color-black;
		transition: width 300ms ease;
	}
</style>
