<script lang="ts">
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import Prose from './Prose.svelte';
	import { SOCIAL_KEYS, type StartupProfileData } from '$lib/utils/startupProfile';

	// Layout 3 of the public profile: an investor brief. A sticky fact card beside
	// a summary, the numbers up front, problem / solution / market / model, funding,
	// team and milestones. Prints to a page or two.

	interface Props {
		startup: StartupProfileData;
		category: { slug: string; title: string };
	}
	let { startup, category }: Props = $props();

	const facts = $derived(
		(
			[
				['Sector', startup.sector],
				['Stage', startup.stage],
				['Founded', startup.foundingYear],
				['HQ', startup.hqLocation],
				['Team', startup.teamSize],
				['Entity', startup.registration.type],
				['DPIIT', startup.registration.dpiit],
				['CIN', startup.registration.cin]
			] as [string, string][]
		).filter(([, v]) => v)
	);
	const boxes = $derived(
		(
			[
				['Problem', startup.problem],
				['Solution', startup.solution],
				['Market', [startup.targetMarket, startup.marketSize].filter(Boolean).join(' ')],
				['Model', startup.businessModel]
			] as [string, string][]
		).filter(([, v]) => v)
	);
	const socials = $derived(SOCIAL_KEYS.filter((k) => startup.socials[k]));
</script>

