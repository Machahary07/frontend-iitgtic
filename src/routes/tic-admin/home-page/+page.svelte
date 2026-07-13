<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { isTicAdminAuthed, logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import content from '$lib/data/content.json';

	const navItems = [
		{ label: 'Overview', href: '/tic-admin' },
		{ label: 'Companies', href: '/tic-admin/companies' },
		{ label: 'Posted jobs', href: '/tic-admin/jobs' },
		{ separator: true as const },
		{ label: 'Home page', href: '/tic-admin/home-page' }
	];

	let mounted = $state(false);

	let hero = $state({
		headlineLead: content.homeHero.intro.headlineLead,
		headlineEmphasis: content.homeHero.intro.headlineEmphasis,
		citation: content.homeHero.intro.citation,
		attribution: content.homeHero.intro.attribution,
		ctaLabel: content.homeHero.intro.ctaLabel,
		ctaHref: content.homeHero.intro.ctaHref
	});

	let association = $state({ eyebrow: content.homeHero.association.eyebrow });

	let logos = $state(
		content.homeHero.association.logos.map((l, i) => ({
			id: i,
			name: l.name,
			imageKey: l.image
		}))
	);

	let cta = $state({
		eyebrow: content.cta.apply.eyebrow,
		headlineLead: content.cta.apply.headlineLead,
		headlineEmphasis: content.cta.apply.headlineEmphasis,
		label: content.cta.apply.label,
		href: content.cta.apply.href
	});

	onMount(() => {
		if (!isTicAdminAuthed()) {
			goto('/tic-admin/login');
			return;
		}
		mounted = true;
	});

	function handleLogout() {
		logoutTicAdmin();
		goto('/tic-admin/login');
	}
</script>

<svelte:head>
	<title>TIC Admin · Home page</title>
</svelte:head>

{#if mounted}
	<AdminShell
		brand="TIC Team Admin"
		brandSub="Internal"
		{navItems}
		title="Home page"
		eyebrow="Content"
		user="TIC Team"
		onLogout={handleLogout}
	>
		<div class="banner">
			<p class="banner__title">Scaffold — not yet writing to Supabase</p>
			<p class="banner__body">
				Inputs are pre-filled from <code>content.json</code> and editable for preview only. Run the
				SQL in <code>home-page.md</code> at the project root in your Supabase SQL editor first; the
				next change wires save to Supabase.
			</p>
		</div>

		<section class="card">
			<header class="card__head">
				<h2>Hero intro</h2>
				<p class="card__sub">
					Top of the home page · maps to <code>home_hero</code>
				</p>
			</header>
			<div class="grid grid--2">
				<label class="field">
					<span class="field__label">Headline lead</span>
					<input class="field__input" type="text" bind:value={hero.headlineLead} />
				</label>
				<label class="field">
					<span class="field__label">Headline emphasis <em>(italic in render)</em></span>
					<input class="field__input" type="text" bind:value={hero.headlineEmphasis} />
				</label>
			</div>
			<label class="field">
				<span class="field__label">Citation paragraph</span>
				<textarea class="field__input field__input--area" rows="4" bind:value={hero.citation}></textarea>
			</label>
			<div class="grid grid--3">
				<label class="field">
					<span class="field__label">Attribution</span>
					<input class="field__input" type="text" bind:value={hero.attribution} />
				</label>
				<label class="field">
					<span class="field__label">CTA label</span>
					<input class="field__input" type="text" bind:value={hero.ctaLabel} />
				</label>
				<label class="field">
					<span class="field__label">CTA href</span>
					<input class="field__input" type="text" bind:value={hero.ctaHref} />
				</label>
			</div>
		</section>

		<section class="card">
			<header class="card__head">
				<h2>Association marquee</h2>
				<p class="card__sub">
					Logo row under the hero · maps to <code>home_association</code> + <code>home_association_logos</code>
				</p>
			</header>
			<label class="field">
				<span class="field__label">Eyebrow text</span>
				<input class="field__input" type="text" bind:value={association.eyebrow} />
			</label>

			<div class="logos">
				<div class="logos__head">
					<span>Logo</span>
					<span>Image key</span>
				</div>
				{#each logos as logo (logo.id)}
					<div class="logos__row">
						<input class="field__input" type="text" bind:value={logo.name} />
						<input class="field__input" type="text" bind:value={logo.imageKey} />
					</div>
				{/each}
				<p class="logos__note">
					Image keys reference <code>src/lib/data/images.ts</code>. Add / remove / reorder lands
					with Supabase wiring.
				</p>
			</div>
		</section>

		<section class="card">
			<header class="card__head">
				<h2>Apply CTA banner</h2>
				<p class="card__sub">
					Bottom of the home page · maps to <code>cta_blocks</code> where <code>key = 'apply'</code>
					· also reused on several other pages, so edits propagate site-wide
				</p>
			</header>
			<div class="grid grid--2">
				<label class="field">
					<span class="field__label">Eyebrow</span>
					<input class="field__input" type="text" bind:value={cta.eyebrow} />
				</label>
				<label class="field">
					<span class="field__label">Button label</span>
					<input class="field__input" type="text" bind:value={cta.label} />
				</label>
				<label class="field">
					<span class="field__label">Headline lead</span>
					<input class="field__input" type="text" bind:value={cta.headlineLead} />
				</label>
				<label class="field">
					<span class="field__label">Headline emphasis <em>(italic in render)</em></span>
					<input class="field__input" type="text" bind:value={cta.headlineEmphasis} />
				</label>
				<label class="field">
					<span class="field__label">Button href</span>
					<input class="field__input" type="text" bind:value={cta.href} />
				</label>
			</div>
		</section>

		<div class="actions">
			<button type="button" class="save" disabled title="Run home-page.md SQL first; save wiring lands next">
				Save (Supabase pending)
			</button>
		</div>
	</AdminShell>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;

	.banner {
		padding: 14px 18px;
		background: #fffaf0;
		border: 1px solid #f3e3b8;
		border-radius: 10px;
		margin-bottom: 20px;
		font-family: $font-family-base;

		code {
			background: rgba(0, 0, 0, 0.06);
			padding: 1px 5px;
			border-radius: 4px;
			font-size: 12px;
		}
	}

	.banner__title {
		margin: 0 0 4px;
		font-size: 12px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #8a6d1a;
	}

	.banner__body {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: #444;
	}

	.card {
		background: #fff;
		border: 1px solid #e6e8ec;
		border-radius: 10px;
		padding: 22px 24px;
		margin-bottom: 18px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		font-family: $font-family-base;
	}

	.card__head {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-bottom: 12px;
		border-bottom: 1px solid #eef0f3;

		h2 {
			margin: 0;
			font-size: 15px;
			font-weight: $font-weight-semibold;
			color: #111;
		}
	}

	.card__sub {
		margin: 0;
		font-size: 12px;
		color: #777;

		code {
			background: rgba(0, 0, 0, 0.05);
			padding: 1px 5px;
			border-radius: 4px;
			font-size: 11px;
		}
	}

	.grid {
		display: grid;
		gap: 14px;
	}

	.grid--2 {
		grid-template-columns: repeat(2, 1fr);
	}

	.grid--3 {
		grid-template-columns: repeat(3, 1fr);
	}

	@media (max-width: 720px) {
		.grid--2,
		.grid--3 {
			grid-template-columns: 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field__label {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #444;

		em {
			font-style: italic;
			font-weight: $font-weight-regular;
			color: #888;
		}
	}

	.field__input {
		padding: 9px 11px;
		font-size: 13px;
		font-family: inherit;
		color: #111;
		background: #fff;
		border: 1px solid #d8dbe0;
		border-radius: 6px;
		outline: none;

		&:focus {
			border-color: #111;
			box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
		}
	}

	.field__input--area {
		resize: vertical;
		min-height: 88px;
		line-height: 1.5;
	}

	.logos {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.logos__head {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #888;
	}

	.logos__row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.logos__note {
		margin: 4px 0 0;
		font-size: 12px;
		color: #888;

		code {
			background: rgba(0, 0, 0, 0.05);
			padding: 1px 5px;
			border-radius: 4px;
			font-size: 11px;
		}
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 6px;
	}

	.save {
		padding: 10px 18px;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		font-family: $font-family-base;
		color: #fff;
		background: #111;
		border: 0;
		border-radius: 6px;
		cursor: pointer;

		&:disabled {
			background: #aaa;
			cursor: not-allowed;
		}
	}
</style>
