<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import content from '$lib/data/content.json';
	import { images } from '$lib/data/images';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	type AssociationLogoKey = keyof typeof images.associationLogos;

	const page = content.pages.partners;
	const ctaContent = content.cta.apply;

	const partners = page.partners.map((p) => ({
		...p,
		src: images.associationLogos[p.image as AssociationLogoKey]
	}));

	let nameRefs: HTMLElement[] = $state([]);

	async function animate(idx: number, yPercent: number) {
		if (prefersReducedMotion()) return;
		const el = nameRefs[idx];
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

<section class="grid-section">
	<div class="grid-section__inner">
		<p class="grid-section__eyebrow">{page.sectionEyebrow}</p>
		<div class="grid">
			{#each partners as partner, i (partner.image)}
				<a
					class="tile"
					href={partner.href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`${partner.name} (opens in a new tab)`}
					onmouseenter={() => animate(i, -50)}
					onmouseleave={() => animate(i, 0)}
					onfocus={() => animate(i, -50)}
					onblur={() => animate(i, 0)}
				>
					<div class="tile__inner">
						<img src={partner.src} alt={partner.name} loading="lazy" decoding="async" />
					</div>
					<p class="tile__name">
						<span class="reveal-mask">
							<span class="reveal-wrapper" bind:this={nameRefs[i]}>
								<span class="reveal-item">{partner.name}</span>
								<span class="reveal-item" aria-hidden="true">{partner.name}</span>
							</span>
						</span>
					</p>
				</a>
			{/each}
		</div>
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
		@include serif-h1;
	}

	.hero__lede {
		@include hero-lede(640px);
	}

	.grid-section {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.grid-section__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-7;
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: $space-4;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		text-decoration: none;
		color: $color-black;
		cursor: pointer;
	}

	.tile__inner {
		aspect-ratio: 1 / 1;
		border: 1px solid $color-black;
		background: $color-white;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: $space-5;
	}

	.tile__inner img {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.tile__name {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: $color-black;
		text-align: center;
	}

	.reveal-mask {
		display: block;
		width: 100%;
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
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		height: 2.6em;
		white-space: normal;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}

		.grid-section {
			padding: $space-8 $space-5 $space-9;
		}

		.grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: $space-3;
		}

		.tile__inner {
			padding: $space-4;
		}
	}
</style>
