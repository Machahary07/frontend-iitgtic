<script lang="ts">
	import { STARTUP_STAGES } from '$lib/content';
	import {
		PROFILE_LAYOUTS,
		SOCIAL_KEYS,
		type StartupProfileData
	} from '$lib/utils/startupProfile';

	// Every field of a public startup profile, grouped the way the page reads.
	// Lists of plain text are one item per line; lists of records get rows.
	interface Props {
		value: StartupProfileData;
		sectors: string[];
		/** Uploads an image and returns its public URL, or null on failure. */
		upload: (file: File) => Promise<string | null>;
		readonly?: boolean;
	}
	let { value = $bindable(), sectors, upload, readonly = false }: Props = $props();

	let uploading = $state('');

	async function pick(event: Event, key: string, set: (url: string) => void) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = key;
		const url = await upload(file);
		uploading = '';
		if (url) set(url);
	}

	const lines = (list: string[]) => list.join('\n');
	const toLines = (text: string) => text.split('\n');
</script>

{#snippet image(label: string, key: string, src: string, set: (url: string) => void, hint = '')}
	<div class="field">
		<span class="field__label">{label}</span>
		<div class="img">
			<div class="img__thumb">{#if src}<img {src} alt="" />{/if}</div>
			<div class="img__acts">
				{#if !readonly}
					<label class="btn">
						{uploading === key ? 'Uploading…' : src ? 'Replace' : 'Upload'}
						<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange={(e) => pick(e, key, set)} />
					</label>
					{#if src}<button type="button" class="link" onclick={() => set('')}>Remove</button>{/if}
				{/if}
				{#if hint}<small>{hint}</small>{/if}
			</div>
		</div>
	</div>
{/snippet}

{#snippet textList(label: string, list: string[], set: (v: string[]) => void, hint = 'One per line')}
	<label class="field">
		<span class="field__label">{label} <small>{hint}</small></span>
		<textarea rows="3" value={lines(list)} oninput={(e) => set(toLines(e.currentTarget.value))} disabled={readonly}></textarea>
	</label>
{/snippet}

<fieldset class="editor" disabled={readonly}>
	<section class="group">
		<h3>Layout</h3>
		<p class="group__sub">How your page is laid out. Everything you fill in below is kept whichever you pick.</p>
		<div class="layouts">
			{#each PROFILE_LAYOUTS as l (l.value)}
				<label class="layout" class:layout--on={value.layout === l.value}>
					<input type="radio" name="layout" value={l.value} bind:group={value.layout} />
					<strong>{l.label}</strong>
					<span>{l.hint}</span>
				</label>
			{/each}
		</div>
	</section>

	<section class="group">
		<h3>Basics</h3>
		<div class="grid">
			<label class="field"><span class="field__label">Startup name *</span><input bind:value={value.name} /></label>
			<label class="field"><span class="field__label">Tagline *</span><input bind:value={value.tagline} placeholder="Soil health, read in minutes." /></label>
			<label class="field field--wide"><span class="field__label">One-liner *</span><input bind:value={value.oneLiner} placeholder="What you do, for whom, in one sentence." /></label>
			<label class="field">
				<span class="field__label">Sector *</span>
				<select bind:value={value.sector}>
					<option value="">Choose…</option>
					{#each sectors as s (s)}<option value={s}>{s}</option>{/each}
				</select>
			</label>
			<label class="field"><span class="field__label">Industry</span><input bind:value={value.industry} /></label>
			<label class="field">
				<span class="field__label">Stage</span>
				<select bind:value={value.stage}>
					<option value="">Choose…</option>
					{#each STARTUP_STAGES as s (s)}<option value={s}>{s}</option>{/each}
				</select>
			</label>
			<label class="field"><span class="field__label">Year founded</span><input bind:value={value.foundingYear} inputmode="numeric" maxlength="4" /></label>
			<label class="field"><span class="field__label">Headquarters</span><input bind:value={value.hqLocation} /></label>
			<label class="field"><span class="field__label">Team size</span><input bind:value={value.teamSize} /></label>
			<label class="field"><span class="field__label">Website</span><input type="url" bind:value={value.website} placeholder="https://" /></label>
			<label class="field"><span class="field__label">Public contact email</span><input type="email" bind:value={value.contactEmail} /></label>
		</div>
		<div class="grid">
			{@render image('Logo *', 'logo', value.logo.src, (u) => (value.logo.src = u), 'Square, at least 400 × 400')}
			{@render image('Cover photo', 'cover', value.cover.src, (u) => (value.cover.src = u), 'Wide, at least 2000 px. Used by Story roadmap.')}
		</div>
		<label class="field">
			<span class="field__label">Headline <small>Story roadmap — the sentence over your hero</small></span>
			<input bind:value={value.headline} placeholder="From a six-week soil test to ninety seconds." />
		</label>
		<label class="field">
			<span class="field__label">Summary <small>One-pager — the paragraph it opens with</small></span>
			<textarea rows="3" bind:value={value.summary}></textarea>
		</label>
	</section>

	<section class="group">
		<h3>The story</h3>
		<div class="grid">
			<label class="field"><span class="field__label">Problem</span><textarea rows="4" bind:value={value.problem}></textarea></label>
			<label class="field"><span class="field__label">Solution</span><textarea rows="4" bind:value={value.solution}></textarea></label>
			<label class="field"><span class="field__label">Target market</span><textarea rows="3" bind:value={value.targetMarket}></textarea></label>
			<label class="field"><span class="field__label">Market size</span><textarea rows="3" bind:value={value.marketSize}></textarea></label>
			<label class="field"><span class="field__label">Business model</span><textarea rows="3" bind:value={value.businessModel}></textarea></label>
			<label class="field"><span class="field__label">Raising now</span><input bind:value={value.raising} placeholder="Pre-Series A · ₹5 Cr" /></label>
			<label class="field"><span class="field__label">What you built</span><textarea rows="3" bind:value={value.founderStory.whatTheyBuilt}></textarea></label>
			<label class="field"><span class="field__label">What TIC contributed</span><textarea rows="3" bind:value={value.founderStory.whatTicContributed}></textarea></label>
			<label class="field"><span class="field__label">Where you are now</span><textarea rows="3" bind:value={value.founderStory.whereTheyAreNow}></textarea></label>
		</div>
		{@render textList('Key features', value.features, (v) => (value.features = v))}
	</section>

	<section class="group">
		<h3>Milestones</h3>
		<p class="group__sub">Oldest first. Story roadmap shows each as a stop on the road; tick "Still ahead" for plans.</p>
		{#each value.milestones as m, i (i)}
			<div class="row">
				<div class="grid">
					<label class="field"><span class="field__label">Year</span><input bind:value={m.year} /></label>
					<label class="field"><span class="field__label">Title</span><input bind:value={m.event} /></label>
					<label class="field field--wide"><span class="field__label">What happened</span><textarea rows="2" bind:value={m.text}></textarea></label>
					{@render image('Photo', `m${i}`, m.photo, (u) => (m.photo = u))}
					<label class="check"><input type="checkbox" bind:checked={m.upcoming} /> Still ahead</label>
				</div>
				{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.milestones.splice(i, 1)}>Remove</button>{/if}
			</div>
		{/each}
		{#if !readonly}
			<button type="button" class="btn" onclick={() => value.milestones.push({ year: '', event: '', text: '', photo: '', upcoming: false })}>Add milestone</button>
		{/if}
	</section>

	<section class="group">
		<h3>Numbers and funding</h3>
		{#each value.traction as t, i (i)}
			<div class="row row--inline">
				<input bind:value={t.value} placeholder="1,200" aria-label="Figure" />
				<input bind:value={t.label} placeholder="Farmers onboarded" aria-label="What it counts" />
				<input bind:value={t.note} placeholder="↑ 3× year on year (optional)" aria-label="Note" />
				{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.traction.splice(i, 1)}>Remove</button>{/if}
			</div>
		{/each}
		{#if !readonly}
			<button type="button" class="btn" onclick={() => value.traction.push({ value: '', label: '', note: '' })}>Add a figure</button>
		{/if}
		<div class="grid">
			<label class="field"><span class="field__label">Capital raised</span><input bind:value={value.funding.raised} /></label>
		</div>
		{@render textList('Grants', value.funding.grants, (v) => (value.funding.grants = v))}
	</section>

	<section class="group">
		<h3>Team</h3>
		{#each value.founders as f, i (i)}
			<div class="row">
				<div class="grid">
					<label class="field"><span class="field__label">Name</span><input bind:value={f.name} /></label>
					<label class="field"><span class="field__label">Role</span><input bind:value={f.role} /></label>
					<label class="field field--wide"><span class="field__label">Short bio</span><textarea rows="2" bind:value={f.bio}></textarea></label>
					{@render image('Photo', `f${i}`, f.photo, (u) => (f.photo = u))}
				</div>
				{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.founders.splice(i, 1)}>Remove</button>{/if}
			</div>
		{/each}
		{#if !readonly}
			<button type="button" class="btn" onclick={() => value.founders.push({ name: '', role: '', bio: '', photo: '' })}>Add a person</button>
		{/if}
		{@render textList('Mentors and advisors', value.incubation.mentors, (v) => (value.incubation.mentors = v))}
	</section>

	<section class="group">
		<h3>Recognition</h3>
		{@render textList('Achievements and awards', value.achievements, (v) => (value.achievements = v))}
		{@render textList('Partnerships', value.partnerships, (v) => (value.partnerships = v))}
		{@render textList('Supported by', value.supportedBy, (v) => (value.supportedBy = v))}
		<p class="field__label">Press</p>
		{#each value.mediaMentions as m, i (i)}
			<div class="row row--inline">
				<input bind:value={m.title} placeholder="Headline" aria-label="Headline" />
				<input bind:value={m.outlet} placeholder="Outlet" aria-label="Outlet" />
				<input type="url" bind:value={m.url} placeholder="https://" aria-label="Link" />
				{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.mediaMentions.splice(i, 1)}>Remove</button>{/if}
			</div>
		{/each}
		{#if !readonly}
			<button type="button" class="btn" onclick={() => value.mediaMentions.push({ title: '', outlet: '', url: '' })}>Add press</button>
		{/if}
		<p class="field__label">Testimonials</p>
		{#each value.testimonials as t, i (i)}
			<div class="row row--inline">
				<input bind:value={t.quote} placeholder="Quote" aria-label="Quote" />
				<input bind:value={t.author} placeholder="Who said it" aria-label="Author" />
				<input bind:value={t.role} placeholder="Their role" aria-label="Role" />
				{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.testimonials.splice(i, 1)}>Remove</button>{/if}
			</div>
		{/each}
		{#if !readonly}
			<button type="button" class="btn" onclick={() => value.testimonials.push({ quote: '', author: '', role: '' })}>Add testimonial</button>
		{/if}
	</section>

	<section class="group">
		<h3>Technology and impact</h3>
		{@render textList('Tech stack', value.techStack, (v) => (value.techStack = v))}
		{@render textList('Patents and IP', value.ipPatents, (v) => (value.ipPatents = v))}
		{@render textList('SDGs', value.sdgAlignment, (v) => (value.sdgAlignment = v), 'One per line, e.g. SDG 2 · Zero hunger')}
		<label class="field"><span class="field__label">Impact so far</span><textarea rows="3" bind:value={value.impactCreated}></textarea></label>
	</section>

	<section class="group">
		<h3>Links, hiring and registration</h3>
		<div class="grid">
			{#each SOCIAL_KEYS as k (k)}
				<label class="field"><span class="field__label">{k.charAt(0).toUpperCase() + k.slice(1)}</span><input type="url" bind:value={value.socials[k]} placeholder="https://" /></label>
			{/each}
		</div>
		<div class="grid">
			<label class="check"><input type="checkbox" bind:checked={value.hiring.isHiring} /> We are hiring</label>
			<label class="field"><span class="field__label">Open roles</span><input type="number" min="0" bind:value={value.hiring.openRoles} /></label>
		</div>
		<div class="grid">
			<label class="field"><span class="field__label">Entity type</span><input bind:value={value.registration.type} placeholder="Private Limited" /></label>
			<label class="field"><span class="field__label">CIN</span><input bind:value={value.registration.cin} /></label>
			<label class="field"><span class="field__label">GSTIN</span><input bind:value={value.registration.gstin} /></label>
			<label class="field"><span class="field__label">DPIIT</span><input bind:value={value.registration.dpiit} /></label>
			<label class="field"><span class="field__label">Incorporated on</span><input bind:value={value.registration.incorporatedOn} /></label>
		</div>
	</section>
</fieldset>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.editor {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
		display: grid;
		gap: 18px;
	}

	.group {
		@include admin-card;
		display: grid;
		gap: 14px;

		h3 {
			margin: 0;
			font-size: 16px;
			font-weight: $font-weight-semibold;
			color: $admin-ink;
		}
	}

	.group__sub {
		margin: -8px 0 0;
		font-size: 13px;
		color: rgba($admin-ink, 0.6);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px 14px;
		align-items: start;
	}

	.field {
		display: grid;
		gap: 6px;
		min-width: 0;

		input,
		select,
		textarea {
			@include admin-input;
		}

		textarea {
			resize: vertical;
		}
	}

	.field--wide {
		grid-column: 1 / -1;
	}

	.field__label {
		@include admin-field-label;
		margin: 0;

		small {
			font-weight: $font-weight-regular;
			color: rgba($admin-ink, 0.6);
			text-transform: none;
			letter-spacing: 0;
		}
	}

	.layouts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
	}

	.layout {
		display: grid;
		gap: 4px;
		padding: 14px;
		border: 1px solid $admin-line;
		border-radius: 10px;
		cursor: pointer;

		input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		strong {
			font-size: 14px;
			color: $admin-ink;
		}

		span {
			font-size: 12.5px;
			color: rgba($admin-ink, 0.6);
		}
	}

	.layout--on {
		border-color: $admin-ink;
		box-shadow: inset 0 0 0 1px $admin-ink;
	}

	.row {
		display: grid;
		gap: 8px;
		padding: 12px;
		border: 1px solid $admin-line;
		border-radius: 10px;
		justify-items: start;

		> .grid {
			width: 100%;
		}
	}

	.row--inline {
		grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
		align-items: center;
		border: 0;
		padding: 0;

		input {
			@include admin-input;
		}
	}

	.img {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.img__thumb {
		width: 64px;
		height: 64px;
		flex: none;
		overflow: hidden;
		border-radius: 8px;
		background: $admin-sunken;
		border: 1px solid $admin-line;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.img__acts {
		display: grid;
		gap: 4px;
		justify-items: start;

		small {
			font-size: 12px;
			color: rgba($admin-ink, 0.6);
		}
	}

	.btn {
		@include admin-btn-base;
		cursor: pointer;
	}

	.link {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		font-size: 13px;
		color: $admin-ink;
		text-decoration: underline;
		cursor: pointer;
	}

	.link--danger {
		color: admin-tone-fg('bad');
	}

	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: $admin-ink;
		align-self: end;
		padding-bottom: 8px;
	}

	@media (max-width: 720px) {
		.row--inline {
			grid-template-columns: 1fr;
		}
	}
</style>
