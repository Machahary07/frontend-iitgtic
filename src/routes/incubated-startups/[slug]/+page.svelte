<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import { getContent } from '$lib/content';
	import { loadGsap, prefersReducedMotion } from '$lib/utils/animation';
	import Globe from '@lucide/svelte/icons/globe';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import type { PageProps } from './$types';

	const content = getContent();

	let { data }: PageProps = $props();
	const category = $derived(data.category);
	const ctaContent = content.cta.apply;

	type SocialKey = 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'github' | 'youtube';
	const socialKeys: readonly SocialKey[] = [
		'linkedin',
		'twitter',
		'instagram',
		'facebook',
		'github',
		'youtube'
	];

	const regLabels: Record<string, string> = {
		cin: 'CIN',
		llpin: 'LLPIN',
		gstin: 'GSTIN',
		dpiit: 'DPIIT',
		udyam: 'Udyam',
		fssai: 'FSSAI',
		iec: 'IEC',
		dgca: 'DGCA'
	};

	function primaryRegistration(startup: any): { label: string; value: string } | null {
		if (!startup.registration) return null;
		const r = startup.registration;
		const order = ['cin', 'llpin', 'gstin', 'udyam', 'fssai', 'iec', 'dgca', 'dpiit'];
		for (const key of order) {
			if (r[key]) return { label: regLabels[key], value: r[key] };
		}
		return null;
	}

	function socialLinks(startup: any): Array<[SocialKey, string]> {
		if (!startup.socials) return [];
		return socialKeys
			.map((k) => [k, startup.socials[k]] as [SocialKey, string | undefined])
			.filter((entry): entry is [SocialKey, string] => Boolean(entry[1]));
	}

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
	<title>{category.title} · IITG TIC</title>
</svelte:head>

<section class="hero">
	<p class="hero__eyebrow">{category.hero.eyebrow}</p>
	<h1>
		{category.hero.headlineLead}
		<em>{category.hero.headlineEmphasis}</em>
	</h1>
	<div class="hero__lede">
		<p>{category.hero.lede}</p>
	</div>
</section>

<section class="list-section">
	<div class="list-section__inner">
		<div class="list-section__head">
			<p class="list-section__eyebrow">{category.listEyebrow}</p>
			<span class="list-section__count">{category.startups.length}</span>
		</div>

		<div class="grid">
			{#each category.startups as startup, i (startup.slug)}
				{@const reg = primaryRegistration(startup)}
				{@const socials = socialLinks(startup)}
				<article
					class="card"
					onmouseenter={() => animate(i, -50)}
					onmouseleave={() => animate(i, 0)}
					onfocusin={() => animate(i, -50)}
					onfocusout={() => animate(i, 0)}
				>
					<div class="card__logo" aria-label={startup.logo.alt}></div>
					<div class="card__body">
						<p class="card__sector">{startup.sector}</p>
						<h2 class="card__name">
							<a
								class="card__name-link"
								href={`/incubated-startups/${category.slug}/${startup.slug}`}
							>
								<span class="reveal-mask">
									<span class="reveal-wrapper" bind:this={nameRefs[i]}>
										<span class="reveal-item">{startup.name}</span>
										<span class="reveal-item" aria-hidden="true">{startup.name}</span>
									</span>
								</span>
							</a>
						</h2>
						<p class="card__tagline">{startup.tagline}</p>
						<p class="card__description">{startup.description}</p>

						{#if reg}
							<p class="card__reg">
								<span class="card__reg-label">{reg.label}</span>
								<span class="card__reg-value">{reg.value}</span>
							</p>
						{/if}

						{#if startup.website || socials.length}
							<ul class="card__links">
								{#if startup.website}
									<li>
										<a
											class="card__icon-link"
											href={startup.website}
											target="_blank"
											rel="noopener"
											aria-label={`${startup.name} website`}
											title="Website"
										>
											<Globe size={16} strokeWidth={1.75} />
										</a>
									</li>
								{/if}
								{#each socials as [key, url] (key)}
									<li>
										<a
											class="card__icon-link"
											href={url}
											target="_blank"
											rel="noopener"
											aria-label={`${startup.name} ${key}`}
											title={key.charAt(0).toUpperCase() + key.slice(1)}
										>
											<BrandIcon name={key} size={16} />
										</a>
									</li>
								{/each}
							</ul>
						{/if}

						<p class="card__more">
							<LinkReveal
								href={`/incubated-startups/${category.slug}/${startup.slug}`}
								text="View profile →"
							/>
						</p>
					</div>
				</article>
			{/each}
		</div>

		<footer class="back">
			<LinkReveal href="/incubated-startups" text="← Back to incubated startups" />
		</footer>
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

	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: $space-5;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
		}
	}

	.card {
		display: flex;
		gap: $space-5;
		padding: $space-6;
		background: $color-white;
		color: $color-black;
		border: 1px solid $color-black;
		overflow: hidden;
		align-items: flex-start;

		@include breakpoint-down($bp-sm) {
			flex-direction: column;
			gap: $space-4;
			padding: $space-5;
		}
	}

	.card__logo {
		flex: none;
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: $color-black;

		@include breakpoint-down($bp-sm) {
			width: 84px;
			height: 84px;
		}
	}

	.card__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: $space-2;
	}

	.card__sector {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.card__name {
		margin: 0;
		color: $color-black;
		font-family: $font-family-serif;
		font-size: clamp(1.25rem, 2.4vw, #{$font-size-2xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		font-style: italic;
	}

	.card__name-link {
		color: inherit;
		text-decoration: none;
	}

	.card__reg {
		margin: $space-2 0 0;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: $space-2;
		padding: 4px 10px;
		border: 1px solid rgba($color-black, 0.5);
		align-self: flex-start;
	}

	.card__reg-label {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.card__reg-value {
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: $font-size-xs;
		letter-spacing: 0.02em;
		color: $color-black;
	}

	.card__links {
		list-style: none;
		padding: 0;
		margin: $space-2 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
	}

	.card__icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 1px solid $color-black;
		color: $color-black;
		text-decoration: none;
	}

	.card__more {
		margin: $space-3 0 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: $color-black;
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

	.card__tagline {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: $color-black;
		font-style: italic;
	}

	.card__description {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: rgba($color-black, 0.7);
	}

	.back {
		margin-top: $space-4;
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
	}
</style>
