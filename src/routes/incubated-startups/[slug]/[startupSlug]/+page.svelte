<script lang="ts">
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import ScrollSpyNav from '$lib/components/ScrollSpyNav.svelte';
	import Globe from '@lucide/svelte/icons/globe';
	import Mail from '@lucide/svelte/icons/mail';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Layers from '@lucide/svelte/icons/layers';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import Users from '@lucide/svelte/icons/users';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Target from '@lucide/svelte/icons/target';
	import LineChart from '@lucide/svelte/icons/line-chart';
	import Wallet from '@lucide/svelte/icons/wallet';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Handshake from '@lucide/svelte/icons/handshake';
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import Award from '@lucide/svelte/icons/award';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Cpu from '@lucide/svelte/icons/cpu';
	import Quote from '@lucide/svelte/icons/quote';
	import Milestone from '@lucide/svelte/icons/milestone';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Leaf from '@lucide/svelte/icons/leaf';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import User from '@lucide/svelte/icons/user';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const category = $derived(data.category);
	const startup = $derived(data.startup as any);

	type SocialKey = 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'github' | 'youtube';
	const socialKeys: readonly SocialKey[] = [
		'linkedin',
		'twitter',
		'instagram',
		'facebook',
		'github',
		'youtube'
	];

	const socialEntries = $derived(
		(startup.socials
			? socialKeys
					.map((k) => [k, startup.socials[k]] as [SocialKey, string | undefined])
					.filter((entry): entry is [SocialKey, string] => Boolean(entry[1]))
			: []) as Array<[SocialKey, string]>
	);

	const regEntries = $derived(
		startup.registration
			? Object.entries(startup.registration).filter(([k, v]) => v && k !== 'type')
			: []
	);

	const regLabels: Record<string, string> = {
		cin: 'CIN',
		llpin: 'LLPIN',
		gstin: 'GSTIN',
		dpiit: 'DPIIT Reg.',
		udyam: 'Udyam Reg.',
		fssai: 'FSSAI Lic.',
		iec: 'IEC Code',
		dgca: 'DGCA Reg.',
		incorporatedOn: 'Incorporated'
	};

	const hasProblemSolution = $derived(Boolean(startup.problem || startup.solution));
	const hasFeatures = $derived(Boolean(startup.features?.length));
	const hasMarket = $derived(Boolean(startup.targetMarket));
	const hasTraction = $derived(Boolean(startup.traction?.length));
	const hasTeam = $derived(
		Boolean(startup.founders?.length || startup.incubation?.mentors?.length)
	);
	const hasFunding = $derived(
		Boolean(startup.funding?.raised || startup.funding?.grants?.length)
	);
	const hasRecognition = $derived(
		Boolean(startup.achievements?.length || startup.mediaMentions?.length)
	);
	const hasPartners = $derived(Boolean(startup.partnerships?.length));
	const hasTech = $derived(Boolean(startup.techStack?.length));
	const hasImpact = $derived(
		Boolean(
			startup.supportedBy?.length ||
				startup.graduateOutcome ||
				startup.impactCreated ||
				startup.ipPatents?.length ||
				startup.sdgAlignment?.length
		)
	);
	const hasVoices = $derived(Boolean(startup.testimonials?.length));
	const hasTimeline = $derived(Boolean(startup.milestones?.length));

	const spySections = $derived(
		(
			[
				['overview', 'Overview', true],
				['problem-solution', 'Problem & Solution', hasProblemSolution],
				['features', 'Key features', hasFeatures],
				['market', 'Target market', hasMarket],
				['traction', 'Traction', hasTraction],
				['team', 'Team & mentors', hasTeam],
				['funding', 'Funding & grants', hasFunding],
				['recognition', 'Achievements & press', hasRecognition],
				['partners', 'Partnerships', hasPartners],
				['tech', 'Tech stack', hasTech],
				['impact', 'Impact & IP', hasImpact],
				['voices', 'Testimonials', hasVoices],
				['timeline', 'Timeline', hasTimeline],
				['work-with', 'Work with us', true]
			] as Array<[string, string, boolean]>
		)
			.filter(([, , show]) => show)
			.map(([id, label]) => ({ id, label }))
	);
</script>

<svelte:head>
	<title>{startup.name} · {category.title} · IITG TIC</title>
</svelte:head>

