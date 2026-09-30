<script lang="ts">
	import { onMount } from 'svelte';
	import HomeAssociationMarquee from './HomeAssociationMarquee.svelte';
	import LinkReveal from './LinkReveal.svelte';
	import { resolve } from '$app/paths';
	import { getContent } from '$lib/content';
	import { prefersReducedMotion } from '$lib/utils/animation';

	const content = getContent();

	type RouteHref = Parameters<typeof resolve>[0];
	const intro = content.homeHero.intro;
	const ctaHref = intro.ctaHref as RouteHref;

	// Event photos scattered around the hero, reshuffled every few seconds.
	// These are ~480px WebP copies of the full-size shots in static/, sized for
	// the 60–180px tiles they fill.
	const PHOTOS = Object.values(
		import.meta.glob<string>('../assets/hero-scatter/*.webp', {
			eager: true,
			query: '?url',
			import: 'default'
		})
	);

	// Shapes: square or rectangle (landscape / portrait), none smaller than ~110px.
	const SHAPES = [
		{ w: [110, 150], ratio: 1 }, // square
		{ w: [140, 180], ratio: 3 / 4 }, // landscape
		{ w: [100, 130], ratio: 4 / 3 } // portrait
	] as const;

	const GAP = 14; // min space between photos
	const TEXT_WIDTH = 760; // width kept clear in the middle for the hero text
	// Below this there's no room beside the text, so the photos move to a band
	// above the title. Keep in sync with the media query in the styles.
	const STACKED_QUERY = '(max-width: 1119.98px)';
	const MIN_PHOTOS = 9; // desktop: shrink the photos (down to MIN_SCALE) until at least this many fit
	const MIN_SCALE = 0.7;
	const ATTEMPTS = 12; // random layouts tried per render; the fullest one wins
	const STACKED_COUNT = 5; // phone / tablet: always exactly this many in the band above the title
	const FADE = 600; // matches the .scatter img opacity transition
	const HOLD = 2000;

	type Box = { x: number; y: number; w: number; h: number };
	type Side = 'left' | 'right';

	let heroEl: HTMLElement;
	let layerEl: HTMLDivElement;

	const rand = (min: number, max: number) => min + Math.random() * (max - min);
	const shuffle = <T,>(a: T[]) =>
		a
			.map((v) => [Math.random(), v] as const)
			.sort((x, y) => x[0] - y[0])
			.map((p) => p[1]);

	onMount(() => {
		// One decoded <img> per photo, reused across layouts, so a photo is never
		// shown before it has fully loaded.
		const pool = new Map<string, HTMLImageElement>();
		const ready = Promise.all(
			PHOTOS.map((src) => {
				const img = new Image();
				img.alt = '';
				img.decoding = 'async';
				img.src = src;
				return img
					.decode()
					.then(() => pool.set(src, img))
					.catch(() => {}); // a broken photo is simply left out
			})
		);

		// Random w×h for a shape at a given scale.
		const size = (shape: (typeof SHAPES)[number], scale: number) => {
			const w = Math.round(rand(shape.w[0], shape.w[1]) * scale);
			return { w, h: Math.round(w * shape.ratio) };
		};

		const overlaps = (placed: Box[], b: Box) =>
			placed.some(
				(r) =>
					b.x < r.x + r.w + GAP &&
					b.x + b.w + GAP > r.x &&
					b.y < r.y + r.h + GAP &&
					b.y + b.h + GAP > r.y
			);

		// Tries the random shape first, then the others; returns null if none fits.
		const place = (fits: (w: number, h: number) => Box | null, scale: number) => {
			const first = Math.floor(Math.random() * SHAPES.length);
			for (let k = 0; k < SHAPES.length; k++) {
				const { w, h } = size(SHAPES[(first + k) % SHAPES.length], scale);
				const box = fits(w, h);
				if (box) return box;
			}
			return null;
		};

		// Desktop: pack both side trapeziums. Boxes are measured from each page edge.
		function packSides(W: number, H: number, zoneW: number, scale: number, max: number) {
			// Tall at the page edge, shorter where it meets the text column.
			const edge = { top: 120, bottom: H - 40 };
			const inner = { top: H * 0.3, bottom: H * 0.72 };
			const topAt = (x: number) => edge.top + (inner.top - edge.top) * (x / zoneW);
			const bottomAt = (x: number) => edge.bottom + (inner.bottom - edge.bottom) * (x / zoneW);

			const placed: Record<Side, Box[]> = { left: [], right: [] };
			const full: Record<Side, boolean> = { left: false, right: false };
			const items: { side: Side; box: Box }[] = [];

			let turn = 0;
			while (items.length < max && !(full.left && full.right)) {
				const side: Side = turn++ % 2 ? 'right' : 'left';
				if (full[side]) continue;

				const box = place((w, h) => {
					if (w > zoneW - 16) return null; // wider than this side's zone
					for (let tries = 0; tries < 300; tries++) {
						const x = rand(16, zoneW - w);
						// The trapezium is narrowest at the box's inner edge.
						const top = topAt(x + w);
						const bottom = bottomAt(x + w);
						if (bottom - top < h) continue;
						const b = { x, y: rand(top, bottom - h), w, h };
						if (!overlaps(placed[side], b)) return b;
					}
					return null;
				}, scale);

				if (box) {
					placed[side].push(box);
					items.push({ side, box });
				} else full[side] = true;
			}
			return items;
		}

		// Phone / tablet: pack the band above the title, up to `max` photos.
		function packBand(bw: number, bh: number, scale: number, max: number) {
			const placed: Box[] = [];
			let misses = 0;
			while (misses < 3 && placed.length < max) {
				const box = place((w, h) => {
					for (let tries = 0; tries < 300; tries++) {
						const b = { x: rand(0, bw - w), y: rand(0, bh - h), w, h };
						if (!overlaps(placed, b)) return b;
					}
					return null;
				}, scale);

				if (box) {
					placed.push(box);
					misses = 0;
				} else misses++;
			}
			return placed.map((box) => ({ side: 'left' as Side, box }));
		}

		function layout() {
			layerEl.replaceChildren();
			const photos = shuffle([...pool.keys()]);
			if (!photos.length) return;

			const W = heroEl.clientWidth;
			const H = heroEl.clientHeight;
			const zoneW = Math.min((W - TEXT_WIDTH) / 2 - 24, 440);

			// No room at the sides (tablet / phone): scatter them in a band above the title.
			const stacked = window.matchMedia(STACKED_QUERY).matches;

			let best: { side: Side; box: Box }[] = [];
			if (stacked) {
				const bw = layerEl.clientWidth;
				const bh = layerEl.clientHeight;
				const count = Math.min(STACKED_COUNT, photos.length);
				// Phones start at 75% of desktop size; if the count doesn't fit, shrink a step.
				for (let scale = bw < 420 ? 0.75 : 1; best.length < count; scale *= 0.95) {
					for (let i = 0; i < ATTEMPTS && best.length < count; i++) {
						const items = packBand(bw, bh, scale, count);
						if (items.length > best.length) best = items;
					}
				}
			} else {
				// Full size first; only if fewer than MIN_PHOTOS fit, step the sizes down.
				for (let scale = 1; scale >= MIN_SCALE - 1e-9 && best.length < MIN_PHOTOS; scale -= 0.05) {
					for (let i = 0; i < ATTEMPTS; i++) {
						const items = packSides(W, H, zoneW, scale, photos.length);
						if (items.length > best.length) best = items;
						if (best.length >= photos.length) break;
					}
				}
			}

			best.forEach(({ side, box }, i) => {
				const img = pool.get(photos[i])!;
				img.className = '';
				img.removeAttribute('style');
				img.style.width = box.w + 'px';
				img.style.height = box.h + 'px';
				img.style.top = box.y + 'px';
				img.style[side] = box.x + 'px';
				layerEl.appendChild(img);
			});

			// Two frames so the browser paints opacity 0 before the fade-in starts.
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					for (const img of layerEl.children) img.classList.add('is-in');
				})
			);
		}

		// Reshuffle loop: fade in (0.6s) → hold 2s → fade out (0.6s) → new photos and layout.
		const reduceMotion = prefersReducedMotion();
		let cycleTimer: ReturnType<typeof setTimeout>;
		let destroyed = false;

		function cycle() {
			clearTimeout(cycleTimer);
			layout();
			if (reduceMotion) return; // one static layout, no reshuffling
			cycleTimer = setTimeout(() => {
				for (const img of layerEl.children) img.classList.remove('is-in');
				cycleTimer = setTimeout(cycle, FADE);
			}, FADE + HOLD);
		}

		// Start only once every photo is decoded, so each fade-in is smooth.
		ready.then(() => {
			if (!destroyed) cycle();
		});

		let resizeTimer: ReturnType<typeof setTimeout>;
		let lastW = window.innerWidth;
		const onResize = () => {
			if (window.innerWidth === lastW) return;
			lastW = window.innerWidth;
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				if (pool.size) cycle();
			}, 200);
		};
		window.addEventListener('resize', onResize);

		return () => {
			destroyed = true;
			clearTimeout(cycleTimer);
			clearTimeout(resizeTimer);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<section class="intro-hero" bind:this={heroEl}>
	<div class="scatter" bind:this={layerEl} aria-hidden="true"></div>

	<div class="content">
		<h1>
			{intro.headlineLead}<br /><em>{intro.headlineEmphasis}</em>
		</h1>

		<div class="citation">
			<p>{intro.citation}</p>
		</div>
	</div>

	<LinkReveal href={ctaHref} text={intro.ctaLabel} class="cta" autoplay />

	<div class="marquee-wrap">
		<HomeAssociationMarquee />
	</div>

	<div class="scroll-indicator">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
		</svg>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;

	.intro-hero {
		min-height: 100svh;
		width: 100%;
		background-color: $color-white;
		color: #1a1a1a;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-8 $space-8;
		position: relative;
		font-family: $font-family-serif;
		gap: $space-6;
	}

	.content {
		width: min(800px, 100%);
		min-width: 0;
	}

	// ---- Scattered event photos (placed by the script) ----
	.scatter {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;

		:global(img) {
			position: absolute;
			object-fit: cover;
			border-radius: $radius-sm;
			opacity: 0;
			transition: opacity 0.6s ease;
		}

		:global(img.is-in) {
			opacity: 1;
		}
	}

	.content,
	:global(.cta),
	.marquee-wrap {
		position: relative;
		z-index: 1;
	}

	:global(.cta) {
		display: inline-flex;
		align-items: center;
		padding: $space-3 $space-7;
		background-color: $color-black;
		color: $color-white;
		border-radius: $radius-pill;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		font-style: italic;
		text-decoration: none;
		white-space: nowrap;
	}

	// The italic label's last glyph leans past its box; widen the reveal mask
	// (without moving the text) so overflow: hidden doesn't clip it.
	.intro-hero :global(.cta .reveal-mask) {
		padding-inline: 0.2em;
		margin-inline: -0.2em;
	}

	.marquee-wrap {
		margin-top: $space-3;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	h1 {
		font-family: 'Anek Latin', $font-family-serif;
		font-size: clamp(2.5rem, 7vw, 4.25rem);
		line-height: 1.05;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin-bottom: $space-8;
		text-wrap: balance;

		em {
			font-style: $font-style-italic;
		}
	}

	.citation {
		max-width: 500px;
		margin: 0 auto;
		font-size: $font-size-md;
		line-height: $line-height-base;
		opacity: 0.8;
	}

	.scroll-indicator {
		position: absolute;
		bottom: $space-8;
		left: 50%;
		transform: translateX(-50%);
		opacity: 0.5;
		animation: bounce 2s infinite;
	}

	@keyframes bounce {
		0%,
		20%,
		50%,
		80%,
		100% {
			transform: translate(-50%, 0);
		}
		40% {
			transform: translate(-50%, -10px);
		}
		60% {
			transform: translate(-50%, -5px);
		}
	}

	@media (max-width: $bp-sm) {
		.intro-hero {
			min-height: auto;
			justify-content: flex-start;
			padding: calc(var(--page-shell-top, 100px) + #{$space-7}) $space-5 $space-6;
			gap: $space-5;
		}

		.scroll-indicator {
			display: none;
		}

		h1 {
			max-width: 16ch;
			margin-inline: auto;
			font-size: clamp(1.75rem, 8vw, 2.75rem);
			margin-bottom: $space-5;
		}

		.citation {
			max-width: 300px;
			font-size: $font-size-base;
			padding: 0;
		}

		:global(.cta) {
			justify-content: center;
			width: min(100%, 280px);
			padding-inline: $space-5;
		}

		.marquee-wrap {
			margin-top: 0;
		}
	}

	@media (max-width: $bp-xs), (max-height: 720px) {
		.intro-hero {
			padding-inline: $space-4;
			gap: $space-4;
		}

		.scroll-indicator {
			display: none;
		}
	}

	// Narrow screens (STACKED_QUERY): the photos are scattered in a band above
	// the title (same random packing as the desktop sides). Done in CSS so the
	// band's space is reserved from the first paint.
	@media (max-width: 1119.98px) {
		.intro-hero {
			padding-top: calc(var(--page-shell-top, 100px) + #{$space-2});
		}

		.scatter {
			position: relative;
			inset: auto;
			order: -1;
			width: min(100%, 480px);
			height: clamp(200px, 56vw, 280px);
			margin-bottom: $space-5; // extra room before the title
			flex-shrink: 0;
		}
	}
</style>
