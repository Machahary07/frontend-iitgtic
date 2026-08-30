<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';
	import { getAllJobs, seedJobs, type AnyJob } from '$lib/utils/jobPostings';
	import { onMount } from 'svelte';

	const content = getContent();

	const page = content.pages.opportunities;
	const ctaContent = content.cta.apply;

	let allPosts = $state<AnyJob[]>(seedJobs());

	onMount(async () => {
		allPosts = await getAllJobs();
	});

	const types = $derived([
		'All',
		...Array.from(new Set(allPosts.map((p) => p.type.split(' ·')[0])))
	]);
	let activeType = $state<string>('All');
	let query = $state('');

	const visiblePosts = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return allPosts.filter((p) => {
			if (activeType !== 'All' && !p.type.startsWith(activeType)) return false;
			if (!q) return true;
			return (
				p.role.toLowerCase().includes(q) ||
				p.company.toLowerCase().includes(q) ||
				p.location.toLowerCase().includes(q) ||
				p.sector.toLowerCase().includes(q) ||
				p.type.toLowerCase().includes(q) ||
				p.description.toLowerCase().includes(q)
			);
		});
	});

	function formatPosted(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	let roleRefs: HTMLElement[] = $state([]);

	async function animate(idx: number, yPercent: number) {
		if (prefersReducedMotion()) return;
		const el = roleRefs[idx];
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
		<p>{page.hero.intro}</p>
	</div>
</section>

<section class="list-section">
	<div class="list-section__inner">
		<div class="list-section__head">
			<div class="list-section__title-row">
				<p class="list-section__eyebrow">{page.listEyebrow}</p>
				<span class="list-section__count">{visiblePosts.length}</span>
			</div>

			<div class="controls">
				<div class="filters" role="tablist" aria-label="Filter by role type">
					{#each types as type (type)}
						<button
							type="button"
							class="filter"
							class:is-active={activeType === type}
							role="tab"
							aria-selected={activeType === type}
							onclick={() => (activeType = type)}
						>
							{type}
						</button>
					{/each}
				</div>

				<div class="search">
					<svg
						class="search__icon"
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="7" />
						<path d="m20 20-3.5-3.5" />
					</svg>
					<input
						type="search"
						class="search__input"
						placeholder="Search by role, company, location, sector…"
						bind:value={query}
						aria-label="Search open roles"
					/>
					{#if query}
						<button
							type="button"
							class="search__clear"
							aria-label="Clear search"
							onclick={() => (query = '')}
						>
							×
						</button>
					{/if}
				</div>
			</div>
		</div>

		{#if visiblePosts.length === 0}
			<p class="empty">
				{#if query.trim() || activeType !== 'All'}
					No roles match your search. Try a different keyword or clear the filter.
				{:else}
					{page.emptyMessage}
				{/if}
			</p>
		{:else}
			<ul class="list">
				{#each visiblePosts as post, i (post.slug)}
					<li class="row">
						<a
							class="row__link"
							href={`/opportunities/${post.slug}`}
							onmouseenter={() => animate(i, -50)}
							onmouseleave={() => animate(i, 0)}
							onfocus={() => animate(i, -50)}
							onblur={() => animate(i, 0)}
						>
							<div class="row__top">
								<span class="row__type" class:row__type--intern={post.type.startsWith('Internship')}
									>{post.type}</span
								>
								<span class="row__date">{formatPosted(post.posted)}</span>
							</div>

							<div class="row__title">
								<span class="reveal-mask">
									<span class="reveal-wrapper" bind:this={roleRefs[i]}>
										<span class="reveal-item">{post.role}</span>
										<span class="reveal-item" aria-hidden="true">{post.role}</span>
									</span>
								</span>
							</div>

							<div class="row__meta">
								<span class="row__company">{post.company}</span>
								<span class="row__dot" aria-hidden="true">·</span>
								<span class="row__location">{post.location}</span>
								<span class="row__dot" aria-hidden="true">·</span>
								<span class="row__sector">{post.sector}</span>
							</div>

							<p class="row__description">{post.description}</p>

							<div class="row__cta">
								<span class="row__apply">View role</span>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
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
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

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

	.list-section {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.list-section__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-6;
	}

	.list-section__head {
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	.list-section__title-row {
		display: flex;
		align-items: baseline;
		gap: $space-3;
	}

	.list-section__eyebrow {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.list-section__count {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		color: rgba($color-black, 0.45);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: $space-3;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		width: min(100%, 320px);
		flex: 1 1 240px;
		max-width: 360px;
	}

	.search__icon {
		position: absolute;
		left: 12px;
		color: rgba($color-black, 0.5);
		pointer-events: none;
	}

	.search__input {
		width: 100%;
		padding: 9px 36px 9px 36px;
		font: inherit;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		color: $color-black;
		background: $color-white;
		border: 1px solid rgba($color-black, 0.3);
		border-radius: $radius-pill;
		appearance: none;

		&:focus {
			outline: none;
			border-color: $color-black;
		}

		&::placeholder {
			color: rgba($color-black, 0.45);
		}

		&::-webkit-search-decoration,
		&::-webkit-search-cancel-button {
			-webkit-appearance: none;
		}
	}

	.search__clear {
		position: absolute;
		right: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		font-size: 18px;
		line-height: 1;
		color: rgba($color-black, 0.6);
		background: transparent;
		border: 0;
		border-radius: 50%;
		cursor: pointer;

		&:hover {
			color: $color-black;
			background: rgba($color-black, 0.06);
		}
	}

	.filter {
		background: $color-white;
		color: $color-black;
		border: 1px solid rgba($color-black, 0.3);
		padding: $space-2 $space-4;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: $radius-pill;
		cursor: pointer;
		transition:
			background $transition-base,
			color $transition-base,
			border-color $transition-base;

		&.is-active {
			background: $color-black;
			color: $color-white;
			border-color: $color-black;
		}
	}

	.empty {
		margin: 0;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: $font-size-md;
		color: rgba($color-black, 0.7);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.row {
		border: 1px solid $color-black;
		background: $color-white;
	}

	.row__link {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		padding: $space-6;
		color: $color-black;
		text-decoration: none;

		@include breakpoint-down($bp-sm) {
			padding: $space-5;
		}
	}

	.row__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-3;
	}

	.row__type {
		align-self: flex-start;
		padding: 4px 10px;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		border-radius: $radius-sm;

		&--intern {
			background: $color-primary-green;
		}
	}

	.row__date {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.row__title {
		font-family: $font-family-serif;
		font-size: clamp(1.25rem, 3vw, #{$font-size-2xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		font-style: italic;
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
		height: 1.2em;
		white-space: nowrap;
	}

	.row__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: $space-2;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		color: rgba($color-black, 0.72);
	}

	.row__company {
		font-weight: $font-weight-semibold;
		color: $color-black;
	}

	.row__dot {
		color: rgba($color-black, 0.4);
	}

	.row__description {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.78);
		max-width: 64ch;
	}

	.row__cta {
		display: inline-flex;
		align-items: center;
		gap: $space-2;
		margin-top: $space-2;
		color: $color-black;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}

		.list-section {
			padding: $space-8 $space-5 $space-9;
		}

		.row__meta {
			font-size: $font-size-xs;
		}
	}
</style>
