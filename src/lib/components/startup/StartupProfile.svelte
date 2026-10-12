<script lang="ts">
	import LayoutClassic from './LayoutClassic.svelte';
	import LayoutStory from './LayoutStory.svelte';
	import LayoutOnePager from './LayoutOnePager.svelte';
	import LayoutShowcase from './LayoutShowcase.svelte';
	import LayoutLab from './LayoutLab.svelte';
	import type { StartupProfileData } from '$lib/utils/startupProfile';

	// A startup's public page in the layout its founder chose.
	interface Props {
		startup: StartupProfileData;
		category: { slug: string; title: string };
	}
	let { startup, category }: Props = $props();
</script>

{#if startup.layout === 'story'}
	<LayoutStory {startup} {category} />
{:else if startup.layout === 'one-pager'}
	<LayoutOnePager {startup} {category} />
{:else if startup.layout === 'showcase'}
	<LayoutShowcase {startup} {category} />
{:else if startup.layout === 'lab'}
	<LayoutLab {startup} {category} />
{:else}
	<LayoutClassic {startup} {category} />
{/if}
