<script lang="ts">
	import { getContent } from '$lib/content';

	// Editable at /tic-admin/content → Pages → Contact.
	const page = getContent().pages.contact;

	// The Google Maps embed loads Google's own cookies the moment it renders, which
	// would break our "only essential cookies" promise. So it stays a placeholder
	// until the visitor asks for it — no third-party call, and no cookie, on load.
	let mapLoaded = $state(false);
	const mapsLink =
		'https://www.google.com/maps/search/?api=1&query=Technology+Incubation+Centre+IITG-TIC+IIT+Guwahati';
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

<section class="body">
	<div class="body__inner">
		<div class="contact-details">
			<h2>{page.details.heading}</h2>
			<address>
				<span class="contact-org">{page.details.org}</span>
				{#each page.details.addressLines as line, i (i)}
					<span>{line}</span>
				{/each}
			</address>
			<dl>
				<div class="contact-row">
					<dt>Email</dt>
					<dd>{page.details.email}</dd>
				</div>
				<div class="contact-row">
					<dt>Phone</dt>
					<dd>{page.details.phone}</dd>
				</div>
			</dl>
		</div>

		<div class="contact-map">
			<h2>{page.map.heading}</h2>
			<div class="map-frame">
				{#if mapLoaded}
					<iframe
						src={page.map.embedUrl}
						title={page.map.title}
						loading="lazy"
						referrerpolicy="strict-origin-when-cross-origin"
						allowfullscreen
					></iframe>
				{:else}
					<button type="button" class="map-facade" onclick={() => (mapLoaded = true)}>
						<span class="map-facade__title">Load the interactive map</span>
						<span class="map-facade__note">
							The map is served by Google Maps, which may set its own cookies. It loads only
							when you choose to.
						</span>
					</button>
				{/if}
			</div>
			<p class="map-link">
				<a href={mapsLink} target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>
			</p>
		</div>
	</div>
</section>

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

	.body {
		background: $color-accent-blue;
		color: $color-white;
		padding: $space-9 $space-8 $space-10;
	}

	.body__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr);
		gap: $space-9;
		align-items: start;
	}

	h2 {
		margin: 0 0 $space-4;
		font-family: $font-family-base;
		font-size: $font-size-lg;
		line-height: $line-height-snug;
		font-weight: $font-weight-bold;
		color: $color-white;
	}

	.contact-details address {
		display: flex;
		flex-direction: column;
		gap: $space-1;
		font-style: normal;
		font-size: $font-size-base;
		line-height: $line-height-snug;
		color: rgba($color-white, 0.82);
	}

	.contact-org {
		font-weight: $font-weight-semibold;
		color: $color-white;
	}

	dl {
		margin: $space-6 0 0;
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	.contact-row {
		display: flex;
		flex-direction: column;
		gap: 2px;

		dt {
			font-family: $font-family-base;
			font-size: $font-size-xs;
			font-weight: $font-weight-semibold;
			letter-spacing: 0.14em;
			text-transform: uppercase;
			color: rgba($color-white, 0.62);
		}

		dd {
			margin: 0;
			font-size: $font-size-base;
			line-height: $line-height-snug;
			color: $color-white;
		}
	}

	.map-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		border: 1px solid rgba($color-white, 0.28);
		overflow: hidden;

		iframe {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			border: 0;
		}
	}

	.map-facade {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		gap: $space-2;
		padding: $space-5;
		text-align: left;
		background: rgba($color-white, 0.06);
		border: 0;
		color: $color-white;
		cursor: pointer;
	}

	.map-facade__title {
		font-size: $font-size-base;
		font-weight: $font-weight-semibold;
	}

	.map-facade__note {
		font-size: $font-size-sm;
		line-height: $line-height-snug;
		color: rgba($color-white, 0.82);
		max-width: 42ch;
	}

	.map-link {
		margin: $space-3 0 0;
		font-size: $font-size-sm;

		a {
			color: $color-white;
			text-decoration: underline;
			text-underline-offset: 2px;
		}
	}

	@include breakpoint-down($bp-md) {
		.body__inner {
			grid-template-columns: 1fr;
			gap: $space-8;
		}
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile;
		}

		.hero__lede {
			@include hero-lede-mobile;
		}

		.body {
			padding: $space-8 $space-5 $space-9;
		}

		.map-frame {
			aspect-ratio: 3 / 4;
		}
	}
</style>
