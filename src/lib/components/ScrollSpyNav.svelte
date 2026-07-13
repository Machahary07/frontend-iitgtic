<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import ButtonReveal from './ButtonReveal.svelte';

	interface Section {
		id: string;
		label: string;
	}

	interface Props {
		sections: Section[];
		eyebrow?: string;
		offset?: number;
	}

	let { sections, eyebrow = 'On this page', offset = 140 }: Props = $props();

	let active = $state('');
	let observer: IntersectionObserver | undefined;

	function go(id: string) {
		const el = document.getElementById(id);
		if (!el) return;
		const top = el.getBoundingClientRect().top + window.scrollY - offset;
		window.scrollTo({ top, behavior: 'smooth' });
	}

	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;

		active = sections[0]?.id ?? '';

		observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				if (visible[0]) active = visible[0].target.id;
			},
			{
				rootMargin: `-${offset}px 0px -55% 0px`,
				threshold: [0, 0.25, 0.5, 0.75, 1]
			}
		);

		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}
	});

	onDestroy(() => observer?.disconnect());
</script>

<aside class="scrollspy" aria-label={eyebrow}>
	<p class="scrollspy__eyebrow">{eyebrow}</p>
	<ul class="scrollspy__list">
		{#each sections as section (section.id)}
			<li class="scrollspy__item" class:is-active={active === section.id}>
				<span class="scrollspy__bar" aria-hidden="true"></span>
				<ButtonReveal
					text={section.label}
					class="scrollspy__btn"
					onclick={() => go(section.id)}
				/>
			</li>
		{/each}
	</ul>
</aside>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.scrollspy {
		position: sticky;
		top: calc(var(--page-shell-top, 104px) + #{$space-5});
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	.scrollspy__eyebrow {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.scrollspy__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: $space-3;
		border-left: 1px solid rgba($color-black, 0.12);
	}

	.scrollspy__item {
		position: relative;
		display: flex;
		align-items: center;
		gap: $space-3;
		padding: $space-1 0 $space-1 $space-4;
	}

	.scrollspy__bar {
		position: absolute;
		left: -1px;
		top: 50%;
		width: 2px;
		height: 18px;
		background: $color-black;
		transform: translateY(-50%) scaleY(0);
		transform-origin: center;
		transition: transform $transition-base;
	}

	.scrollspy__item.is-active .scrollspy__bar {
		transform: translateY(-50%) scaleY(1);
	}

	:global(.scrollspy__btn) {
		font-family: $font-family-serif;
		font-size: $font-size-md;
		font-weight: $font-weight-regular;
		color: $color-black;
		line-height: 1.2;
	}

	.scrollspy__item.is-active :global(.scrollspy__btn) {
		font-weight: $font-weight-semibold;
	}

	@include breakpoint-down($bp-md) {
		.scrollspy {
			display: none;
		}
	}
</style>
