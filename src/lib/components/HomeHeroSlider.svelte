<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';
	import LinkReveal from './LinkReveal.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	type Slide = { id: number; src: string };
	type Direction = 'left' | 'right';

	// Slider pulls from the events feed. CMS contract: each event's `sliderTitle` must be ≤30 chars.
	const featuredEvents = content.pages.events.posts.slice(0, 5);
	const titles = featuredEvents.map((e) => e.sliderTitle);
	const taglines = featuredEvents.map((e) => e.sliderTagline);
	const hrefs = featuredEvents.map((e) => `/events/${e.slug}`);
	const upcomingFlags = featuredEvents.map((e) => e.isUpcoming);

	const imageModules = import.meta.glob<{ default: string }>(
		'$lib/assets/home-hero-slider/img*.webp',
		{ eager: true }
	);
	const images = Object.entries(imageModules)
		.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
		.map(([, mod]) => mod.default);
	const thumbnailModules = import.meta.glob<{ default: string }>(
		'$lib/assets/home-hero-slider/thumbs/img*.webp',
		{ eager: true }
	);
	const thumbnails = Object.entries(thumbnailModules)
		.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
		.map(([, mod]) => mod.default);
	const previewImages = thumbnails.length === images.length ? thumbnails : images;

	const totalSlides = images.length;
	const slideNumbers = Array.from(Array(totalSlides).keys()).map((i) => i + 1);

	// Sentinel-padded lists for the infinite scroller.
	// Layout: [last, ...real, first] — real slide N lives at index N (1-based).
	const titlesLoop = [titles[totalSlides - 1], ...titles, titles[0]];
	const numbersLoop = [slideNumbers[totalSlides - 1], ...slideNumbers, slideNumbers[0]];

	let sliderEl: HTMLDivElement;
	let sliderImagesEl: HTMLDivElement;
	let counterEl: HTMLDivElement;
	let titlesEl: HTMLDivElement;
	let taglineEl: HTMLParagraphElement;
	let previewEl: HTMLDivElement;
	let indicatorEls: HTMLParagraphElement[] = [];
	let previewItems: HTMLDivElement[] = [];

	let currentImg = $state(1);
	let displayedTagline = $state(taglines[0]);
	let displayedHref = $state(hrefs[0] ?? '/events');
	let displayedIsUpcoming = $state(upcomingFlags[0] ?? false);
	let slides = $state<Slide[]>([{ id: 0, src: images[0] }]);
	let nextSlideId = 1;
	let displayPos = 1; // current wrapper index (1..totalSlides during steady state)
	let isWrapping = false; // only locks across the sentinel snap, not normal slides
	let isTransitioning = false;
	let counterItemHeight = 20;
	let titleItemHeight = 60;

	onMount(() => {
		let cleanup: (() => void) | undefined;

		(async () => {
			const { gsap } = await loadGsap();

			let indicatorRotation = 0;

			const measureScrollerItems = () => {
				counterItemHeight =
					counterEl.querySelector('p')?.getBoundingClientRect().height || counterItemHeight;
				titleItemHeight =
					titlesEl.querySelector('p')?.getBoundingClientRect().height || titleItemHeight;
				gsap.set(counterEl, { y: -counterItemHeight * displayPos });
				gsap.set(titlesEl, { y: -titleItemHeight * displayPos });
			};

			// Initial position: skip the prepended "last" sentinel and sit on real slide 1.
			measureScrollerItems();
			window.addEventListener('resize', measureScrollerItems);

			const goToSlide = async (nextImg: number, direction: Direction) => {
				if (isWrapping || isTransitioning || nextImg === currentImg) return;
				isTransitioning = true;

				// Decide where the strip should scroll to.
				// Wrap cases land on a sentinel, then snap silently to the real position.
				let targetPos: number;
				let snapTo: number | null = null;

				if (direction === 'right' && nextImg < currentImg) {
					targetPos = totalSlides + 1; // "first" sentinel at the tail
					snapTo = 1;
				} else if (direction === 'left' && nextImg > currentImg) {
					targetPos = 0; // "last" sentinel at the head
					snapTo = totalSlides;
				} else {
					targetPos = nextImg; // real slide N lives at wrapper index N
				}

				if (snapTo !== null) isWrapping = true;
				if (prefersReducedMotion()) {
					slides = [{ id: nextSlideId++, src: images[nextImg - 1] }];
					currentImg = nextImg;
					displayedTagline = taglines[nextImg - 1] ?? taglines[0];
					displayedHref = hrefs[nextImg - 1] ?? hrefs[0] ?? '/events';
					displayedIsUpcoming = upcomingFlags[nextImg - 1] ?? false;
					displayPos = snapTo ?? targetPos;
					gsap.set(counterEl, { y: -counterItemHeight * displayPos });
					gsap.set(titlesEl, { y: -titleItemHeight * displayPos });
					isWrapping = false;
					isTransitioning = false;
					return;
				}

				// --- Image swap (Svelte-managed array; we only read the resulting nodes) ---
				const existing = sliderImagesEl.querySelectorAll<HTMLDivElement>('.img');
				const currentSlide = existing[existing.length - 1];

				slides.push({ id: nextSlideId++, src: images[nextImg - 1] });
				await tick();

				const allSlides = sliderImagesEl.querySelectorAll<HTMLDivElement>('.img');
				const newSlide = allSlides[allSlides.length - 1];
				const newImgEl = newSlide.querySelector('img');
				if (!newImgEl) {
					if (snapTo !== null) isWrapping = false;
					isTransitioning = false;
					return;
				}

				gsap.set(newImgEl, { x: direction === 'left' ? -500 : 500 });

				gsap.to(currentSlide.querySelector('img'), {
					x: direction === 'left' ? 500 : -500,
					duration: 1.5,
					ease: 'hop'
				});

				gsap.fromTo(
					newSlide,
					{
						clipPath:
							direction === 'left'
								? 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)'
								: 'polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)'
					},
					{
						clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
						duration: 1.5,
						ease: 'hop'
					}
				);

				gsap.to(newImgEl, { x: 0, duration: 1.5, ease: 'hop' });

				if (slides.length > totalSlides) slides.shift();

				indicatorRotation += direction === 'left' ? -90 : 90;
				gsap.to(indicatorEls, { rotate: indicatorRotation, duration: 1, ease: 'hop' });

				gsap.to(taglineEl, {
					yPercent: -110,
					opacity: 0,
					duration: 0.25,
					ease: 'hop',
					onComplete: async () => {
						displayedTagline = taglines[nextImg - 1] ?? taglines[0];
						displayedHref = hrefs[nextImg - 1] ?? hrefs[0] ?? '/events';
						displayedIsUpcoming = upcomingFlags[nextImg - 1] ?? false;
						await tick();
						gsap.fromTo(
							taglineEl,
							{ yPercent: 110, opacity: 0 },
							{ yPercent: 0, opacity: 1, duration: 0.25, ease: 'hop' }
						);
					}
				});

				// --- Counter + title scroll, with sentinel snap on wrap ---
				gsap.to(counterEl, {
					y: -counterItemHeight * targetPos,
					duration: 1,
					ease: 'hop'
				});

				gsap.to(titlesEl, {
					y: -titleItemHeight * targetPos,
					duration: 1,
					ease: 'hop',
					onComplete: () => {
						if (snapTo !== null) {
							gsap.set(counterEl, { y: -counterItemHeight * snapTo });
							gsap.set(titlesEl, { y: -titleItemHeight * snapTo });
							displayPos = snapTo;
							isWrapping = false;
						} else {
							displayPos = targetPos;
						}
						isTransitioning = false;
					}
				});

				currentImg = nextImg;
			};

			const handleClick = (event: MouseEvent) => {
				const target = event.target as HTMLElement;
				if (target.closest('a')) return;

				if (previewEl.contains(target)) {
					const clickedPrev = target.closest('.preview');
					if (!clickedPrev) return;
					const clickedIndex = previewItems.indexOf(clickedPrev as HTMLDivElement) + 1;
					if (clickedIndex === currentImg) return;
					const direction: Direction = clickedIndex < currentImg ? 'left' : 'right';
					goToSlide(clickedIndex, direction);
					return;
				}

				const sliderWidth = sliderEl.clientWidth;
				if (event.clientX < sliderWidth / 2) {
					const next = currentImg === 1 ? totalSlides : currentImg - 1;
					goToSlide(next, 'left');
				} else {
					const next = currentImg === totalSlides ? 1 : currentImg + 1;
					goToSlide(next, 'right');
				}
			};

			let autoInterval: ReturnType<typeof setInterval>;
			const startAutoPlay = () => {
				clearInterval(autoInterval);
				if (document.hidden) return;
				autoInterval = setInterval(() => {
					const next = currentImg === totalSlides ? 1 : currentImg + 1;
					goToSlide(next, 'right');
				}, 5000);
			};
			startAutoPlay();
			document.addEventListener('visibilitychange', startAutoPlay);

			const handleClickWithReset = (event: MouseEvent) => {
				handleClick(event);
				startAutoPlay();
			};

			sliderEl.addEventListener('click', handleClickWithReset);
			cleanup = () => {
				clearInterval(autoInterval);
				window.removeEventListener('resize', measureScrollerItems);
				document.removeEventListener('visibilitychange', startAutoPlay);
				sliderEl.removeEventListener('click', handleClickWithReset);
				gsap.killTweensOf([counterEl, titlesEl, indicatorEls]);
			};
		})();

		return () => cleanup?.();
	});
