<script lang="ts">
	import { STARTUP_STAGES } from '$lib/content';
	import { layoutPrompt } from '$lib/utils/layoutPrompts';
	import { showToast } from '$lib/utils/toast.svelte';
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

	// A ChatGPT prompt for one layout, carrying everything filled in so far.
	async function copyPrompt(layout: StartupProfileData['layout']) {
		try {
			await navigator.clipboard.writeText(layoutPrompt(value, layout));
			showToast('Copied. Open ChatGPT, paste it in and send — then paste its answers into the boxes here.');
		} catch {
			showToast('Could not copy. Your browser blocked the clipboard.', 'err');
		}
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

<!-- A small drawing of each layout, so the cards can be told apart at a glance. -->
{#snippet thumb(layout: string)}
	<svg class="thumb" viewBox="0 0 120 72" aria-hidden="true">
		<rect width="120" height="72" rx="6" fill="#f4f4f1" />
		{#if layout === 'classic'}
			<rect x="38" y="6" width="44" height="12" rx="2" fill="#cfcfca" />
			<rect x="8" y="24" width="22" height="42" rx="2" fill="#e2e2dd" />
			<rect x="36" y="24" width="76" height="12" rx="2" fill="#d9d9d4" />
			<rect x="36" y="40" width="76" height="12" rx="2" fill="#d9d9d4" />
			<rect x="36" y="56" width="76" height="10" rx="2" fill="#d9d9d4" />
		{:else if layout === 'story'}
			<rect width="120" height="22" rx="6" fill="#12261a" />
			<path d="M60 22 C 72 32, 72 38, 60 46 S 48 58, 60 66 L 60 72" fill="none" stroke="#00b451" stroke-width="2" />
			<circle cx="60" cy="46" r="2.5" fill="#00b451" />
			<rect x="12" y="34" width="34" height="14" rx="2" fill="#d9d9d4" />
			<rect x="74" y="52" width="34" height="14" rx="2" fill="#d9d9d4" />
		{:else if layout === 'one-pager'}
			<rect x="6" y="6" width="34" height="60" rx="4" fill="#fff" />
			<rect x="46" y="6" width="68" height="14" rx="3" fill="#fff" />
			<rect x="46" y="24" width="68" height="12" rx="3" fill="#fff" />
			<rect x="46" y="40" width="32" height="26" rx="3" fill="#fff" />
			<rect x="82" y="40" width="32" height="26" rx="3" fill="#fff" />
		{:else if layout === 'showcase'}
			<rect width="120" height="34" rx="6" fill="#c9c9c3" />
			<rect x="10" y="26" width="100" height="14" rx="3" fill="#fff" />
			<rect x="10" y="46" width="48" height="20" rx="2" fill="#d9d9d4" />
			<rect x="62" y="46" width="48" height="20" rx="2" fill="#e2e2dd" />
		{:else}
			<rect width="120" height="34" rx="6" fill="#231f20" />
			<rect x="10" y="22" width="40" height="3" rx="1" fill="#00b451" />
			<rect x="76" y="6" width="34" height="22" rx="2" fill="#3b3738" />
			<rect x="10" y="42" width="30" height="24" rx="2" fill="#d9d9d4" />
			<rect x="45" y="42" width="30" height="24" rx="2" fill="#d9d9d4" />
			<rect x="80" y="42" width="30" height="24" rx="2" fill="#d9d9d4" />
		{/if}
	</svg>
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
		<p class="group__sub">
			How your page is laid out. Everything you fill in below is kept whichever you pick. Stuck for
			words? <em>Write it with ChatGPT</em> copies a request you paste into ChatGPT — it writes each
			field for that layout from your details, and lists the photos you'll need. Paste the answers back
			into the boxes below.
		</p>
		<div class="layouts">
			{#each PROFILE_LAYOUTS as l (l.value)}
				<div class="layout" class:layout--on={value.layout === l.value}>
					<label class="layout__pick">
						<input type="radio" name="layout" value={l.value} bind:group={value.layout} />
						{@render thumb(l.value)}
						<strong>{l.label}</strong>
						<span>{l.hint}</span>
					</label>
					<!-- An example page on the public site, opened in a new tab. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a class="link" href={`/incubated-startups/preview/layout/${l.value}`} target="_blank" rel="noopener"
						>See an example</a
					>
					<button type="button" class="link" onclick={() => copyPrompt(l.value)}>Write it with ChatGPT</button>
					<small class="layout__hint">
						Copies a ready-made request with your details. Paste it into ChatGPT to get the text for
						each field of this layout, and a list of the photos to add.
					</small>
				</div>
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
				<span class="field__label">Sector * <small>Pick one or type your own</small></span>
				<input list="sector-options" bind:value={value.sector} placeholder="e.g. Agriculture & Food" />
				<datalist id="sector-options">
					{#each sectors as s (s)}<option value={s}></option>{/each}
				</datalist>
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
			<textarea rows="5" bind:value={value.summary}></textarea>
		</label>
	</section>

	<section class="group">
		<h3>About your startup</h3>
		<p class="group__sub">
			The main write-up on your page, shown large in every layout. Write as much as you like — leave a
			blank line between paragraphs.
		</p>
		<label class="field">
			<span class="field__label">About {value.name || 'your startup'} <small>{value.description.length.toLocaleString('en-IN')} / 16,000 characters</small></span>
			<textarea class="long" rows="14" maxlength="16000" bind:value={value.description}></textarea>
		</label>
	</section>

	<section class="group">
		<h3>The story</h3>
		<div class="grid grid--wide">
			<label class="field"><span class="field__label">Problem</span><textarea rows="7" bind:value={value.problem}></textarea></label>
			<label class="field"><span class="field__label">Solution</span><textarea rows="7" bind:value={value.solution}></textarea></label>
			<label class="field"><span class="field__label">Target market</span><textarea rows="6" bind:value={value.targetMarket}></textarea></label>
			<label class="field"><span class="field__label">Market size</span><textarea rows="6" bind:value={value.marketSize}></textarea></label>
			<label class="field"><span class="field__label">Business model</span><textarea rows="6" bind:value={value.businessModel}></textarea></label>
			<label class="field"><span class="field__label">Raising now</span><input bind:value={value.raising} placeholder="Pre-Series A · ₹5 Cr" /></label>
			<label class="field"><span class="field__label">What you built</span><textarea rows="6" bind:value={value.founderStory.whatTheyBuilt}></textarea></label>
			<label class="field"><span class="field__label">What TIC contributed</span><textarea rows="6" bind:value={value.founderStory.whatTicContributed}></textarea></label>
			<label class="field"><span class="field__label">Where you are now</span><textarea rows="6" bind:value={value.founderStory.whereTheyAreNow}></textarea></label>
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
					<label class="field field--wide"><span class="field__label">What happened</span><textarea rows="4" bind:value={m.text}></textarea></label>
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
					<label class="field field--wide"><span class="field__label">Short bio</span><textarea rows="4" bind:value={f.bio}></textarea></label>
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
		<h3>Photos</h3>
		<p class="group__sub">Up to 12. Showcase pairs the first ones with your key features and shows the rest as a gallery.</p>
		<div class="gallery">
			{#each value.gallery as src, i (i)}
				<div class="gallery__item">
					<img {src} alt="" />
					{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.gallery.splice(i, 1)}>Remove</button>{/if}
				</div>
			{/each}
		</div>
		{#if !readonly && value.gallery.length < 12}
			<label class="btn">
				{uploading === 'gallery' ? 'Uploading…' : 'Add a photo'}
				<input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange={(e) => pick(e, 'gallery', (u) => value.gallery.push(u))} />
			</label>
		{/if}
	</section>

	<section class="group">
		<h3>Technology and impact</h3>
		<div class="grid">
			<label class="field">
				<span class="field__label">Technology readiness level <small>Lab layout</small></span>
				<select bind:value={value.trl}>
					<option value="">Not given</option>
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as n (n)}<option value={n}>TRL {n}</option>{/each}
				</select>
			</label>
		</div>
		<p class="field__label">Specifications <small>Lab layout — key technical figures</small></p>
		{#each value.specs as s, i (i)}
			<div class="row row--inline row--two">
				<input bind:value={s.label} placeholder="Accuracy" aria-label="What it measures" />
				<input bind:value={s.value} placeholder="±8% against lab tests" aria-label="Value" />
				{#if !readonly}<button type="button" class="link link--danger" onclick={() => value.specs.splice(i, 1)}>Remove</button>{/if}
			</div>
		{/each}
		{#if !readonly}
			<button type="button" class="btn" onclick={() => value.specs.push({ label: '', value: '' })}>Add a specification</button>
		{/if}
		{@render textList('Tech stack', value.techStack, (v) => (value.techStack = v))}
		{@render textList('Patents and IP', value.ipPatents, (v) => (value.ipPatents = v))}
		{@render textList('SDGs', value.sdgAlignment, (v) => (value.sdgAlignment = v), 'One per line, e.g. SDG 2 · Zero hunger')}
		<label class="field"><span class="field__label">Impact so far</span><textarea rows="6" bind:value={value.impactCreated}></textarea></label>
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

	// Long-form answers get the full width and room to write.
	.grid--wide {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
	}

	.long {
		min-height: 320px;
		font-size: 15px;
		line-height: 1.7;
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 10px;
	}

	.gallery__item {
		display: grid;
		gap: 4px;
		justify-items: start;

		img {
			width: 100%;
			aspect-ratio: 4 / 3;
			object-fit: cover;
			border-radius: 8px;
			border: 1px solid $admin-line;
		}
	}

	.row--two {
		grid-template-columns: 1fr 2fr auto;
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
		// Two across even on a phone, five on a wide screen.
		grid-template-columns: repeat(auto-fit, minmax(min(140px, 45%), 1fr));
		gap: 10px;
	}

	.layout {
		display: grid;
		gap: 10px;
		align-content: start;
		padding: 14px;
		border: 1px solid $admin-line;
		border-radius: 10px;

		.link {
			justify-self: start;
			text-decoration: underline;
		}
	}

	.layout__pick {
		display: grid;
		gap: 4px;
		cursor: pointer;

		input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		strong {
			margin-top: 6px;
			font-size: 14px;
			color: $admin-ink;
		}

		span {
			font-size: 12.5px;
			color: rgba($admin-ink, 0.6);
		}
	}

	.layout__hint {
		font-size: 12px;
		line-height: 1.45;
		color: rgba($admin-ink, 0.6);
	}

	.thumb {
		display: block;
		width: 100%;
		height: auto;
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
			width: 100%;
			min-width: 0;
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
		// Sits at its own width inside the grid cards rather than stretching.
		justify-self: start;
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
