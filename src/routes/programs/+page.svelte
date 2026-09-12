<script lang="ts">
	import CallToAction from '$lib/components/CallToAction.svelte';
	import LinkGrid from '$lib/components/LinkGrid.svelte';
	import { getContent } from '$lib/content';

	const content = getContent();

	const page = content.pages.programs;
	const ctaContent = content.cta.apply;
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

<LinkGrid eyebrow={page.gridEyebrow} links={page.links} />

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
		@include hero-lede;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}
	}
</style>
