<script lang="ts">
	import { HomeHeroSlider, HomeIntroHero, CallToAction, EventCalendar } from '$lib';
	import content from '$lib/data/content.json';

	const cta = content.cta.apply;
</script>

<HomeIntroHero />
<HomeHeroSlider />
<EventCalendar />
<CallToAction
	eyebrow={cta.eyebrow}
	headlineLead={cta.headlineLead}
	headlineEmphasis={cta.headlineEmphasis}
	label={cta.label}
	href={cta.href}
/>
