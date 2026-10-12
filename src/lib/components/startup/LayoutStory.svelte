<script lang="ts">
	import { onMount } from 'svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import { prefersReducedMotion } from '$lib/utils/animation';
	import Prose from './Prose.svelte';
	import type { StartupProfileData } from '$lib/utils/startupProfile';

	// Layout 2 of the public profile: the startup's milestones as stops on a road
	// that draws itself as the visitor scrolls. Parallax hero, a large year behind
	// the road that changes at each stop, numbers that count up, a testimonial that
	// slides sideways, and a dashed stretch for the stops still ahead.

	interface Props {
		startup: StartupProfileData;
		category: { slug: string; title: string };
	}
	let { startup, category }: Props = $props();

	const stops = $derived(startup.milestones);
	const story = $derived(
		[
			['What they built', startup.founderStory.whatTheyBuilt],
			['What TIC contributed', startup.founderStory.whatTicContributed],
			['Where they are now', startup.founderStory.whereTheyAreNow]
		].filter(([, body]) => body)
	);
	const quote = $derived(startup.testimonials[0] ?? null);

	// "₹42L" → ₹ · 42 · L, so only the number counts up and the rest stays put.
	function splitNumber(value: string) {
		const m = value.match(/^(\D*)([\d,]*\.?\d+)(.*)$/);
		if (!m) return null;
		return { prefix: m[1], number: Number(m[2].replace(/,/g, '')), decimals: (m[2].split('.')[1] ?? '').length, suffix: m[3], grouped: m[2].includes(',') };
	}

	let root: HTMLElement;
	let road: HTMLElement | undefined = $state();
	let year = $state('');
	let yearShown = $state(true);

	onMount(() => {
		const reduce = prefersReducedMotion();
		const svg = road?.querySelector('svg');
		const drawn = svg?.querySelector<SVGPathElement>('.drawn');
		const track = svg?.querySelector<SVGPathElement>('.track');
		const ahead = svg?.querySelector<SVGPathElement>('.ahead');
		const car = svg?.querySelector<SVGCircleElement>('.car');
		const ring = svg?.querySelector<SVGCircleElement>('.ring');
		const stopEls = road ? [...road.querySelectorAll<HTMLElement>('.stop')] : [];
		let length = 0;
		year = stops[0]?.year ?? '';
		// The year the page is fading to, so one change is not queued every frame.
		let wanted = year;

		// The road winds between the stops' dots, staying inside the middle column
		// so it never runs under a photo. Straight down the side on a phone.
		function buildPath() {
			if (!road || !drawn || !track || !ahead || stopEls.length === 0) return;
			const box = road.getBoundingClientRect();
			const pts = stopEls.map((s) => {
				const r = s.querySelector('.dot')!.getBoundingClientRect();
				return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
			});
			const swing = innerWidth > 860 ? 70 : 0;
			let past = `M ${pts[0].x} 0 L ${pts[0].x} ${pts[0].y}`;
			let next = '';
			for (let i = 1; i < pts.length; i++) {
				const a = pts[i - 1];
				const b = pts[i];
				const dir = i % 2 ? 1 : -1;
				const mid = (a.y + b.y) / 2;
				const seg = ` C ${a.x + swing * dir} ${a.y + (mid - a.y) * 0.6}, ${b.x + swing * dir} ${b.y - (b.y - mid) * 0.6}, ${b.x} ${b.y}`;
				if (stops[i]?.upcoming) next += (next ? '' : ` M ${a.x} ${a.y}`) + seg;
				else past += seg;
			}
			const last = pts[pts.length - 1];
			next += `${next ? '' : ` M ${last.x} ${last.y}`} L ${last.x} ${box.height}`;
			track.setAttribute('d', past + next);
			drawn.setAttribute('d', past);
			ahead.setAttribute('d', next);
			length = drawn.getTotalLength();
			drawn.style.strokeDasharray = `${length} ${length}`;
			drawn.style.strokeDashoffset = reduce ? '0' : String(length);
		}

		function onScroll() {
			if (reduce || !root) return;
			const vh = innerHeight;
			root.querySelectorAll<HTMLElement>('[data-speed]').forEach((el) => {
				const r = (el.parentElement ?? el).getBoundingClientRect();
				el.style.transform = `translateY(${(r.top + r.height / 2 - vh / 2) * -parseFloat(el.dataset.speed!)}px)`;
			});
			const copy = root.querySelector<HTMLElement>('.hero__copy');
			if (copy) {
				const y = Math.max(0, -root.getBoundingClientRect().top);
				copy.style.transform = `translateY(${y * -0.15}px)`;
				copy.style.opacity = String(Math.max(0, 1 - y / (vh * 0.7)));
			}
			root.querySelectorAll<HTMLElement>('[data-slide]').forEach((el) => {
				const r = el.parentElement!.getBoundingClientRect();
				el.style.transform = `translateX(${(r.top - vh) * parseFloat(el.dataset.slide!)}px)`;
			});

			if (!road || !drawn || !car || !ring || stopEls.length === 0) return;
			// The road only runs downwards, so the point level with the reading line
			// is found by bisecting along it.
			const lineY = vh * 0.55 - road.getBoundingClientRect().top;
			let lo = 0;
			let hi = length;
			for (let k = 0; k < 22; k++) {
				const m = (lo + hi) / 2;
				if (drawn.getPointAtLength(m).y < lineY) lo = m;
				else hi = m;
			}
			drawn.style.strokeDashoffset = String(length - lo);
			const pt = drawn.getPointAtLength(lo);
			for (const c of [car, ring]) {
				c.setAttribute('cx', String(pt.x));
				c.setAttribute('cy', String(pt.y));
			}
			let active = 0;
			stopEls.forEach((s, i) => {
				if (s.querySelector('.dot')!.getBoundingClientRect().top < vh * 0.55) active = i;
			});
			stopEls.forEach((s, i) => {
				s.classList.toggle('is-active', i === active);
				s.classList.toggle('is-passed', i < active);
			});
			const next = stops[active]?.year ?? '';
			if (next !== wanted) {
				wanted = next;
				yearShown = false;
				setTimeout(() => {
					year = wanted;
					yearShown = true;
				}, 180);
			}
		}

		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					e.target.classList.add('is-in');
					e.target.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
						const parts = splitNumber(n.dataset.count!);
						if (!parts || reduce) return;
						const t0 = performance.now();
						const tick = (t: number) => {
							const k = Math.min(1, (t - t0) / 1400);
							const v = parts.number * (1 - Math.pow(1 - k, 3));
							const shown = parts.grouped
								? Math.round(v).toLocaleString('en-IN')
								: v.toFixed(parts.decimals);
							n.textContent = `${parts.prefix}${shown}${parts.suffix}`;
							if (k < 1) requestAnimationFrame(tick);
							else n.textContent = n.dataset.count!;
						};
						requestAnimationFrame(tick);
					});
					io.unobserve(e.target);
				}
			},
			{ threshold: 0.25 }
		);
		root?.querySelectorAll('.reveal').forEach((el) => (reduce ? el.classList.add('is-in') : io.observe(el)));

		let ticking = false;
		const scroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				onScroll();
				ticking = false;
			});
		};
		const resize = () => {
			buildPath();
			onScroll();
		};
		addEventListener('scroll', scroll, { passive: true });
		addEventListener('resize', resize);
		document.fonts?.ready.then(resize);
		resize();
		return () => {
			removeEventListener('scroll', scroll);
			removeEventListener('resize', resize);
			io.disconnect();
		};
	});
