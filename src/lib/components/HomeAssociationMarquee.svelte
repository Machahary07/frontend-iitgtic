<script lang="ts">
	import { onMount } from 'svelte';
	import content from '$lib/data/content.json';
	import { images } from '$lib/data/images';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';

	type AssociationLogoKey = keyof typeof images.associationLogos;

	const association = content.homeHero.association;
	const logos = association.logos.map((logo) => ({
		...logo,
		src: images.associationLogos[logo.image as AssociationLogoKey]
	}));
	const logoGroups = [logos, logos];

	let trackEl: HTMLDivElement;

	onMount(() => {
		let cleanup: (() => void) | undefined;

		(async () => {
			const { gsap } = await loadGsap();

			if (prefersReducedMotion()) {
				gsap.set(trackEl, { xPercent: 0 });
				return;
			}

			const tween = gsap.to(trackEl, {
				xPercent: -50,
				duration: 24,
				ease: 'none',
				repeat: -1
			});

			cleanup = () => tween.kill();
		})();

		return () => cleanup?.();
	});
</script>

<div class="association-marquee" aria-label={association.eyebrow}>
	<p>{association.eyebrow}</p>

	<div class="marquee-window">
		<div class="marquee-track" bind:this={trackEl}>
			{#each logoGroups as group, groupIndex (groupIndex)}
				<div class="logo-group" aria-hidden={groupIndex > 0}>
					{#each group as logo (logo.image)}
						<div class="logo-item">
							<img src={logo.src} alt={logo.name} loading="lazy" decoding="async" />
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.association-marquee {
		width: min(920px, 100%);
		display: grid;
		gap: $space-4;
		justify-items: center;
		color: #1a1a1a;
	}

	p {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		line-height: 1;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgba(26, 26, 26, 0.56);
	}

	.marquee-window {
		width: 100%;
		overflow: hidden;
		mask-image: linear-gradient(90deg, transparent, $color-black 12%, $color-black 88%, transparent);
	}

	.marquee-track {
		display: flex;
		width: max-content;
		will-change: transform;
	}

	.logo-group {
		display: flex;
		align-items: center;
		gap: clamp(0.25rem, 0.8vw, 0.75rem);
		padding-right: clamp(0.25rem, 0.8vw, 0.75rem);
	}

	.logo-item {
		width: clamp(96px, 12vw, 140px);
		height: 72px;
		display: grid;
		place-items: center;
		flex: 0 0 auto;
	}

	img {
		max-width: 100%;
		max-height: 58px;
		width: auto;
		height: auto;
		object-fit: contain;
		mix-blend-mode: multiply;
		filter: grayscale(1) contrast(1.05);
		opacity: 0.84;
	}

	@media (max-width: $bp-sm) {
		.association-marquee {
			gap: $space-3;
		}

		.logo-group {
			gap: $space-2;
			padding-right: $space-2;
		}

		.logo-item {
			width: 88px;
			height: 58px;
		}

		img {
			max-height: 46px;
		}
	}
</style>