</script>

<div class="slider" bind:this={sliderEl}>
	<div class="slider-images" bind:this={sliderImagesEl}>
		{#each slides as slide (slide.id)}
			<div class="img">
				<img src={slide.src} alt="" decoding="async" fetchpriority="high" />
			</div>
		{/each}
	</div>

	<div class="slider-overlay" aria-hidden="true"></div>

	<div class="slider-title">
		<div class="slider-title-wrapper" bind:this={titlesEl}>
			{#each titlesLoop as title, i (i)}
				<p>{title}</p>
			{/each}
		</div>
	</div>

	<div class="slider-teaser">
		<div class="tagline-mask">
			<p bind:this={taglineEl}>{displayedTagline}</p>
		</div>
		<div class="slider-actions">
			{#if displayedIsUpcoming}
				<span class="slider-upcoming-badge">Upcoming event</span>
			{/if}
			<LinkReveal href={displayedHref} text="Read More" class="slider-read-more" />
		</div>
	</div>

	<div class="slider-counter">
		<div class="counter" bind:this={counterEl}>
			{#each numbersLoop as n, i (i)}
				<p>{n}</p>
			{/each}
		</div>
		<div><p>&mdash;</p></div>
		<div><p>{totalSlides}</p></div>
	</div>

	<div class="slider-preview" bind:this={previewEl}>
		{#each previewImages as src, i (src)}
			<div class="preview" class:active={currentImg === i + 1} bind:this={previewItems[i]}>
				<img {src} alt="" loading="lazy" decoding="async" />
			</div>
		{/each}
	</div>

	<div class="slider-indicators">
		<p bind:this={indicatorEls[0]}>+</p>
		<p bind:this={indicatorEls[1]}>+</p>
	</div>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.slider {
		position: relative;
		width: 100%;
		min-height: 100svh;
		overflow: hidden;
		user-select: none;
		color: $color-white;
		background: $color-black;
		--slider-title-center-y: 50%;
	}

	.slider :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.slider p {
		font-size: $font-size-sm;
		line-height: 1.4;
		margin: 0;
	}

	.slider-images {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.slider :global(.img) {
		position: absolute;
		inset: 0;
	}

	.slider-overlay {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background: rgba($color-black, 0.35);
	}

	.slider-counter {
		position: absolute;
		bottom: $space-6;
		left: 50%;
		transform: translateX(-50%);
		height: 24px;
		display: flex;
		gap: $space-2;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
		z-index: 2;

		> div {
			flex: 1;
		}

		p {
			line-height: 20px;
		}
	}

	.counter {
		position: relative;
		top: 0;
		will-change: transform;
	}

	.slider-title {
		position: absolute;
		top: var(--slider-title-center-y);
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(100%, calc(100% - #{$space-8} * 2));
		height: 64px;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
		z-index: 2;
	}

	.slider-title-wrapper {
		position: relative;
		width: 100%;
		top: 0;
		text-align: center;
		will-change: transform;

		p {
			font-size: 50px;
			line-height: 60px;
			font-weight: $font-weight-regular;
			white-space: nowrap;
		}
	}

	.slider-teaser {
		position: absolute;
		top: calc(var(--slider-title-center-y) + 54px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: $space-3;
		width: min(470px, calc(100% - #{$space-8} * 2));
		color: rgba($color-white, 0.82);
	}

	.tagline-mask {
		overflow: hidden;
	}

	.slider-teaser p {
		font-size: $font-size-md;
		line-height: $line-height-snug;
		text-align: left;
		text-wrap: balance;
		will-change: transform;
	}

	.slider-actions {
		display: flex;
		align-items: center;
		gap: $space-3;
		flex-wrap: wrap;
	}

	.slider-upcoming-badge {
		display: inline-block;
		padding: 4px 10px;
		background: $color-primary-green;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		border-radius: $radius-sm;
		white-space: nowrap;
	}

	.slider-teaser :global(.slider-read-more) {
		position: relative;
		display: inline-block;
		color: $color-white;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
		text-decoration: none;
		white-space: nowrap;
		border-bottom: 1px solid currentColor;
	}

	.slider-indicators {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 75%;
		display: flex;
		justify-content: space-between;
		z-index: 2;

		p {
			position: relative;
			font-size: 40px;
			font-weight: 200;
			will-change: transform;
		}
	}

	.slider-preview {
		position: absolute;
		bottom: $space-6;
		right: $space-6;
		width: 35%;
		height: 50px;
		display: flex;
		gap: $space-4;
		z-index: 2;
	}

	.preview {
		position: relative;
		flex: 1;
		cursor: pointer;

		&::after {
			content: '';
			position: absolute;
			inset: 0;
			background: rgba($color-black, 0.5);
			transition: background-color 0.3s ease-in-out;
		}

		&.active::after {
			background-color: rgba($color-black, 0);
		}
	}

	// Tablet
	@media (max-width: 900px) {
		.slider-indicators {
			width: 90%;
		}

		.slider-preview {
			width: 90%;
			bottom: 5em;
			left: 50%;
			right: auto;
			transform: translateX(-50%);
		}

		.slider-title-wrapper p {
			font-size: 30px;
			line-height: 44px;
		}

		.slider-title {
			height: 44px;
		}

		.slider-teaser {
			top: calc(var(--slider-title-center-y) + 42px);
			width: min(400px, calc(100% - #{$space-5} * 2));
		}
	}

	// Mobile
	@media (max-width: 480px) {
		.slider {
			min-height: 100svh;
		}

		.slider-title-wrapper p {
			font-size: clamp(1.25rem, 6.2vw, 1.5rem);
			line-height: 32px;
		}

		.slider-title {
			width: calc(100% - #{$space-5} * 2);
			height: 32px;
		}

		.slider-teaser {
			top: calc(var(--slider-title-center-y) + 36px);
			gap: $space-3;
			width: calc(100% - #{$space-5} * 2);
			max-width: 330px;
		}

		.slider-teaser p {
			font-size: $font-size-base;
		}

		.slider-teaser :global(.slider-read-more) {
			align-self: flex-start;
		}

		.slider-preview {
			display: none;
		}

		.slider-counter {
			bottom: $space-4;
			left: $space-4;
			transform: none;
		}

		.slider-indicators {
			width: calc(100% - #{$space-4} * 2);

			p {
				font-size: 32px;
			}
		}
	}

	@media (max-width: 360px) {
		.slider-title-wrapper p {
			font-size: 1.125rem;
		}

		.slider-teaser {
			width: calc(100% - #{$space-4} * 2);
		}
	}
</style>
