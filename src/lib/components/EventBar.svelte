<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';
	import content from '$lib/data/content.json';

	const messages: { text: string; href: string }[] = content.eventBar.messages;

	let currentIndex = $state(0);
	let nextIndex = $state(1);
	let isAnimating = $state(false);
	let isHidden = $state(false);

	let inner: HTMLElement;
	let timer: ReturnType<typeof setInterval>;
	let lastScrollY = 0;
	let scrollFrame = 0;

	function syncEventBarOffset() {
		if (typeof document === 'undefined') return;
		document.documentElement.style.setProperty(
			'--event-bar-offset',
			isHidden ? '0px' : 'var(--event-bar-height)'
		);
	}

	function updateFromScroll() {
		scrollFrame = 0;
		const currentScrollY = Math.max(window.scrollY, 0);
		const delta = currentScrollY - lastScrollY;

		if (Math.abs(delta) < 6) return;

		isHidden = currentScrollY > 24 && delta > 0;
		syncEventBarOffset();
		lastScrollY = currentScrollY;
	}

	function handleScroll() {
		if (scrollFrame) return;
		scrollFrame = window.requestAnimationFrame(updateFromScroll);
	}

	async function animateNext() {
		if (isAnimating || !inner) return;
		if (prefersReducedMotion()) {
			currentIndex = nextIndex;
			nextIndex = (currentIndex + 1) % messages.length;
			return;
		}
		isAnimating = true;

		const { gsap } = await loadGsap();
		gsap.to(inner, {
			yPercent: -50,
			duration: 0.6,
			ease: 'hop',
			onComplete: () => {
				currentIndex = nextIndex;
				nextIndex = (currentIndex + 1) % messages.length;
				gsap.set(inner, { yPercent: 0 });
				isAnimating = false;
			}
		});
	}

	function startTimer() {
		stopTimer();
		if (typeof document !== 'undefined' && document.hidden) return;
		timer = setInterval(() => {
			animateNext();
		}, 3000);
	}

	function stopTimer() {
		if (timer) clearInterval(timer);
	}

	onMount(() => {
		lastScrollY = window.scrollY;
		syncEventBarOffset();
		startTimer();
		document.addEventListener('visibilitychange', startTimer);
		window.addEventListener('scroll', handleScroll, { passive: true });
	});

	onDestroy(() => {
		stopTimer();
		if (typeof window !== 'undefined' && scrollFrame) window.cancelAnimationFrame(scrollFrame);
		if (typeof document !== 'undefined') {
			document.documentElement.style.setProperty('--event-bar-offset', 'var(--event-bar-height)');
			document.removeEventListener('visibilitychange', startTimer);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', handleScroll);
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="event-bar" class:hidden={isHidden} onmouseenter={stopTimer} onmouseleave={startTimer}>
	<div class="reveal-mask">
		<div class="reveal-wrapper" bind:this={inner}>
			<a href={messages[currentIndex].href} class="reveal-item">
				{messages[currentIndex].text}
			</a>
			<a
				href={messages[nextIndex].href}
				class="reveal-item"
				aria-hidden="true"
				tabindex="-1"
			>
				{messages[nextIndex].text}
			</a>
		</div>
	</div>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.event-bar {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: var(--event-bar-height);
		background-color: var(--color-black);
		color: var(--color-white);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: $z-highest;
		font-family: var(--font-family-base);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-medium);
		letter-spacing: var(--letter-spacing-normal);
		pointer-events: auto;
		transition: transform var(--transition-base);
		will-change: transform;

		&.hidden {
			transform: translateY(-100%);
		}
	}

	.reveal-mask {
		display: block;
		overflow: hidden;
		height: 1.2em;
		line-height: 1.2em;
		max-width: calc(100% - #{$space-4} * 2);
	}

	.reveal-wrapper {
		display: flex;
		flex-direction: column;
		// Force layer promotion permanently so antialiasing matches at rest
		// and during the GSAP transform. Without this the text looks heavier
		// when static and lighter mid-animation.
		transform: translate3d(0, 0, 0);
		backface-visibility: hidden;
		will-change: transform;
	}

	.reveal-item {
		display: flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		height: 1.2em;
		color: var(--color-white);
		text-decoration: none;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;

		@media (max-width: 480px) {
			font-size: 0.6rem;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&:hover {
			text-decoration: underline;
		}
	}
</style>
