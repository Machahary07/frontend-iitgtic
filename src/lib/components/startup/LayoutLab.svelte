<script lang="ts">
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import Prose from './Prose.svelte';
	import type { StartupProfileData } from '$lib/utils/startupProfile';

	// Layout 5 of the public profile: technology first. A dark gridded header with
	// the readiness level, a long write-up, how it works, the specification table,
	// patents, the stack, research partners, publications and the SDGs.

	interface Props {
		startup: StartupProfileData;
		category: { slug: string; title: string };
	}
	let { startup, category }: Props = $props();

	const TRL_TEXT: Record<string, string> = {
		'1': 'Basic principles observed',
		'2': 'Technology concept formulated',
		'3': 'Experimental proof of concept',
		'4': 'Validated in the lab',
		'5': 'Validated in a relevant environment',
		'6': 'Demonstrated in a relevant environment',
		'7': 'Prototype demonstrated in operation',
		'8': 'System complete and qualified',
		'9': 'Proven in operation'
	};
	const trl = $derived(Number(startup.trl) || 0);
	const partners = $derived([...startup.partnerships, ...startup.supportedBy]);
	const SDG_COLOURS = ['#e5243b', '#dda63a', '#4c9f38', '#c5192d', '#ff3a21', '#26bde2', '#fcc30b', '#a21942', '#fd6925', '#dd1367', '#fd9d24', '#bf8b2e', '#3f7e44', '#0a97d9', '#56c02b', '#00689d', '#19486a'];
	// "SDG 2 · Zero hunger" → its colour; anything unnumbered gets the brand green.
	function sdgColour(label: string) {
		const n = Number(label.match(/\d+/)?.[0]);
		return SDG_COLOURS[n - 1] ?? '#00b451';
	}
	const mail = (subject: string) =>
		`mailto:${startup.contactEmail}?subject=${encodeURIComponent(`${subject} — ${startup.name}`)}`;
</script>