<section class="hero">
	<p class="hero__eyebrow">{category.title} · {startup.sector}</p>
	<div class="hero__logo" aria-label={startup.logo?.alt}>
		{#if startup.logo?.src}
			<img src={startup.logo.src} alt={startup.logo.alt ?? `${startup.name} logo`} />
		{:else}
			<span>{startup.name.charAt(0)}</span>
		{/if}
	</div>
	<h1>{startup.name}</h1>
	<p class="hero__tagline"><em>{startup.tagline}</em></p>
	{#if startup.oneLiner}
		<p class="hero__oneliner">{startup.oneLiner}</p>
	{/if}

	<div class="hero__chips">
		{#if startup.stage}
			<span class="chip"><Layers size={14} strokeWidth={1.75} />{startup.stage}</span>
		{/if}
		{#if startup.foundingYear}
			<span class="chip"
				><Calendar size={14} strokeWidth={1.75} />Founded {startup.foundingYear}</span
			>
		{/if}
		{#if startup.hqLocation}
			<span class="chip"><MapPin size={14} strokeWidth={1.75} />{startup.hqLocation}</span>
		{/if}
		{#if startup.hiring?.isHiring}
			<span class="chip chip--accent"
				><Briefcase size={14} strokeWidth={1.75} />Hiring{startup.hiring.openRoles
					? ` · ${startup.hiring.openRoles} open`
					: ''}</span
			>
		{/if}
	</div>
</section>

<section class="body">
	<div class="body__inner">
		<ScrollSpyNav sections={spySections} eyebrow="On this profile" />

		<article class="content">
			<section id="overview" class="block">
				<div class="block__head">
					<p class="block__eyebrow"><BadgeCheck size={14} strokeWidth={1.75} />Overview</p>
					<h2>Company details</h2>
				</div>

				<div class="overview-grid">
					<div class="overview-col">
						<dl class="kv">
							{#if startup.registration?.type}
								<div class="kv__row">
									<dt><Building2 size={14} strokeWidth={1.75} />Entity</dt>
									<dd>{startup.registration.type}</dd>
								</div>
							{/if}
							{#if startup.industry}
								<div class="kv__row">
									<dt><Layers size={14} strokeWidth={1.75} />Industry</dt>
									<dd>{startup.industry}</dd>
								</div>
							{/if}
							{#if startup.hqLocation}
								<div class="kv__row">
									<dt><MapPin size={14} strokeWidth={1.75} />HQ</dt>
									<dd>{startup.hqLocation}</dd>
								</div>
							{/if}
							{#each regEntries as [key, value] (key)}
								<div class="kv__row">
									<dt>{regLabels[key] ?? key}</dt>
									<dd class="kv__mono">{value}</dd>
								</div>
							{/each}
							{#if startup.contactEmail}
								<div class="kv__row">
									<dt><Mail size={14} strokeWidth={1.75} />Email</dt>
									<dd>
										<LinkReveal
											href={`mailto:${startup.contactEmail}`}
											text={startup.contactEmail}
										/>
									</dd>
								</div>
							{/if}
						</dl>
					</div>

					<div class="overview-col">
						<p class="block__eyebrow block__eyebrow--minor">
							<Globe size={14} strokeWidth={1.75} />On the web
						</p>
						<ul class="links">
							{#if startup.website}
								<li>
									<a class="link" href={startup.website} target="_blank" rel="noopener">
										<span class="link__icon"><Globe size={16} strokeWidth={1.75} /></span>
										<LinkReveal href={startup.website} text="Visit website" />
										<ArrowUpRight size={14} strokeWidth={1.75} />
									</a>
								</li>
							{/if}
							{#each socialEntries as [key, url] (key)}
								<li>
									<a class="link" href={url} target="_blank" rel="noopener">
										<span class="link__icon"><BrandIcon name={key} size={16} /></span>
										<LinkReveal
											href={url}
											text={key.charAt(0).toUpperCase() + key.slice(1)}
										/>
										<ArrowUpRight size={14} strokeWidth={1.75} />
									</a>
								</li>
							{/each}
							{#if !startup.website && socialEntries.length === 0}
								<li class="links__empty">No public links published yet.</li>
							{/if}
						</ul>

						{#if startup.incubation}
							<p class="block__eyebrow block__eyebrow--minor block__eyebrow--spaced">
								<Sparkles size={14} strokeWidth={1.75} />Incubation
							</p>
							<dl class="kv kv--compact">
								<div class="kv__row">
									<dt>Programme</dt>
									<dd>{startup.incubation.program}</dd>
								</div>
								{#if startup.incubation.duration}
									<div class="kv__row">
										<dt>Duration</dt>
										<dd>{startup.incubation.duration}</dd>
									</div>
								{/if}
							</dl>
						{/if}
					</div>
				</div>
			</section>

			{#if hasProblemSolution}
				<section id="problem-solution" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Lightbulb size={14} strokeWidth={1.75} />Problem & Solution</p>
						<h2>What we're tackling.</h2>
					</div>
					<div class="split">
						{#if startup.problem}
							<div>
								<p class="block__eyebrow block__eyebrow--minor">Problem</p>
								<p class="prose">{startup.problem}</p>
							</div>
						{/if}
						{#if startup.solution}
							<div>
								<p class="block__eyebrow block__eyebrow--minor">Solution</p>
								<p class="prose">{startup.solution}</p>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			{#if hasFeatures}
				<section id="features" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><BadgeCheck size={14} strokeWidth={1.75} />Key features</p>
						<h2>What the product does.</h2>
					</div>
					<ul class="features">
						{#each startup.features as feature}
							<li>{feature}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if hasMarket}
				<section id="market" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Target size={14} strokeWidth={1.75} />Target market</p>
						<h2>Who we serve.</h2>
					</div>
					<p class="prose">{startup.targetMarket}</p>
				</section>
			{/if}

			{#if hasTraction}
				<section id="traction" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><LineChart size={14} strokeWidth={1.75} />Traction</p>
						<h2>Where we are.</h2>
					</div>
					<div class="metrics">
						{#each startup.traction as metric}
							<div class="metric">
								<div class="metric__value">{metric.value}</div>
								<div class="metric__label">{metric.label}</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if hasTeam}
				<section id="team" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Users size={14} strokeWidth={1.75} />Founding team</p>
						<h2>Who is building.</h2>
					</div>

					{#if startup.founders?.length}
						<div class="founders">
							{#each startup.founders as founder}
								<div class="founder">
									<div class="founder__photo">
										{#if founder.photo}
											<img
												src={founder.photo}
												alt={founder.photoAlt ?? `${founder.name} portrait`}
											/>
										{:else}
											<User size={28} strokeWidth={1.5} />
										{/if}
									</div>
									<div class="founder__body">
										<h3 class="founder__name">{founder.name}</h3>
										<p class="founder__role">{founder.role}</p>
										{#if founder.bio}<p class="founder__bio">{founder.bio}</p>{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if startup.incubation?.mentors?.length}
						<div class="subblock">
							<p class="block__eyebrow block__eyebrow--minor">
								<Users size={14} strokeWidth={1.75} />Mentors & advisors
							</p>
							<ul class="bullets">
								{#each startup.incubation.mentors as mentor}<li>{mentor}</li>{/each}
							</ul>
						</div>
					{/if}
				</section>
			{/if}

			{#if hasFunding}
				<section id="funding" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Wallet size={14} strokeWidth={1.75} />Funding & grants</p>
						<h2>How we're financed.</h2>
					</div>
					<div class="split">
						{#if startup.funding.raised}
							<div>
								<p class="block__eyebrow block__eyebrow--minor">Capital raised</p>
								<p class="prose">{startup.funding.raised}</p>
							</div>
						{/if}
						{#if startup.funding.grants?.length}
							<div>
								<p class="block__eyebrow block__eyebrow--minor">
									<HandCoins size={14} strokeWidth={1.75} />Grants
								</p>
								<ul class="bullets">
									{#each startup.funding.grants as grant}<li>{grant}</li>{/each}
								</ul>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			{#if hasRecognition}
				<section id="recognition" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Trophy size={14} strokeWidth={1.75} />Recognition</p>
						<h2>Awards & press.</h2>
					</div>
					<div class="split">
						{#if startup.achievements?.length}
							<div>
								<p class="block__eyebrow block__eyebrow--minor">
									<Award size={14} strokeWidth={1.75} />Achievements
								</p>
								<ul class="bullets">
									{#each startup.achievements as a}<li>{a}</li>{/each}
								</ul>
							</div>
						{/if}
						{#if startup.mediaMentions?.length}
							<div>
								<p class="block__eyebrow block__eyebrow--minor">
									<Newspaper size={14} strokeWidth={1.75} />Media mentions
								</p>
								<ul class="bullets">
									{#each startup.mediaMentions as m}
										<li>
											<span class="bullets__meta">{m.outlet} —</span>
											{#if m.url && m.url !== '#'}
												<LinkReveal href={m.url} text={m.title} />
											{:else}
												<span>{m.title}</span>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			{#if hasPartners}
				<section id="partners" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Handshake size={14} strokeWidth={1.75} />Partnerships</p>
						<h2>Who we work with.</h2>
					</div>
					<ul class="tags">
						{#each startup.partnerships as p}<li class="tag">{p}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if hasTech}
				<section id="tech" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Cpu size={14} strokeWidth={1.75} />Tech stack</p>
						<h2>What we build with.</h2>
					</div>
					<ul class="tags">
						{#each startup.techStack as t}<li class="tag">{t}</li>{/each}
					</ul>
				</section>
			{/if}

			{#if hasImpact}
				<section id="impact" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Leaf size={14} strokeWidth={1.75} />Impact & IP</p>
						<h2>What's been created.</h2>
					</div>

					{#if startup.supportedBy?.length}
						<div class="subblock">
							<p class="block__eyebrow block__eyebrow--minor">
								<ShieldCheck size={14} strokeWidth={1.75} />Supported by
							</p>
							<ul class="tags">
								{#each startup.supportedBy as s}<li class="tag tag--solid">{s}</li>{/each}
							</ul>
						</div>
					{/if}

					{#if startup.graduateOutcome || startup.impactCreated}
						<div class="split">
							{#if startup.graduateOutcome}
								<div>
									<p class="block__eyebrow block__eyebrow--minor">
										<Award size={14} strokeWidth={1.75} />Graduate outcome
									</p>
									<p class="prose">{startup.graduateOutcome}</p>
								</div>
							{/if}
							{#if startup.impactCreated}
								<div>
									<p class="block__eyebrow block__eyebrow--minor">
										<Leaf size={14} strokeWidth={1.75} />Impact created
									</p>
									<p class="prose">{startup.impactCreated}</p>
								</div>
							{/if}
						</div>
					{/if}

					{#if startup.ipPatents?.length}
						<div class="subblock">
							<p class="block__eyebrow block__eyebrow--minor">
								<FlaskConical size={14} strokeWidth={1.75} />Research · IP · Patents
							</p>
							<ul class="bullets">
								{#each startup.ipPatents as ip}<li>{ip}</li>{/each}
							</ul>
						</div>
					{/if}

					{#if startup.sdgAlignment?.length}
						<div class="subblock">
							<p class="block__eyebrow block__eyebrow--minor">
								<Leaf size={14} strokeWidth={1.75} />SDG alignment
							</p>
							<ul class="tags">
								{#each startup.sdgAlignment as sdg}<li class="tag">{sdg}</li>{/each}
							</ul>
						</div>
					{/if}
				</section>
			{/if}

			{#if hasVoices}
				<section id="voices" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Quote size={14} strokeWidth={1.75} />Testimonials</p>
						<h2>In their words.</h2>
					</div>
					<div class="quotes">
						{#each startup.testimonials as t}
							<figure class="quote">
								<blockquote>{t.quote}</blockquote>
								<figcaption>
									— {t.author}{#if t.role}, <em>{t.role}</em>{/if}
								</figcaption>
							</figure>
						{/each}
					</div>
				</section>
			{/if}

			{#if hasTimeline}
				<section id="timeline" class="block">
					<div class="block__head">
						<p class="block__eyebrow"><Milestone size={14} strokeWidth={1.75} />Timeline</p>
						<h2>Milestones so far.</h2>
					</div>
					<ol class="timeline">
						{#each startup.milestones as m}
							<li class="timeline__item">
								<span class="timeline__year">{m.year}</span>
								<span class="timeline__event">{m.event}</span>
							</li>
						{/each}
					</ol>
				</section>
			{/if}

			<section id="work-with" class="block block--cta">
				<div class="block__head">
					<p class="block__eyebrow"><Handshake size={14} strokeWidth={1.75} />Work with us</p>
					<h2>Get in touch with {startup.name}.</h2>
				</div>
				<div class="cta-row">
					{#if startup.website}
						<a class="cta-btn" href={startup.website} target="_blank" rel="noopener">
							<Globe size={16} strokeWidth={1.75} />
							<LinkReveal href={startup.website} text="Visit website" />
						</a>
					{/if}
					{#if startup.contactEmail}
						<a
							class="cta-btn"
							href={`mailto:${startup.contactEmail}?subject=Demo%20request%20%E2%80%94%20${encodeURIComponent(startup.name)}`}
						>
							<Sparkles size={16} strokeWidth={1.75} />
							<LinkReveal href={`mailto:${startup.contactEmail}`} text="Request a demo" />
						</a>
						<a
							class="cta-btn"
							href={`mailto:${startup.contactEmail}?subject=Partnership%20enquiry%20%E2%80%94%20${encodeURIComponent(startup.name)}`}
						>
							<Handshake size={16} strokeWidth={1.75} />
							<LinkReveal
								href={`mailto:${startup.contactEmail}`}
								text="Partner with the team"
							/>
						</a>
						<a class="cta-btn" href={`mailto:${startup.contactEmail}`}>
							<Mail size={16} strokeWidth={1.75} />
							<LinkReveal href={`mailto:${startup.contactEmail}`} text="Contact founders" />
						</a>
					{/if}
					{#if startup.hiring?.isHiring}
						<a class="cta-btn cta-btn--accent" href={startup.hiring.rolesUrl ?? '/opportunities'}>
							<Briefcase size={16} strokeWidth={1.75} />
							<LinkReveal
								href={startup.hiring.rolesUrl ?? '/opportunities'}
								text={`Join the team${startup.hiring.openRoles ? ` · ${startup.hiring.openRoles} open` : ''}`}
							/>
						</a>
					{/if}
				</div>
			</section>

			<footer class="back">
				<LinkReveal
					href={`/incubated-startups/${category.slug}`}
					text={`← Back to ${category.title.toLowerCase()}`}
				/>
			</footer>
		</article>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.hero {
		@include page-hero(
			$min-height: 70svh,
			$fg: $color-black,
			$pad-top-extra: $space-7,
			$pad-bottom: $space-8,
			$gap: $space-4
		);
	}

	.hero__eyebrow {
		@include eyebrow;
	}

	.hero__logo {
		width: 104px;
		height: 104px;
		border-radius: 50%;
		overflow: hidden;
		background: $color-black;
		color: $color-white;
		display: grid;
		place-items: center;
		font-family: $font-family-serif;
		font-size: 2.6rem;
		font-style: italic;
		font-weight: $font-weight-regular;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.hero h1 {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(2.25rem, 5.5vw, #{$font-size-5xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		text-wrap: balance;
	}

	.hero__tagline {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-lg;
		color: $color-black;
	}

	.hero__oneliner {
		margin: 0;
		max-width: 60ch;
		font-family: $font-family-serif;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.7);
	}

	.hero__chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: $space-2;
		margin-top: $space-3;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid $color-black;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		color: $color-black;
		text-transform: uppercase;
	}

	.chip--accent {
		background: $color-black;
		color: $color-white;
	}

	.body {
		background: $color-white;
		color: $color-black;
		padding: $space-9 $space-8 $space-10;
		border-top: 1px solid rgba($color-black, 0.08);
	}

	.body__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
		gap: $space-10;
		align-items: start;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
			gap: $space-7;
		}
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: $space-10;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: $space-5;
		scroll-margin-top: calc(var(--page-shell-top, 104px) + #{$space-5});
	}

	.block__head {
		display: flex;
		flex-direction: column;
		gap: $space-2;
	}

	.block__eyebrow {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.block__eyebrow--minor {
		margin-bottom: $space-2;
	}

	.block__eyebrow--spaced {
		margin-top: $space-5;
	}

	.block h2 {
		margin: 0;
		font-family: $font-family-serif;
		font-size: clamp(1.5rem, 3vw, #{$font-size-3xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		letter-spacing: $letter-spacing-tight;
		font-style: italic;
		text-wrap: balance;
	}

	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $space-6;

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
			gap: $space-5;
		}
	}

	.subblock {
		display: flex;
		flex-direction: column;
		gap: $space-2;
	}

	.prose {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		color: $color-black;
		max-width: 62ch;
	}

	.overview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $space-6;

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.overview-col {
		display: flex;
		flex-direction: column;
		gap: $space-3;
	}

	.kv {
		margin: 0;
		border: 1px solid $color-black;
	}

	.kv__row {
		display: grid;
		grid-template-columns: 150px 1fr;
		gap: $space-3;
		padding: $space-3 $space-4;
		border-bottom: 1px solid rgba($color-black, 0.12);

		&:last-child {
			border-bottom: 0;
		}

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
			gap: 4px;
			padding: $space-3;
		}
	}

	.kv__row dt {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.kv__row dd {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		color: $color-black;
		overflow-wrap: anywhere;
	}

	.kv__mono {
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace !important;
		font-size: $font-size-sm !important;
		letter-spacing: 0.02em;
	}

	.kv--compact .kv__row {
		padding: $space-2 $space-3;
	}

	.links {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: $space-2;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: $space-2;
		color: $color-black;
		text-decoration: none;
		font-family: $font-family-serif;
		font-size: $font-size-base;
	}

	.link__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid $color-black;
	}

	.links__empty {
		font-family: $font-family-serif;
		font-style: italic;
		color: rgba($color-black, 0.55);
		font-size: $font-size-base;
	}

	.features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: $space-3;

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}

		li {
			padding: $space-3 $space-4;
			border: 1px solid $color-black;
			font-family: $font-family-serif;
			font-size: $font-size-base;
			line-height: $line-height-base;
		}
	}

	.bullets {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: $space-2;

		li {
			padding-left: $space-4;
			position: relative;
			font-family: $font-family-serif;
			font-size: $font-size-base;
			line-height: $line-height-base;

			&::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0.6em;
				width: 8px;
				height: 1px;
				background: $color-black;
			}
		}
	}

	.bullets__meta {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
		margin-right: 4px;
	}

	.tags {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
	}

	.tag {
		padding: 6px 12px;
		border: 1px solid $color-black;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: $color-black;
	}

	.tag--solid {
		background: $color-black;
		color: $color-white;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: $space-4;

		@include breakpoint-down($bp-md) {
			grid-template-columns: repeat(2, 1fr);
		}

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
		}
	}

	.metric {
		display: flex;
		flex-direction: column;
		gap: $space-1;
		padding: $space-4 $space-5;
		border: 1px solid $color-black;
	}

	.metric__value {
		font-family: $font-family-serif;
		font-style: italic;
		font-size: clamp(1.5rem, 3vw, #{$font-size-3xl});
		line-height: 1.1;
		color: $color-black;
	}

	.metric__label {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.founders {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: $space-4;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
		}
	}

	.founder {
		display: flex;
		gap: $space-4;
		padding: $space-5;
		border: 1px solid $color-black;
		align-items: flex-start;
	}

	.founder__photo {
		flex: none;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		overflow: hidden;
		background: $color-black;
		color: $color-white;
		display: grid;
		place-items: center;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.founder__body {
		display: flex;
		flex-direction: column;
		gap: $space-1;
		min-width: 0;
	}

	.founder__name {
		margin: 0;
		font-family: $font-family-serif;
		font-size: $font-size-lg;
		font-weight: $font-weight-regular;
		font-style: italic;
		color: $color-black;
	}

	.founder__role {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.founder__bio {
		margin: $space-1 0 0;
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: $color-black;
	}

	.quotes {
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.quote {
		margin: 0;
		padding: $space-5 $space-6;
		border-left: 2px solid $color-black;
	}

	.quote blockquote {
		margin: 0;
		font-family: $font-family-serif;
		font-style: italic;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		color: $color-black;

		&::before {
			content: '“';
		}
		&::after {
			content: '”';
		}
	}

	.quote figcaption {
		margin-top: $space-3;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.timeline {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		border-top: 1px solid rgba($color-black, 0.12);
	}

	.timeline__item {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: $space-4;
		padding: $space-4 0;
		border-bottom: 1px solid rgba($color-black, 0.12);

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}

	.timeline__year {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		color: rgba($color-black, 0.55);
		padding-top: 3px;
	}

	.timeline__event {
		font-family: $font-family-serif;
		font-size: $font-size-base;
		line-height: $line-height-base;
		color: $color-black;
	}

	.block--cta {
		padding: $space-6;
		background: $color-black;
		color: $color-white;
	}

	.block--cta .block__eyebrow,
	.block--cta h2 {
		color: $color-white;
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: $space-3;
	}

	.cta-btn {
		display: inline-flex;
		align-items: center;
		gap: $space-2;
		padding: $space-3 $space-4;
		border: 1px solid $color-white;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.cta-btn--accent {
		background: $color-white;
		color: $color-black;
	}

	.back {
		@include back-link-footer;
	}

	@include breakpoint-down($bp-sm) {
		.hero {
			@include page-hero-mobile($gap: $space-3);
		}

		.body {
			padding: $space-8 $space-5 $space-9;
		}

		.content {
			gap: $space-8;
		}

		.block--cta {
			padding: $space-5;
		}
	}
</style>
