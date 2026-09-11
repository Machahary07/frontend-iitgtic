<script lang="ts">
	import { onMount } from 'svelte';

	// A one-time, self-dismissing notice: fades in shortly after load, holds, then
	// fades out. Shown once per browser so it never nags. Essential cookies need no
	// consent, so this is an FYI, not a gate — hence no buttons.
	const KEY = 'iitgtic:cookie-notice-seen';
	let visible = $state(false);

	onMount(() => {
		let seen = false;
		try {
			seen = localStorage.getItem(KEY) === '1';
		} catch {
			// Private mode / storage blocked — just show it this once.
		}
		if (seen) return;

		const showT = setTimeout(() => (visible = true), 700);
		const hideT = setTimeout(() => {
			visible = false;
			try {
				localStorage.setItem(KEY, '1');
			} catch {
				// Nothing to remember it with; it will show again next load. Harmless.
			}
		}, 6000);

		return () => {
			clearTimeout(showT);
			clearTimeout(hideT);
		};
	});
</script>

<div class="cookie-notice" class:visible role="status" aria-hidden={!visible}>
	<span>This site only stores essential cookies.</span>
	<a href="/cookies" tabindex={visible ? 0 : -1}>Learn more</a>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.cookie-notice {
		position: fixed;
		left: 50%;
		bottom: calc(env(safe-area-inset-bottom, 0px) + #{$space-4});
		transform: translateX(-50%) translateY(10px);
		z-index: $z-overlay;
		max-width: calc(100vw - #{$space-6});
		padding: 10px 20px;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-sm;
		line-height: 1.4;
		border-radius: $radius-pill;
		box-shadow: $shadow-md;
		white-space: nowrap;
		text-align: center;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.6s ease, transform 0.6s ease;

		display: inline-flex;
		align-items: center;
		gap: 10px;

		a {
			color: $color-white;
			text-decoration: underline;
			text-underline-offset: 2px;
			white-space: nowrap;
		}

		&.visible {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
			pointer-events: auto;
		}

		@media (max-width: 480px) {
			white-space: normal;
			max-width: calc(100vw - #{$space-4});
			border-radius: 14px;
			font-size: $font-size-xs;
		}
	}
</style>
