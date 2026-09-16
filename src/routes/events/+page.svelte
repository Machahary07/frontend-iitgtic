<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import EventCalendar from '$lib/components/EventCalendar.svelte';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	const content = getContent();

	const page = content.pages.events;
	const ctaContent = content.cta.apply;

	const upcomingPosts = page.posts.filter((p) => p.isUpcoming);
	const pastPosts = page.posts.filter((p) => !p.isUpcoming);

	function formatDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	let upcomingTitleRefs: HTMLElement[] = $state([]);
	let pastTitleRefs: HTMLElement[] = $state([]);

	async function animate(refs: HTMLElement[], idx: number, yPercent: number) {
		if (prefersReducedMotion()) return;
		const el = refs[idx];
		if (!el) return;
		const { gsap } = await loadGsap();
		gsap.to(el, {
			yPercent,
			duration: 0.6,
			ease: 'hop',
			overwrite: true
		});
	}
</script>

<svelte:head>
	<title>{page.title}</title>
</svelte:head>

<section class="hero">
	<p class="hero__eyebrow">{page.hero.eyebrow}</p>
	<h1>
		{page.hero.headlineLead}
		<em>{page.hero.headlineEmphasis}</em>
	</h1>
	<div class="hero__lede">
		<p>{page.hero.lede}</p>
	</div>
</section>

<EventCalendar
	eyebrow="Calendar"
	headlineLead="Browse the calendar,"
	headlineEmphasis="month by month."
/>

{#if upcomingPosts.length > 0}
	<section class="grid-section">
		<div class="grid-section__inner">
			<div class="grid-section__head">
				<p class="grid-section__eyebrow">{page.upcomingEyebrow}</p>
				<span class="grid-section__count">{upcomingPosts.length}</span>
			</div>
			<div class="grid">
				{#each upcomingPosts as post, i (post.slug)}
					<a
						href={`/events/${post.slug}`}
						class="card card--upcoming"
						onmouseenter={() => animate(upcomingTitleRefs, i, -50)}
						onmouseleave={() => animate(upcomingTitleRefs, i, 0)}
						onfocus={() => animate(upcomingTitleRefs, i, -50)}
						onblur={() => animate(upcomingTitleRefs, i, 0)}
					>
						<div class="card__top">
							<span class="card__date">{formatDate(post.date)}</span>
							<svg
								class="card__arrow"
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M7 7h10v10" />
								<path d="M7 17 17 7" />
							</svg>
						</div>
						<div class="card__image" aria-hidden="true">
							{#if post.coverImage?.src}
								<img src={post.coverImage.src} alt="" loading="lazy" decoding="async" />
							{/if}
						</div>
						<div class="card__bottom">
							<span class="card__badge">Upcoming</span>
							<div class="card__title">
								<span class="reveal-mask">
									<span class="reveal-wrapper" bind:this={upcomingTitleRefs[i]}>
										<span class="reveal-item">{post.title}</span>
										<span class="reveal-item" aria-hidden="true">{post.title}</span>
									</span>
								</span>
							</div>
							<p class="card__excerpt">{post.excerpt}</p>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

{#if pastPosts.length > 0}
	<section class="grid-section grid-section--past">
		<div class="grid-section__inner">
			<div class="grid-section__head">
				<p class="grid-section__eyebrow">{page.pastEyebrow}</p>
				<span class="grid-section__count">{pastPosts.length}</span>
			</div>
			<div class="grid">
				{#each pastPosts as post, i (post.slug)}
					<a
						href={`/events/${post.slug}`}
						class="card"
						onmouseenter={() => animate(pastTitleRefs, i, -50)}
						onmouseleave={() => animate(pastTitleRefs, i, 0)}
						onfocus={() => animate(pastTitleRefs, i, -50)}
						onblur={() => animate(pastTitleRefs, i, 0)}
					>
						<div class="card__top">
							<span class="card__date">{formatDate(post.date)}</span>
							<svg
								class="card__arrow"
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M7 7h10v10" />
								<path d="M7 17 17 7" />
							</svg>
						</div>
						<div class="card__image" aria-hidden="true">
							{#if post.coverImage?.src}
								<img src={post.coverImage.src} alt="" loading="lazy" decoding="async" />
							{/if}
						</div>
						<div class="card__title">
							<span class="reveal-mask">
								<span class="reveal-wrapper" bind:this={pastTitleRefs[i]}>
									<span class="reveal-item">{post.title}</span>
									<span class="reveal-item" aria-hidden="true">{post.title}</span>
								</span>
							</span>
						</div>
						<p class="card__excerpt">{post.excerpt}</p>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

<CallToAction
	eyebrow={ctaContent.eyebrow}
	headlineLead={ctaContent.headlineLead}
	headlineEmphasis={ctaContent.headlineEmphasis}
	label={ctaContent.label}
	href={ctaContent.href}
/>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.hero {
		@include page-hero;
	}

	.hero__eyebrow {
		@include eyebrow;
	}

	.hero h1 {
		@include serif-h1(14ch);
	}

	.hero__lede {
		@include hero-lede(640px);
	}

	.grid-section {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8;
		border-top: 1px solid rgba($color-black, 0.08);

		&:last-of-type {
			padding-bottom: $space-10;
		}
	}

	.grid-section--past {
		background: rgba($color-black, 0.03);
	}

	.grid-section__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-6;
	}

	.grid-section__head {
		display: flex;
		align-items: baseline;
		gap: $space-3;
	}

	.grid-section__eyebrow {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.grid-section__count {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		color: rgba($color-black, 0.45);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: $space-5;

		@include breakpoint-down($bp-md) {
			grid-template-columns: repeat(2, 1fr);
		}

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		padding: $space-6;
		background: $color-white;
		color: $color-black;
		border: 1px solid $color-black;
		text-decoration: none;
		overflow: hidden;
		cursor: pointer;
		min-height: 460px;
		justify-content: flex-start;

		@include breakpoint-down($bp-sm) {
			min-height: 0;
		}
	}

	.card--upcoming {
		border-color: $color-primary-green;
		box-shadow: 0 0 0 1px $color-primary-green inset;
	}

	.card__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: $space-3;
	}

	.card__date {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.card__arrow {
		flex-shrink: 0;
		color: $color-black;
	}

	.card__image {
		flex: none;
		width: 100%;
		height: 170px;
		background: $color-black;
		overflow: hidden;

		@include breakpoint-down($bp-sm) {
			height: auto;
			aspect-ratio: 4 / 3;
		}

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;
		}
	}

	.card__bottom {
		display: flex;
		flex-direction: column;
		gap: $space-2;
	}

	.card__badge {
		align-self: flex-start;
		padding: 4px 10px;
		background: $color-primary-green;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		border-radius: $radius-sm;
	}

	.card__title {
		color: $color-black;
		font-family: $font-family-serif;
		font-size: clamp(1.0625rem, 2.4vw, #{$font-size-2xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		font-style: italic;
	}

	.reveal-mask {
		display: block;
		overflow: hidden;
		height: 2.6em;
		line-height: 1.3em;
	}

	.reveal-wrapper {
		display: flex;
		flex-direction: column;
		will-change: transform;
	}

	.reveal-item {
		display: block;
		height: 2.6em;
		line-height: 1.3em;
		white-space: normal;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card__excerpt {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.7);
		max-width: 38ch;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}

		.grid-section {
			padding: $space-8 $space-5;
		}

		.card {
			padding: $space-5;
		}
	}
</style>
