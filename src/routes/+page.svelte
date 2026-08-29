<script lang="ts">
	import { HomeHeroSlider, HomeIntroHero, CallToAction, EventCalendar } from '$lib';
	import { getContent } from '$lib/content';

	const content = getContent();

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
