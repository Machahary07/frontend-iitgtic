<script lang="ts">
	// Renders a legal/prose page (Privacy, Terms) from a content section:
	// a hero plus a list of sections, each with paragraphs and optional
	// bullets, a closing line, and a contact block. Editable at
	// /tic-admin/content → Pages.
	type ContactBlock = {
		org: string;
		addressLines: string[];
		email: string;
		phone: string;
	};
	type Section = {
		heading: string;
		paragraphs: string[];
		bullets?: string[];
		outro?: string;
		contact?: ContactBlock;
	};
	type LegalContent = {
		title: string;
		hero: { eyebrow: string; headlineLead: string; headlineEmphasis: string; lede: string };
		sections: Section[];
	};

	let { page }: { page: LegalContent } = $props();
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
		{#each page.sections as section (section.heading)}
			<section class="legal-section">
				<h2>{section.heading}</h2>
				{#each section.paragraphs as para, i (i)}
					<p>{para}</p>
				{/each}
				{#if section.bullets?.length}
					<ul>
						{#each section.bullets as item, i (i)}
							<li>{item}</li>
						{/each}
					</ul>
				{/if}
				{#if section.outro}
					<p>{section.outro}</p>
				{/if}
				{#if section.contact}
					<address class="legal-contact">
						<span class="legal-contact__org">{section.contact.org}</span>
						{#each section.contact.addressLines as line, i (i)}
							<span>{line}</span>
						{/each}
						<span>Email: {section.contact.email}</span>
						{#if section.contact.phone}
							<span>Phone: {section.contact.phone}</span>
						{/if}
					</address>
				{/if}
			</section>
		{/each}
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
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.body__inner {
		width: min(100%, $container-md);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-8;
	}

	.legal-section {
		display: flex;
		flex-direction: column;
		gap: $space-3;

		h2 {
			margin: 0 0 $space-1;
			font-family: $font-family-base;
			font-size: $font-size-lg;
			line-height: $line-height-snug;
			font-weight: $font-weight-bold;
			color: $color-black;
		}

		p {
			margin: 0;
			font-size: $font-size-base;
			line-height: $line-height-relaxed;
			color: rgba($color-black, 0.78);
			max-width: 68ch;
		}

		ul {
			margin: 0;
			padding-left: 1.2em;
			display: flex;
			flex-direction: column;
			gap: $space-2;
			max-width: 68ch;

			li {
				font-size: $font-size-base;
				line-height: $line-height-relaxed;
				color: rgba($color-black, 0.78);
			}
		}
	}

	.legal-contact {
		display: flex;
		flex-direction: column;
		gap: $space-1;
		margin-top: $space-2;
		font-style: normal;
		font-size: $font-size-base;
		line-height: $line-height-snug;
		color: rgba($color-black, 0.78);
	}

	.legal-contact__org {
		font-weight: $font-weight-semibold;
		color: $color-black;
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
	}
</style>