</script>

<div class="story" bind:this={root}>
	<header class="hero">
		{#if startup.cover.src}
			<div class="hero__layer" data-speed="0.25">
				<img src={startup.cover.src} alt={startup.cover.alt || ''} />
			</div>
		{/if}
		<div class="hero__shade"></div>
		<svg class="hero__hills" viewBox="0 0 1440 400" preserveAspectRatio="none" aria-hidden="true">
			<path d="M0 260 C 180 200 320 230 480 190 S 820 120 980 170 S 1280 220 1440 160 V400 H0Z" fill="#163a24" />
			<path d="M0 320 C 200 270 360 300 560 260 S 900 230 1100 270 S 1340 300 1440 280 V400 H0Z" fill="#0f2a1a" />
		</svg>
		<div class="hero__copy">
			<p class="hero__eyebrow">{category.title} · {startup.sector}</p>
			<h1>{startup.headline || startup.tagline || startup.name}</h1>
			{#if startup.oneLiner}<p class="hero__dek">{startup.oneLiner}</p>{/if}
			<div class="hero__who">
				<span class="hero__logo">
					{#if startup.logo.src}<img src={startup.logo.src} alt={startup.logo.alt || `${startup.name} logo`} />{:else}{startup.name.charAt(0)}{/if}
				</span>
				<span><strong>{startup.name}</strong><br />{[startup.hqLocation, startup.foundingYear && `since ${startup.foundingYear}`].filter(Boolean).join(' · ')}</span>
			</div>
		</div>
		<p class="hero__cue">Scroll the road<i></i></p>
	</header>

	{#if startup.description}
		<section class="about reveal">
			<p class="eyebrow">About {startup.name}</p>
			<Prose class="about__p" text={startup.description} />
		</section>
	{/if}

	{#if stops.length}
		<section class="road-sec">
			<div class="year-wrap" aria-hidden="true">
				<span class="year" class:is-hidden={!yearShown}>{year}</span>
			</div>
			<div class="road-intro">
				<p class="eyebrow">The road so far</p>
				<h2>{startup.name}, stop by stop.</h2>
			</div>
			<div class="road" bind:this={road}>
				<svg aria-hidden="true">
					<path class="track" />
					<path class="drawn" />
					<path class="ahead" />
					<circle class="ring" r="14" />
					<circle class="car" r="7" />
				</svg>
				{#each stops as stop, i (i)}
					<article class="stop reveal" class:stop--next={stop.upcoming} class:stop--flip={i % 2 === 1}>
						<div class="stop__text">
							<p class="stop__when">
								{stop.year}{#if stop.upcoming}<span class="stop__tag">Next</span>{/if}
							</p>
							<h3>{stop.event}</h3>
							{#if stop.text}<p>{stop.text}</p>{/if}
						</div>
						<span class="dot"></span>
						{#if stop.photo}
							<figure class="stop__media">
								<div class="frame"><img src={stop.photo} alt="" data-speed="0.12" /></div>
							</figure>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}

	{#if startup.traction.length}
		<section class="numbers reveal">
			<p class="eyebrow">Along the way</p>
			<div class="numbers__grid">
				{#each startup.traction as metric (metric.label)}
					<div>
						<strong data-count={metric.value}>{metric.value}</strong>
						<span>{metric.label}</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if story.length}
		<section class="chapters">
			{#each story as [title, body] (title)}
				<div class="chapter reveal">
					<p class="eyebrow">{title}</p>
					<Prose class="chapter__body" text={body} />
				</div>
			{/each}
		</section>
	{/if}

	{#if quote}
		<section class="slide" aria-label="Testimonial">
			<p class="slide__line" data-slide="-0.35">“{quote.quote}”</p>
			<p class="slide__line slide__line--ghost" data-slide="0.25" aria-hidden="true">
				{Array(6).fill(startup.name).join(' · ')}
			</p>
			<p class="slide__cite">{[quote.author, quote.role].filter(Boolean).join(', ')}</p>
		</section>
	{/if}

	{#if startup.founders.length}
		<section class="team">
			<p class="eyebrow">The people</p>
			<h2>Who walked the road.</h2>
			<div class="team__grid">
				{#each startup.founders as person, i (i)}
					<div class="person reveal" style:transition-delay={`${(i % 3) * 0.12}s`}>
						<div class="person__photo">
							{#if person.photo}<img src={person.photo} alt={person.name} />{:else}<span>{person.name.charAt(0)}</span>{/if}
						</div>
						<h3>{person.name}</h3>
						<p>{person.role}</p>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="close">
		<p class="close__line">Join them on the next stretch.</p>
		<div class="close__acts">
			{#if startup.contactEmail}
				<LinkReveal class="pill pill--solid" href={`mailto:${startup.contactEmail}`} text="Contact founders" />
			{/if}
			{#if startup.website}<LinkReveal class="pill" href={startup.website} text="Visit website" />{/if}
			{#if startup.hiring.isHiring}
				<LinkReveal
					class="pill"
					href="/opportunities/startup-jobs"
					text={`Join the team${startup.hiring.openRoles ? ` · ${startup.hiring.openRoles} open` : ''}`}
				/>
			{/if}
		</div>
		<LinkReveal class="back" href={`/incubated-startups/${category.slug}`} text={`← Back to ${category.title.toLowerCase()}`} />
	</section>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.story {
		background: #fbfaf7;
		font-family: $font-family-base;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba($color-black, 0.6);

		&::before {
			content: '';
			width: 18px;
			height: 1px;
			background: currentColor;
		}
	}

	h1,
	h2,
	h3 {
		font-family: $font-family-serif;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		margin: 0;
	}

	// ---- hero ----
	.hero {
		position: relative;
		min-height: 100svh;
		overflow: hidden;
		display: grid;
		place-items: center;
		text-align: center;
		color: $color-white;
		padding: calc(var(--page-shell-top, 104px) + 24px) 16px 96px;
		background: radial-gradient(120% 80% at 50% 110%, #0d3d22 0%, #12261a 45%, #0b0f0c 100%);
	}

	.hero__layer {
		position: absolute;
		inset: -12% 0;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.hero__shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.65));
	}

	.hero__hills {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		width: 100%;
		height: 40%;
	}

	.hero__copy {
		position: relative;
		z-index: 2;
	}

	.hero__eyebrow {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba($color-white, 0.65);
	}

	.hero h1 {
		margin: 22px auto 18px;
		max-width: 16ch;
		font-size: clamp(2.6rem, 7.5vw, 5.2rem);
		line-height: 1.02;
		text-wrap: balance;
	}

	.hero__dek {
		margin: 0 auto;
		max-width: 46ch;
		font-family: $font-family-serif;
		font-size: 1.2rem;
		line-height: 1.6;
		color: rgba($color-white, 0.75);
	}

	.hero__who {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		margin-top: 32px;
		font-size: 13.5px;
		text-align: left;
		color: rgba($color-white, 0.7);

		strong {
			color: $color-white;
			font-weight: $font-weight-semibold;
		}
	}

	.hero__logo {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		overflow: hidden;
		background: $color-white;
		color: $color-black;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 1.2rem;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.hero__cue {
		position: absolute;
		bottom: 28px;
		left: 50%;
		z-index: 2;
		transform: translateX(-50%);
		margin: 0;
		display: grid;
		justify-items: center;
		gap: 10px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba($color-white, 0.6);

		i {
			width: 1px;
			height: 38px;
			background: linear-gradient(rgba($color-white, 0.7), transparent);
			transform-origin: top;
			animation: drip 1.8s ease-in-out infinite;
		}
	}

	@keyframes drip {
		0% {
			transform: scaleY(0);
		}
		50% {
			transform: scaleY(1);
		}
		100% {
			transform: scaleY(1);
			opacity: 0;
		}
	}

	// ---- the long read ----
	.about {
		width: min(760px, 100% - 32px);
		margin: 0 auto;
		padding: 110px 0 0;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.8s,
			transform 0.8s;

		&:global(.is-in) {
			opacity: 1;
			transform: none;
		}

		:global(.about__p) {
			margin: 18px 0 0;
			font-family: $font-family-serif;
			font-size: 1.2rem;
			line-height: 1.9;
			color: rgba($color-black, 0.8);
		}
	}

	// ---- road ----
	.road-sec {
		position: relative;
		padding: 120px 0 80px;
		// clip, not hidden: the year stays sticky but cannot spill past the section.
		overflow: clip;
	}

	.year-wrap {
		position: sticky;
		top: 0;
		height: 100vh;
		margin-bottom: -100vh;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.year {
		font-family: $font-family-serif;
		font-weight: 300;
		font-size: clamp(9rem, 30vw, 24rem);
		line-height: 1;
		letter-spacing: -0.06em;
		color: rgba($color-black, 0.045);
		transition: opacity 0.3s;

		&.is-hidden {
			opacity: 0;
		}
	}

	.road-intro {
		text-align: center;
		margin-bottom: 40px;
		padding: 0 16px;

		h2 {
			margin-top: 12px;
			font-size: clamp(2rem, 4.5vw, 3rem);
		}
	}

	.road {
		position: relative;
		width: min(1100px, 100% - 32px);
		margin: 0 auto;

		svg {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			overflow: visible;
			pointer-events: none;
		}

		.track {
			fill: none;
			stroke: rgba($color-black, 0.1);
			stroke-width: 2;
		}

		.drawn {
			fill: none;
			stroke: $color-primary-green;
			stroke-width: 3;
			stroke-linecap: round;
		}

		.ahead {
			fill: none;
			stroke: $color-primary-green;
			stroke-width: 2;
			stroke-dasharray: 2 10;
			stroke-linecap: round;
			opacity: 0.6;
		}

		.car {
			fill: $color-primary-green;
		}

		.ring {
			fill: none;
			stroke: $color-primary-green;
			stroke-width: 2;
			opacity: 0.35;
		}
	}

	.stop {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 200px 1fr;
		align-items: center;
		min-height: 64vh;
		padding: 40px 0;

		.dot {
			grid-column: 2;
			grid-row: 1;
			justify-self: center;
			position: relative;
			z-index: 2;
			width: 18px;
			height: 18px;
			border-radius: 50%;
			background: #fbfaf7;
			border: 3px solid rgba($color-black, 0.18);
			transition:
				border-color 0.4s,
				transform 0.4s;
		}

		&:global(.is-active) .dot,
		&:global(.is-passed) .dot {
			border-color: $color-primary-green;
		}

		&:global(.is-active) .dot {
			transform: scale(1.35);
		}
	}

	.stop__text,
	.stop__media {
		grid-row: 1;
		opacity: 0;
		transition:
			opacity 0.8s,
			transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.stop__text {
		grid-column: 1;
		padding-right: 12px;
		transform: translateX(-40px);

		h3 {
			margin: 12px 0 14px;
			font-size: clamp(1.7rem, 3.2vw, 2.4rem);
			line-height: 1.12;
		}

		p:not(.stop__when) {
			margin: 0;
			max-width: 44ch;
			font-family: $font-family-serif;
			font-size: 1.08rem;
			line-height: 1.75;
			color: rgba($color-black, 0.7);
		}
	}

	.stop__media {
		grid-column: 3;
		margin: 0;
		transform: translateX(40px);
	}

	.stop--flip {
		.stop__text {
			grid-column: 3;
			padding: 0 0 0 12px;
			transform: translateX(40px);
		}

		.stop__media {
			grid-column: 1;
			transform: translateX(-40px);
		}
	}

	.stop:global(.is-in) .stop__text,
	.stop:global(.is-in) .stop__media {
		opacity: 1;
		transform: none;
	}

	.stop__when {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: $color-primary-green;
	}

	.stop__tag {
		padding: 4px 8px;
		border: 1px dashed $color-primary-green;
		border-radius: $radius-pill;
		font-size: 10px;
	}

	.stop--next {
		.dot {
			border-style: dashed;
			border-color: $color-primary-green;
		}

		h3 {
			color: rgba($color-black, 0.6);
		}
	}

	.frame {
		position: relative;
		overflow: hidden;
		border-radius: $radius-xl;
		aspect-ratio: 4 / 3;
		background: #eeede8;

		img {
			position: absolute;
			left: 0;
			width: 100%;
			top: -18%;
			height: 136%;
			object-fit: cover;
		}
	}

	// ---- numbers, chapters ----
	.numbers,
	.chapters,
	.team,
	.close {
		width: min(1100px, 100% - 32px);
		margin: 0 auto;
	}

	.numbers {
		padding: 40px 0 80px;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.8s,
			transform 0.8s;

		&:global(.is-in) {
			opacity: 1;
			transform: none;
		}
	}

	.numbers__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 24px;
		margin-top: 24px;

		strong {
			display: block;
			font-family: $font-family-serif;
			font-weight: $font-weight-regular;
			font-size: clamp(2.4rem, 5vw, 3.4rem);
			line-height: 1;
		}

		span {
			display: block;
			margin-top: 8px;
			font-size: 13px;
			color: rgba($color-black, 0.6);
		}
	}

	.chapters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 32px;
		padding: 40px 0 96px;
	}

	.chapter {
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.8s,
			transform 0.8s;

		&:global(.is-in) {
			opacity: 1;
			transform: none;
		}
	}

	.chapter :global(.chapter__body) {
		margin: 14px 0 0;
		font-family: $font-family-serif;
		font-size: 1.05rem;
		line-height: 1.75;
		color: rgba($color-black, 0.75);
	}

	// ---- sliding quote ----
	.slide {
		overflow: hidden;
		padding: 110px 0;
		background: $color-brand-charcoal;
		color: $color-white;
	}

	.slide__line {
		margin: 0;
		white-space: nowrap;
		font-family: $font-family-serif;
		font-style: italic;
		font-weight: 300;
		font-size: clamp(2.6rem, 8vw, 6.5rem);
		line-height: 1.15;
	}

	.slide__line--ghost {
		color: rgba($color-white, 0.25);
	}

	.slide__cite {
		width: min(1100px, 100% - 32px);
		margin: 28px auto 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: rgba($color-white, 0.6);
	}

	// ---- team, close ----
	.team {
		padding: 110px 0 20px;

		h2 {
			margin: 12px 0 36px;
			font-size: clamp(2rem, 4.5vw, 3rem);
		}
	}

	.team__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 20px;
	}

	.person {
		opacity: 0;
		transform: translateY(40px);
		transition:
			opacity 0.8s,
			transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);

		&:global(.is-in) {
			opacity: 1;
			transform: none;
		}

		h3 {
			font-size: 1.35rem;
		}

		p {
			margin: 4px 0 0;
			font-size: 13.5px;
			color: rgba($color-black, 0.6);
		}
	}

	.person__photo {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 5;
		margin-bottom: 14px;
		overflow: hidden;
		border-radius: $radius-lg;
		background: #eeede8;
		font-family: $font-family-serif;
		font-size: 3rem;
		font-style: italic;
		color: rgba($color-black, 0.3);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.close {
		margin-top: 72px;
		padding: 48px 0 72px;
		border-top: 1px solid rgba($color-black, 0.12);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}

	.close__line {
		margin: 0;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: clamp(1.4rem, 3vw, 2rem);
	}

	.close__acts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.close :global(.pill) {
		display: inline-flex;
		padding: 12px 20px;
		border: 1px solid $color-black;
		border-radius: $radius-pill;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $color-black;
		text-decoration: none;
	}

	.close :global(.pill--solid) {
		background: $color-black;
		color: $color-white;
	}

	.close :global(.back) {
		flex-basis: 100%;
		font-size: 14px;
		color: rgba($color-black, 0.6);
	}

	@media (max-width: 860px) {
		.stop,
		.stop--flip {
			grid-template-columns: 44px 1fr;
			min-height: 0;
			padding: 36px 0;
			row-gap: 18px;

			.dot {
				grid-column: 1;
				grid-row: 1;
				align-self: start;
				margin-top: 4px;
			}

			.stop__text {
				grid-column: 2;
				grid-row: 1;
				padding: 0;
				transform: translateY(30px);
			}

			.stop__media {
				grid-column: 2;
				grid-row: 2;
				transform: translateY(30px);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stop__text,
		.stop__media,
		.about,
		.numbers,
		.chapter,
		.person {
			opacity: 1;
			transform: none;
			transition: none;
		}

		.hero__cue i {
			animation: none;
		}
	}
</style>