<div class="lab">
	<header class="top">
		<div class="wrap top__grid">
			<div>
				<p class="eyebrow eyebrow--light">{category.title}{startup.sector ? ` · ${startup.sector}` : ''}</p>
				<h1>{startup.name}</h1>
				{#if startup.tagline}<p class="top__tag">{startup.tagline}</p>{/if}
				<div class="chips">
					{#if startup.industry}<span class="chip">{startup.industry}</span>{/if}
					{#if startup.stage}<span class="chip">{startup.stage}</span>{/if}
					{#if startup.ipPatents.length}<span class="chip chip--green">{startup.ipPatents.length} patent{startup.ipPatents.length === 1 ? '' : 's'} / IP</span>{/if}
				</div>
				{#if trl}
					<div class="trl">
						<p class="eyebrow eyebrow--light">Technology readiness</p>
						<div class="trl__bar">{#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as level (level)}<i class:on={level <= trl}></i>{/each}</div>
						<small>TRL {trl} · {TRL_TEXT[startup.trl]}</small>
					</div>
				{/if}
			</div>
			<div class="top__media">
				{#if startup.cover.src}
					<img src={startup.cover.src} alt={startup.cover.alt || ''} />
				{:else if startup.logo.src}
					<img class="top__logo" src={startup.logo.src} alt={startup.logo.alt || `${startup.name} logo`} />
				{/if}
			</div>
		</div>
	</header>

	<main class="wrap">
		{#if startup.description}
			<section class="long">
				<p class="eyebrow">About {startup.name}</p>
				{#if startup.oneLiner}<h2>{startup.oneLiner}</h2>{/if}
				<Prose class="long__p" text={startup.description} />
			</section>
		{/if}

		{#if startup.problem || startup.solution}
			<section class="split">
				{#if startup.problem}
					<div><p class="eyebrow">The problem</p><Prose class="body" text={startup.problem} /></div>
				{/if}
				{#if startup.solution}
					<div><p class="eyebrow">How it works</p><Prose class="body" text={startup.solution} /></div>
				{/if}
			</section>
		{/if}

		{#if startup.specs.length}
			<section>
				<p class="eyebrow">Specification</p>
				<h2>Key figures</h2>
				<table class="spec">
					<tbody>
						{#each startup.specs as s (s.label)}<tr><td>{s.label}</td><td>{s.value}</td></tr>{/each}
					</tbody>
				</table>
			</section>
		{/if}

		{#if startup.ipPatents.length}
			<section>
				<p class="eyebrow">Intellectual property</p>
				<h2>Patents and designs</h2>
				<div class="ip">{#each startup.ipPatents as ip (ip)}<article>{ip}</article>{/each}</div>
			</section>
		{/if}

		{#if startup.techStack.length}
			<section>
				<p class="eyebrow">Tech stack</p>
				<div class="chips chips--dark">{#each startup.techStack as t (t)}<span class="chip">{t}</span>{/each}</div>
			</section>
		{/if}

		{#if partners.length}
			<section>
				<p class="eyebrow">Research partners and support</p>
				<div class="wall">{#each partners as p (p)}<div>{p}</div>{/each}</div>
			</section>
		{/if}

		{#if startup.mediaMentions.length || startup.achievements.length}
			<section>
				<p class="eyebrow">Publications, press and recognition</p>
				<ul class="pubs">
					{#each startup.mediaMentions as m (m.title)}
						<li>
							{#if m.url}<LinkReveal href={m.url} text={m.title} />{:else}<span>{m.title}</span>{/if}
							<small>{m.outlet}</small>
						</li>
					{/each}
					{#each startup.achievements as a (a)}<li><span>{a}</span><small>Award</small></li>{/each}
				</ul>
			</section>
		{/if}

		{#if startup.sdgAlignment.length || startup.impactCreated}
			<section>
				<p class="eyebrow">Impact</p>
				{#if startup.impactCreated}<Prose class="body" text={startup.impactCreated} />{/if}
				{#if startup.sdgAlignment.length}
					<div class="sdg">
						{#each startup.sdgAlignment as g (g)}<div style:background={sdgColour(g)}>{g}</div>{/each}
					</div>
				{/if}
			</section>
		{/if}

		{#if startup.founders.length}
			<section>
				<p class="eyebrow">Team</p>
				<h2>Researchers and founders</h2>
				<div class="team">
					{#each startup.founders as f, i (i)}
						<article>
							<div class="team__photo">{#if f.photo}<img src={f.photo} alt={f.name} />{:else}{f.name.charAt(0)}{/if}</div>
							<div>
								<h3>{f.name}</h3>
								<p class="team__role">{f.role}</p>
								{#if f.bio}<p class="team__bio">{f.bio}</p>{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<section class="end">
			<h2>Collaborate with the team.</h2>
			<div class="end__acts">
				{#if startup.contactEmail}
					<LinkReveal class="pill pill--solid" href={mail('Research collaboration')} text="Research collaboration" />
					<LinkReveal class="pill" href={mail('Licensing enquiry')} text="Licensing enquiry" />
				{/if}
				{#if startup.website}<LinkReveal class="pill" href={startup.website} text="Visit website" />{/if}
			</div>
		</section>
		<LinkReveal class="back" href={`/incubated-startups/${category.slug}`} text={`← Back to ${category.title.toLowerCase()}`} />
	</main>
</div>

<style lang="scss">
	@use '$styles/variables' as *;

	.lab {
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

	h2 {
		font-size: 2rem;
		margin-bottom: 22px;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 12px;
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

	.top {
		color: $color-white;
		padding: calc(var(--page-shell-top, 104px) + 64px) 0 64px;
		background:
			linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px) 0 0 / 40px 40px,
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) 0 0 / 40px 40px,
			$color-brand-charcoal;

		h1 {
			margin: 16px 0 12px;
			font-size: clamp(2.4rem, 6vw, 3.8rem);
			line-height: 1.05;
		}
	}

	.top__grid {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 56px;
		align-items: center;
	}

	.top__tag {
		margin: 0;
		max-width: 44ch;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: 1.2rem;
		line-height: 1.5;
		color: rgba($color-white, 0.78);
	}

	.top__media img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: $radius-lg;
	}

	.top__media .top__logo {
		width: 60%;
		margin: 0 auto;
		background: $color-white;
		border-radius: 50%;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 20px;
	}

	.chip {
		padding: 6px 12px;
		border: 1px solid rgba($color-white, 0.2);
		border-radius: $radius-pill;
		font-size: 12.5px;
		color: rgba($color-white, 0.82);
	}

	.chip--green {
		border-color: rgba($color-primary-green, 0.5);
		background: rgba($color-primary-green, 0.1);
		color: #5fe39a;
	}

	.chips--dark .chip {
		border-color: rgba($color-black, 0.12);
		color: rgba($color-black, 0.75);
	}

	.trl {
		margin-top: 28px;

		small {
			display: block;
			margin-top: 8px;
			font-size: 12px;
			color: rgba($color-white, 0.6);
		}
	}

	.trl__bar {
		display: grid;
		grid-template-columns: repeat(9, 1fr);
		gap: 4px;
		max-width: 420px;

		i {
			height: 8px;
			border-radius: 2px;
			background: rgba($color-white, 0.14);
		}

		i.on {
			background: $color-primary-green;
		}
	}

	section {
		padding-top: 72px;
	}

	.long {
		max-width: 76ch;

		h2 {
			font-size: clamp(1.7rem, 3.4vw, 2.4rem);
			line-height: 1.2;
		}

		:global(.long__p) {
			margin: 0 0 1.1em;
			font-family: $font-family-serif;
			font-size: 1.16rem;
			line-height: 1.85;
			color: rgba($color-black, 0.78);
		}
	}

	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 48px;
	}

	.lab :global(.body) {
		margin: 0 0 1em;
		max-width: 70ch;
		font-family: $font-family-serif;
		font-size: 1.08rem;
		line-height: 1.8;
		color: rgba($color-black, 0.75);
	}

	.spec {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;

		td {
			padding: 13px 0;
			border-top: 1px solid rgba($color-black, 0.08);
			vertical-align: top;
		}

		td:first-child {
			width: 34%;
			color: rgba($color-black, 0.6);
		}

		td:last-child {
			font-family: ui-monospace, Menlo, monospace;
			font-size: 13px;
		}
	}

	.ip {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 12px;

		article {
			padding: 20px;
			border: 1px solid rgba($color-black, 0.08);
			border-radius: $radius-md;
			font-family: $font-family-serif;
			font-size: 1.05rem;
			line-height: 1.4;
		}
	}

	.wall {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;

		div {
			display: grid;
			place-items: center;
			min-height: 90px;
			padding: 12px;
			text-align: center;
			border-radius: $radius-md;
			background: #f4f4f1;
			font-size: 13.5px;
			font-weight: $font-weight-semibold;
			color: rgba($color-black, 0.7);
		}
	}

	.pubs {
		margin: 0;
		padding: 0;
		list-style: none;

		li {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-between;
			gap: 6px 16px;
			padding: 14px 0;
			border-top: 1px solid rgba($color-black, 0.08);
			font-size: 14.5px;
		}

		small {
			font-size: 12px;
			color: rgba($color-black, 0.6);
		}
	}

	.sdg {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 12px;

		div {
			width: 140px;
			padding: 14px;
			border-radius: $radius-md;
			color: $color-white;
			font-size: 12.5px;
			font-weight: $font-weight-semibold;
			line-height: 1.35;
		}
	}

	.team {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;

		article {
			display: grid;
			grid-template-columns: 64px 1fr;
			gap: 14px;
			padding: 18px;
			border: 1px solid rgba($color-black, 0.08);
			border-radius: $radius-md;
		}

		h3 {
			font-size: 1.15rem;
		}
	}

	.team__photo {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
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

	.team__role {
		margin: 2px 0 0;
		font-size: 13px;
		color: rgba($color-black, 0.6);
	}

	.team__bio {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.65;
		color: rgba($color-black, 0.75);
	}

	.end {
		margin-top: 80px;
		padding: 48px 0 0;
		border-top: 2px solid $color-black;
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		justify-content: space-between;
		align-items: center;

		h2 {
			margin: 0;
		}
	}

	.end__acts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.lab :global(.pill) {
		display: inline-flex;
		padding: 12px 20px;
		border: 1px solid $color-black;
		border-radius: $radius-pill;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $color-black;
		text-decoration: none;
	}

	.lab :global(.pill--solid) {
		background: $color-black;
		color: $color-white;
	}

	.lab :global(.back) {
		display: inline-block;
		margin-top: 28px;
		font-size: 14px;
		color: rgba($color-black, 0.6);
	}

	@media (max-width: 860px) {
		.top__grid,
		.split {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}
</style>
