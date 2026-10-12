<script lang="ts">
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import Prose from './Prose.svelte';
	import type { StartupProfileData } from '$lib/utils/startupProfile';

	// Layout 4 of the public profile: product first. A full-width cover photo with
	// the name card over it, a long "about" read, features with pictures, a photo
	// gallery, the numbers on a dark band and large team portraits.

	interface Props {
		startup: StartupProfileData;
		category: { slug: string; title: string };
	}
	let { startup, category }: Props = $props();

	// Features borrow the first gallery photos; the rest fill the gallery.
	const featurePhotos = $derived(startup.gallery.slice(0, startup.features.length));
	const galleryRest = $derived(startup.gallery.slice(startup.features.length));
	const quote = $derived(startup.testimonials[0] ?? null);
	const chips = $derived(
		[startup.stage, startup.hqLocation, startup.foundingYear && `Founded ${startup.foundingYear}`].filter(
			Boolean
		) as string[]
	);
</script>

<div class="show">
	<header class="cover">
		<div class="cover__image">
			{#if startup.cover.src}<img src={startup.cover.src} alt={startup.cover.alt || ''} />{/if}
		</div>
		<div class="card">
			<div class="card__logo">
				{#if startup.logo.src}<img src={startup.logo.src} alt={startup.logo.alt || `${startup.name} logo`} />{:else}{startup.name.charAt(0)}{/if}
			</div>
			<div class="card__text">
				<p class="eyebrow">{category.title}{startup.sector ? ` · ${startup.sector}` : ''}</p>
				<h1>{startup.name}</h1>
				{#if startup.tagline}<p class="card__tag">{startup.tagline}</p>{/if}
				{#if chips.length}
					<div class="chips">{#each chips as c (c)}<span class="chip">{c}</span>{/each}</div>
				{/if}
			</div>
			<div class="card__acts">
				{#if startup.contactEmail}<LinkReveal class="pill pill--solid" href={`mailto:${startup.contactEmail}`} text="Get in touch" />{/if}
				{#if startup.website}<LinkReveal class="pill" href={startup.website} text="Visit website" />{/if}
			</div>
		</div>
	</header>

	<main class="wrap">
		{#if startup.description || startup.oneLiner}
			<section class="about">
				<p class="eyebrow">About {startup.name}</p>
				{#if startup.oneLiner}<h2>{startup.oneLiner}</h2>{/if}
				{#if startup.description}<Prose class="long" text={startup.description} />{/if}
			</section>
		{/if}

		{#if startup.problem || startup.solution}
			<section class="split">
				{#if startup.problem}
					<div><p class="eyebrow">The problem</p><Prose class="body" text={startup.problem} /></div>
				{/if}
				{#if startup.solution}
					<div><p class="eyebrow">What we built</p><Prose class="body" text={startup.solution} /></div>
				{/if}
			</section>
		{/if}

		{#if startup.features.length}
			<section class="features">
				<p class="eyebrow">The product</p>
				{#each startup.features as feature, i (i)}
					<div class="feat" class:feat--flip={i % 2 === 1} class:feat--text={!featurePhotos[i]}>
						{#if featurePhotos[i]}<div class="feat__img"><img src={featurePhotos[i]} alt="" /></div>{/if}
						<div>
							<span class="feat__n">{String(i + 1).padStart(2, '0')}</span>
							<h3>{feature}</h3>
						</div>
					</div>
				{/each}
			</section>
		{/if}

		{#if galleryRest.length}
			<section class="gallery">
				<p class="eyebrow">In the field</p>
				<div class="gallery__grid">
					{#each galleryRest as src, i (i)}<div class="gallery__item"><img {src} alt="" /></div>{/each}
				</div>
			</section>
		{/if}

		{#if startup.targetMarket || startup.businessModel}
			<section class="split">
				{#if startup.targetMarket}
					<div><p class="eyebrow">Who it is for</p><Prose class="body" text={startup.targetMarket} /></div>
				{/if}
				{#if startup.businessModel}
					<div><p class="eyebrow">How it pays</p><Prose class="body" text={startup.businessModel} /></div>
				{/if}
			</section>
		{/if}
	</main>

	{#if startup.traction.length}
		<section class="band">
			<div class="wrap">
				<p class="eyebrow eyebrow--light">Numbers</p>
				<div class="band__grid">
					{#each startup.traction as m (m.label)}
						<div><strong>{m.value}</strong><span>{m.label}</span></div>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<main class="wrap">
		{#if startup.founders.length}
			<section class="team">
				<p class="eyebrow">Team</p>
				<div class="team__grid">
					{#each startup.founders as f, i (i)}
						<div>
							<div class="team__photo">{#if f.photo}<img src={f.photo} alt={f.name} />{:else}<span>{f.name.charAt(0)}</span>{/if}</div>
							<h3>{f.name}</h3>
							<p class="team__role">{f.role}</p>
							{#if f.bio}<p class="team__bio">{f.bio}</p>{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if quote}
			<section class="quote">
				<blockquote>“{quote.quote}”</blockquote>
				<p>{[quote.author, quote.role].filter(Boolean).join(', ')}</p>
			</section>
		{/if}

		<section class="end">
			<h2>Work with {startup.name}.</h2>
			<div class="end__acts">
				{#if startup.contactEmail}<LinkReveal class="pill pill--solid" href={`mailto:${startup.contactEmail}`} text="Contact founders" />{/if}
				{#if startup.website}<LinkReveal class="pill" href={startup.website} text="Visit website" />{/if}
				{#if startup.hiring.isHiring}
					<LinkReveal class="pill" href="/opportunities/startup-jobs" text={`Join the team${startup.hiring.openRoles ? ` · ${startup.hiring.openRoles} open` : ''}`} />
				{/if}
			</div>
		</section>
		<LinkReveal class="back" href={`/incubated-startups/${category.slug}`} text={`← Back to ${category.title.toLowerCase()}`} />
	</main>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.show {
		padding-top: var(--page-shell-top, 104px);
		padding-bottom: 72px;
		font-family: $font-family-base;
	}

	h1,
	h2,
	h3 {
		margin: 0;
		font-family: $font-family-serif;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 14px;
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

	.eyebrow--light {
		color: rgba($color-white, 0.6);
	}

	.wrap {
		width: min(1180px, 100% - 32px);
		margin: 0 auto;
		display: block;
	}

	.cover__image {
		height: min(62vh, 600px);
		background: linear-gradient(135deg, #12261a, #2b2829);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.card {
		position: relative;
		width: min(1180px, 100% - 32px);
		margin: -110px auto 0;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 24px;
		align-items: end;
		padding: 28px 32px;
		background: $color-white;
		border-radius: $radius-xl;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.08);

		h1 {
			font-size: clamp(2.2rem, 5vw, 3.2rem);
			line-height: 1.05;
		}
	}

	.card__logo {
		display: grid;
		place-items: center;
		width: 104px;
		height: 104px;
		overflow: hidden;
		border-radius: 50%;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 2.4rem;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			background: $color-white;
		}
	}

	.card__tag {
		margin: 6px 0 0;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 1.15rem;
		color: rgba($color-black, 0.7);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}

	.chip {
		padding: 6px 12px;
		border: 1px solid rgba($color-black, 0.12);
		border-radius: $radius-pill;
		font-size: 12.5px;
		color: rgba($color-black, 0.7);
	}

	.card__acts,
	.end__acts {
		display: grid;
		gap: 8px;
	}

	.end__acts {
		display: flex;
		flex-wrap: wrap;
	}

	.show :global(.pill) {
		display: inline-flex;
		justify-content: center;
		padding: 12px 20px;
		border: 1px solid $color-black;
		border-radius: $radius-pill;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $color-black;
		text-decoration: none;
	}

	.show :global(.pill--solid) {
		background: $color-black;
		color: $color-white;
	}

	section {
		padding-top: 80px;
	}

	// The long read: the widest, most comfortable text on the page.
	.about {
		max-width: 76ch;

		h2 {
			font-size: clamp(1.8rem, 3.8vw, 2.6rem);
			line-height: 1.15;
			margin-bottom: 22px;
		}

		:global(.long) {
			margin: 0 0 1.1em;
			font-family: $font-family-serif;
			font-size: 1.18rem;
			line-height: 1.85;
			color: rgba($color-black, 0.78);
		}
	}

	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 48px;

		:global(.body) {
			margin: 0 0 1em;
			font-family: $font-family-serif;
			font-size: 1.08rem;
			line-height: 1.8;
			color: rgba($color-black, 0.75);
		}
	}

	.feat {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 48px;
		align-items: center;
		padding: 40px 0;
		border-top: 1px solid rgba($color-black, 0.08);

		h3 {
			margin-top: 10px;
			font-size: clamp(1.4rem, 2.6vw, 1.9rem);
			line-height: 1.25;
		}
	}

	.feat--flip .feat__img {
		order: 2;
	}

	.feat--text {
		grid-template-columns: 1fr;
		padding: 24px 0;
	}

	.feat__img {
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: $radius-lg;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.feat__n {
		font-family: $font-family-serif;
		font-size: 3rem;
		line-height: 1;
		color: $color-primary-green;
	}

	.gallery__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 12px;
	}

	.gallery__item {
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: $radius-lg;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.band {
		margin-top: 96px;
		padding: 72px 0;
		background: $color-brand-charcoal;
		color: $color-white;
	}

	.band__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 32px;

		strong {
			display: block;
			font-family: $font-family-serif;
			font-weight: 300;
			font-size: clamp(2.4rem, 5vw, 3.2rem);
			line-height: 1;
		}

		span {
			display: block;
			margin-top: 8px;
			font-size: 13.5px;
			color: rgba($color-white, 0.65);
		}
	}

	.team__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 24px;

		h3 {
			font-size: 1.3rem;
		}
	}

	.team__photo {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 5;
		margin-bottom: 14px;
		overflow: hidden;
		border-radius: $radius-lg;
		background: #eeede8;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 3rem;
		color: rgba($color-black, 0.3);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.team__role {
		margin: 4px 0 0;
		font-size: 13.5px;
		color: rgba($color-black, 0.6);
	}

	.team__bio {
		margin: 10px 0 0;
		font-size: 14.5px;
		line-height: 1.7;
		color: rgba($color-black, 0.75);
	}

	.quote {
		text-align: center;

		blockquote {
			margin: 0 auto 14px;
			max-width: 28ch;
			font-family: $font-family-serif;
			font-style: italic;
			font-size: clamp(1.6rem, 3.6vw, 2.4rem);
			line-height: 1.3;
		}

		p {
			margin: 0;
			font-size: 14px;
			color: rgba($color-black, 0.6);
		}
	}

	.end {
		margin-top: 80px;
		padding: 48px;
		border-radius: $radius-xl;
		background: #ededE8;
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: center;
		justify-content: space-between;

		h2 {
			font-size: 2rem;
		}
	}

	.show :global(.back) {
		display: inline-block;
		margin-top: 28px;
		font-size: 14px;
		color: rgba($color-black, 0.6);
	}

	@media (max-width: 860px) {
		.card {
			grid-template-columns: 1fr;
			padding: 24px 20px;
		}

		.card__logo {
			margin-top: -76px;
			border: 6px solid $color-white;
		}

		.split,
		.feat {
			grid-template-columns: 1fr;
			gap: 20px;
		}

		.feat--flip .feat__img {
			order: 0;
		}

		.end {
			padding: 28px 20px;
		}
	}
</style>