<div class="brief">
	<div class="page">
		<aside class="card">
			<div class="card__logo">
				{#if startup.logo.src}<img src={startup.logo.src} alt={startup.logo.alt || `${startup.name} logo`} />{:else}{startup.name.charAt(0)}{/if}
			</div>
			<h1>{startup.name}</h1>
			{#if startup.tagline}<p class="card__tag">{startup.tagline}</p>{/if}
			<div class="chips">
				<span class="chip">{category.title}</span>
				{#if startup.raising}<span class="chip chip--green">{startup.raising}</span>{/if}
				{#if startup.hiring.isHiring}<span class="chip">Hiring{startup.hiring.openRoles ? ` · ${startup.hiring.openRoles}` : ''}</span>{/if}
			</div>
			{#if facts.length}
				<dl>
					{#each facts as [k, v] (k)}
						<div><dt>{k}</dt><dd>{v}</dd></div>
					{/each}
				</dl>
			{/if}
			<div class="card__acts">
				{#if startup.contactEmail}
					<LinkReveal class="pill pill--solid" href={`mailto:${startup.contactEmail}`} text="Contact founders" />
				{/if}
				{#if startup.website}<LinkReveal class="pill" href={startup.website} text="Visit website" />{/if}
			</div>
			{#if socials.length}
				<div class="card__links">
					{#each socials as key (key)}
						<LinkReveal href={startup.socials[key]} text={key.charAt(0).toUpperCase() + key.slice(1)} />
					{/each}
				</div>
			{/if}
		</aside>

		<div class="main">
			{#if startup.summary || startup.oneLiner}
				<section class="panel">
					<p class="eyebrow">In one paragraph</p>
					<p class="summary">{startup.summary || startup.oneLiner}</p>
				</section>
			{/if}

			{#if startup.description}
				<section class="panel">
					<p class="eyebrow">About {startup.name}</p>
					<Prose class="long" text={startup.description} />
				</section>
			{/if}

			{#if startup.traction.length}
				<section class="kpis">
					{#each startup.traction as m (m.label)}
						<div>
							<strong>{m.value}</strong>
							<span>{m.label}</span>
							{#if m.note}<em>{m.note}</em>{/if}
						</div>
					{/each}
				</section>
			{/if}

			{#if boxes.length}
				<section class="panel boxes">
					{#each boxes as [k, v] (k)}
						<div>
							<h3>{k}</h3>
							<Prose text={v} />
						</div>
					{/each}
				</section>
			{/if}

			<div class="two">
				{#if startup.funding.raised || startup.funding.grants.length}
					<section class="panel">
						<p class="eyebrow">Funding</p>
						<h2>Raised to date</h2>
						{#if startup.funding.raised}<p class="lead">{startup.funding.raised}</p>{/if}
						{#if startup.funding.grants.length}
							<ul class="rows">
								{#each startup.funding.grants as g (g)}<li>{g}</li>{/each}
							</ul>
						{/if}
					</section>
				{/if}
				{#if startup.founders.length}
					<section class="panel">
						<p class="eyebrow">Team</p>
						<h2>Founders</h2>
						<ul class="team">
							{#each startup.founders as f, i (i)}
								<li>
									<span class="team__photo">
										{#if f.photo}<img src={f.photo} alt={f.name} />{:else}{f.name.charAt(0)}{/if}
									</span>
									<span>{f.name}<br /><small>{f.role}</small></span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>

			{#if startup.milestones.length}
				<section class="panel">
					<p class="eyebrow">Milestones</p>
					<h2>Track record and what is next</h2>
					<ol class="road">
						{#each startup.milestones as m, i (i)}
							<li class:next={m.upcoming}><b>{m.year}{m.upcoming ? ' · next' : ''}</b>{m.event}</li>
						{/each}
					</ol>
				</section>
			{/if}

			{#if startup.achievements.length || startup.mediaMentions.length}
				<section class="panel">
					<p class="eyebrow">Recognition</p>
					<ul class="rows">
						{#each startup.achievements as a (a)}<li>{a}</li>{/each}
						{#each startup.mediaMentions as m (m.title)}
							<li>
								{#if m.url}<LinkReveal href={m.url} text={m.title} />{:else}{m.title}{/if}
								{#if m.outlet}<small> · {m.outlet}</small>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<LinkReveal class="back" href={`/incubated-startups/${category.slug}`} text={`← Back to ${category.title.toLowerCase()}`} />
		</div>
	</div>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.brief {
		background: #ededE8;
		padding: calc(var(--page-shell-top, 104px) + 32px) 16px 72px;
		font-family: $font-family-base;
	}

	.page {
		display: grid;
		grid-template-columns: 340px 1fr;
		gap: 24px;
		align-items: start;
		width: min(1180px, 100%);
		margin: 0 auto;
	}

	h1,
	h2,
	h3 {
		font-family: $font-family-serif;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		margin: 0;
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

	.card {
		position: sticky;
		top: calc(var(--page-shell-top, 104px) + 16px);
		background: $color-white;
		border-radius: $radius-xl;
		padding: 28px;

		h1 {
			font-size: 2rem;
			margin: 18px 0 4px;
		}

		dl {
			margin: 18px 0 0;
			font-size: 13.5px;

			div {
				display: flex;
				justify-content: space-between;
				gap: 12px;
				padding: 9px 0;
				border-top: 1px solid rgba($color-black, 0.08);
			}

			dt {
				color: rgba($color-black, 0.6);
			}

			dd {
				margin: 0;
				text-align: right;
			}
		}
	}

	.card__logo {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		overflow: hidden;
		border-radius: $radius-lg;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 1.8rem;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.card__tag {
		margin: 0;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 1.05rem;
		color: rgba($color-black, 0.7);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 16px;
	}

	.chip {
		padding: 6px 12px;
		border: 1px solid rgba($color-black, 0.12);
		border-radius: $radius-pill;
		font-size: 12.5px;
		color: rgba($color-black, 0.7);
	}

	.chip--green {
		border-color: rgba($color-primary-green, 0.35);
		background: rgba($color-primary-green, 0.06);
		color: #00803a;
	}

	.card__acts {
		display: grid;
		gap: 8px;
		margin-top: 20px;
	}

	.card :global(.pill) {
		display: flex;
		justify-content: center;
		padding: 12px 20px;
		border: 1px solid $color-black;
		border-radius: $radius-pill;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $color-black;
		text-decoration: none;
	}

	.card :global(.pill--solid) {
		background: $color-black;
		color: $color-white;
	}

	.card__links {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin-top: 16px;
		font-size: 13px;
	}

	.main {
		display: grid;
		gap: 24px;
		min-width: 0;
	}

	.panel {
		background: $color-white;
		border-radius: $radius-xl;
		padding: 28px 32px;

		h2 {
			font-size: 1.5rem;
			margin: 10px 0 16px;
		}
	}

	.summary {
		margin: 14px 0 0;
		font-family: $font-family-serif;
		font-size: 1.2rem;
		line-height: 1.65;
	}

	.panel :global(.long) {
		margin: 14px 0 0;
		max-width: 76ch;
		font-family: $font-family-serif;
		font-size: 1.12rem;
		line-height: 1.85;
		color: rgba($color-black, 0.78);
	}

	.lead {
		margin: 0 0 12px;
		font-family: $font-family-serif;
		font-size: 1.1rem;
	}

	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		background: $color-white;
		border-radius: $radius-xl;
		overflow: hidden;

		div {
			padding: 22px 20px;
			border-right: 1px solid rgba($color-black, 0.08);
		}

		strong {
			display: block;
			font-family: $font-family-serif;
			font-weight: $font-weight-regular;
			font-size: 2.2rem;
			line-height: 1;
		}

		span {
			display: block;
			margin-top: 8px;
			font-size: 12.5px;
			color: rgba($color-black, 0.6);
		}

		em {
			display: block;
			margin-top: 6px;
			font-style: normal;
			font-size: 12px;
			font-weight: $font-weight-semibold;
			color: #00803a;
		}
	}

	.boxes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;

		h3 {
			margin-bottom: 8px;
			font-family: $font-family-base;
			font-size: 11px;
			font-weight: $font-weight-semibold;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			color: rgba($color-black, 0.6);
		}

		:global(p) {
			margin: 0;
			color: rgba($color-black, 0.7);
			line-height: 1.6;
		}
	}

	.two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
	}

	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14px;

		li {
			padding: 11px 0;
			border-top: 1px solid rgba($color-black, 0.08);
		}

		small {
			color: rgba($color-black, 0.6);
		}
	}

	.team {
		margin: 0;
		padding: 0;
		list-style: none;

		li {
			display: grid;
			grid-template-columns: 44px 1fr;
			gap: 14px;
			align-items: center;
			padding: 10px 0;
			border-top: 1px solid rgba($color-black, 0.08);
			font-size: 14px;
		}

		small {
			font-size: 13px;
			color: rgba($color-black, 0.6);
		}
	}

	.team__photo {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		overflow: hidden;
		border-radius: 50%;
		background: #eeede8;
		font-family: $font-family-serif;
		font-style: italic;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.road {
		position: relative;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		margin: 8px 0 0;
		padding: 0;
		list-style: none;

		&::before {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			top: 7px;
			height: 1px;
			background: rgba($color-black, 0.12);
		}

		li {
			position: relative;
			padding: 26px 14px 0 0;
			font-size: 13.5px;
			color: rgba($color-black, 0.7);

			&::before {
				content: '';
				position: absolute;
				top: 2px;
				left: 0;
				width: 11px;
				height: 11px;
				border-radius: 50%;
				background: $color-black;
			}

			&.next::before {
				background: $color-white;
				border: 2px solid $color-primary-green;
			}
		}

		b {
			display: block;
			margin-bottom: 4px;
			font-family: $font-family-serif;
			font-weight: $font-weight-medium;
			font-size: 1.05rem;
			color: $color-black;
		}
	}

	.main :global(.back) {
		font-size: 14px;
		color: rgba($color-black, 0.6);
	}

	@media (max-width: 960px) {
		.page {
			grid-template-columns: 1fr;
		}

		.card {
			position: static;
		}

		.panel {
			padding: 22px 20px;
		}

		.boxes {
			grid-template-columns: 1fr;
		}
	}
</style>
