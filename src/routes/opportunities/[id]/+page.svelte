<script lang="ts">
	import { page } from '$app/state';
	import { getContent } from '$lib/content';
	import { getJob, type AnyJob } from '$lib/utils/jobPostings';
	import { onMount } from 'svelte';
	import LinkReveal from '$lib/components/LinkReveal.svelte';
	import ButtonReveal from '$lib/components/ButtonReveal.svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import {
		EMAIL_RE,
		RESUME_ACCEPT,
		RESUME_MAX_BYTES,
		WHY_MAX,
		WHY_MIN,
		resumeExtension,
		submitJobApplication
	} from '$lib/utils/jobApplications';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';

	const content = getContent();

	const slug = $derived(page.params.id ?? '');

	function seedBySlug(s: string): AnyJob | null {
		const p = content.pages.opportunities.posts.find((x) => x.slug === s);
		if (!p) return null;
		return {
			id: `seed_${p.slug}`,
			slug: p.slug,
			companyId: '',
			role: p.role,
			company: p.company,
			companySlug: p.companySlug,
			location: p.location,
			type: p.type,
			sector: p.sector,
			posted: p.posted,
			description: p.description,
			applyLink: p.applyLink,
			createdAt: p.posted,
			updatedAt: p.posted,
			source: 'seed' as const
		};
	}

	let userJob = $state<AnyJob | null>(null);
	let resolved = $state(false);

	const job = $derived<AnyJob | null>(userJob ?? seedBySlug(slug));

	onMount(async () => {
		userJob = await getJob(slug);
		resolved = true;
	});

	function formatPosted(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Application panel. A submission posts to /api/job-applications, which
	// re-runs the human check server-side, stores the resume in the private
	// job-applications bucket and writes the row the TIC console reviews.
	const requiresOnsite = $derived(/in-person|on-site|onsite/i.test(job?.location ?? ''));

	let fullName = $state('');
	let email = $state('');
	let phone = $state('');
	let currentRole = $state('');
	let link = $state('');
	let why = $state('');
	let startDate = $state('');
	let onsite = $state(false);
	let consent = $state(false);
	let resume = $state<File | null>(null);
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();

	type Errors = {
		fullName?: string;
		email?: string;
		currentRole?: string;
		resume?: string;
		why?: string;
		startDate?: string;
		onsite?: string;
		consent?: string;
		captcha?: string;
	};

	let errors = $state<Errors>({});
	let attempted = $state(false);
	let submitting = $state(false);
	let sent = $state(false);
	let submitError = $state('');

	function validate(): Errors {
		const e: Errors = {};

		if (!fullName.trim()) e.fullName = 'Full name is required.';
		else if (fullName.trim().length < 2) e.fullName = 'Please enter your full name.';

		if (!email.trim()) e.email = 'Email is required.';
		else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';

		if (!currentRole.trim()) e.currentRole = 'Tell us what you do right now.';

		if (!resume) e.resume = 'Attach your resume.';
		else if (!resumeExtension(resume.name)) e.resume = 'PDF or Word documents only.';
		else if (resume.size > RESUME_MAX_BYTES) e.resume = 'Your resume must be 5 MB or smaller.';

		if (!why.trim()) e.why = 'A short note is required.';
		else if (why.trim().length < WHY_MIN) e.why = 'A little more detail, please.';

		if (!startDate.trim()) e.startDate = 'Earliest start date is required.';

		if (requiresOnsite && !onsite) e.onsite = 'This role is on-site.';

		if (!consent) e.consent = 'Consent is required to share your application.';

		if (!turnstileToken) e.captcha = 'Please complete the verification.';

		return e;
	}

	function revalidate() {
		if (attempted) errors = validate();
	}

	function onResume(ev: Event) {
		const input = ev.currentTarget as HTMLInputElement;
		resume = input.files?.[0] ?? null;
		revalidate();
	}

	async function handleSubmit(ev: Event) {
		ev.preventDefault();
		attempted = true;
		submitError = '';
		const result = validate();
		errors = result;
		if (Object.keys(result).length > 0) return;

		submitting = true;
		const outcome = await submitJobApplication({
			jobSlug: slug,
			fullName: fullName.trim(),
			email: email.trim(),
			phone: phone.trim(),
			applicantRole: currentRole.trim(),
			portfolioLink: link.trim(),
			why: why.trim(),
			startDate,
			onsiteOk: onsite,
			consent,
			resume: resume!,
			turnstileToken
		});
		submitting = false;

		// A Turnstile token is single-use, so a failed attempt needs a fresh one
		// before the applicant can try again.
		captcha?.reset();
		turnstileToken = '';

		if (!outcome.ok) {
			submitError = outcome.error;
			return;
		}

		sent = true;
	}
</script>

<svelte:head>
	<title>{job ? `${job.role} · ${job.company}` : 'Role · IITG TIC'}</title>
</svelte:head>

<section class="detail">
	<div class="detail__inner">
		<LinkReveal href="/opportunities" text="← All roles" class="back" />

		<div class="layout">
			<article class="card">
				{#if !job && resolved}
					<header class="detail__header">
						<h1>Role not found</h1>
						<p>This role may have been filled or removed.</p>
					</header>
				{:else if job}
					<header class="detail__header">
						<div class="meta-top">
							<span class="type-pill" class:type-pill--intern={job.type.startsWith('Internship')}
								>{job.type}</span
							>
							<span class="date">Posted {formatPosted(job.posted)}</span>
						</div>
						<h1>{job.role}</h1>
						<p class="company">{job.company}</p>
						<div class="meta-row">
							<span>{job.location}</span>
							<span class="dot" aria-hidden="true">·</span>
							<span>{job.sector}</span>
						</div>
					</header>

					<div class="body">
						<h2>About the role</h2>
						<p>{job.description}</p>
					</div>

					{/if}
			</article>

			<aside class="panel">
				{#if job}
					<p class="panel__eyebrow">Apply</p>
					<h2 class="panel__title">Apply for this role</h2>

					{#if sent}
						<div class="sent">
							<p class="sent__line">Application received.</p>
							<p class="sent__note">
								It is with the IITG-TIC team, who pass it to {job.company}. If they want to take it
								further they will write to {email} themselves.
							</p>
						</div>
					{:else}
						<p class="panel__note">
							Your application reaches {job.company} through IITG-TIC, who pass it on as sent.
							{job.company} reviews and replies themselves — IITG-TIC does not screen candidates.
						</p>

						<form class="form" onsubmit={handleSubmit} novalidate>
							<label class="field" class:has-error={errors.fullName}>
								<span class="field__label">
									<span class="field__name">Full name <em class="req">*</em></span>
									{#if errors.fullName}<span class="field__error">{errors.fullName}</span>{/if}
								</span>
								<input
									type="text"
									bind:value={fullName}
									autocomplete="name"
									oninput={revalidate}
									aria-invalid={!!errors.fullName}
								/>
							</label>

							<label class="field" class:has-error={errors.email}>
								<span class="field__label">
									<span class="field__name">Email <em class="req">*</em></span>
									{#if errors.email}<span class="field__error">{errors.email}</span>{/if}
								</span>
								<input
									type="email"
									bind:value={email}
									autocomplete="email"
									oninput={revalidate}
									aria-invalid={!!errors.email}
								/>
							</label>

							<label class="field">
								<span class="field__label">
									<span class="field__name">Phone <span class="opt">(optional)</span></span>
								</span>
								<input type="tel" bind:value={phone} autocomplete="tel" />
							</label>

							<label class="field" class:has-error={errors.currentRole}>
								<span class="field__label">
									<span class="field__name">Current role or institution <em class="req">*</em></span
									>
									{#if errors.currentRole}<span class="field__error">{errors.currentRole}</span
										>{/if}
								</span>
								<input
									type="text"
									bind:value={currentRole}
									placeholder="Final-year M.Tech, IIT Guwahati"
									oninput={revalidate}
									aria-invalid={!!errors.currentRole}
								/>
							</label>

							<div class="field" class:has-error={errors.resume}>
								<span class="field__label">
									<span class="field__name">Resume <em class="req">*</em></span>
									{#if errors.resume}<span class="field__error">{errors.resume}</span>{/if}
								</span>
								<label class="file">
									<input
										type="file"
										class="file__input"
										accept={RESUME_ACCEPT}
										onchange={onResume}
									/>
									<span class="file__btn">Choose file</span>
									<span class="file__name">{resume ? resume.name : 'PDF or DOC, up to 5 MB'}</span>
								</label>
							</div>

							<label class="field">
								<span class="field__label">
									<span class="field__name">
										Portfolio or LinkedIn <span class="opt">(optional)</span>
									</span>
								</span>
								<input type="url" bind:value={link} placeholder="https://" />
							</label>

							<label class="field" class:has-error={errors.why}>
								<span class="field__label">
									<span class="field__name">Why this role <em class="req">*</em></span>
									{#if errors.why}<span class="field__error">{errors.why}</span>{/if}
								</span>
								<textarea
									rows="4"
									maxlength={WHY_MAX}
									bind:value={why}
									oninput={revalidate}
									aria-invalid={!!errors.why}
								></textarea>
								<span class="field__count">{why.length}/{WHY_MAX}</span>
							</label>

							<label class="field" class:has-error={errors.startDate}>
								<span class="field__label">
									<span class="field__name">Earliest start date <em class="req">*</em></span>
									{#if errors.startDate}<span class="field__error">{errors.startDate}</span>{/if}
								</span>
								<input
									type="date"
									bind:value={startDate}
									onchange={revalidate}
									aria-invalid={!!errors.startDate}
								/>
							</label>

							{#if requiresOnsite}
								<div class="check-wrap" class:has-error={errors.onsite}>
									<label class="check">
										<input type="checkbox" bind:checked={onsite} onchange={revalidate} />
										<span class="check__text"
											>I can work from {job.location.split('·')[0].trim()}.</span
										>
									</label>
									{#if errors.onsite}<span class="field__error field__error--block"
											>{errors.onsite}</span
										>{/if}
								</div>
							{/if}

							<div class="check-wrap" class:has-error={errors.consent}>
								<label class="check">
									<input type="checkbox" bind:checked={consent} onchange={revalidate} />
									<span class="check__text">
										I agree that my details and resume may be shared with {job.company}.
										<em class="req">*</em>
									</span>
								</label>
								{#if errors.consent}<span class="field__error field__error--block"
										>{errors.consent}</span
									>{/if}
							</div>

							<div class="captcha-wrap" class:has-error={errors.captcha}>
								<Turnstile bind:token={turnstileToken} bind:this={captcha} />
								{#if errors.captcha}<span class="field__error field__error--block"
										>{errors.captcha}</span
									>{/if}
							</div>

							{#if submitError}
								<p class="form__error" role="alert">{submitError}</p>
							{/if}

							<ButtonReveal
								type="submit"
								text={submitting ? 'Sending…' : 'Send application'}
								class="submit"
								loading={submitting}
							/>

							<p class="form__hint">
								{job.company} replies to the email above. Nothing else is shared.
							</p>
							<p class="form__hint">You'll get a copy at the email above.</p>
						</form>
					{/if}
				{/if}
			</aside>
		</div>
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	.detail {
		background: $color-white;
		color: $color-black;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-8 $space-10;
		font-family: $font-family-serif;

		@include breakpoint-down($bp-sm) {
			padding: calc(var(--page-shell-top, 100px) + #{$space-6}) $space-5 $space-8;
		}
	}

	.detail__inner {
		width: min(100%, $container-lg);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.layout {
		display: grid;
		grid-template-columns: 1.6fr 1fr;
		gap: $space-5;
		align-items: start;

		@include breakpoint-down($bp-md) {
			grid-template-columns: 1fr;
		}
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: $space-6;
		padding: $space-6;
		border: 1px solid $color-black;
		background: $color-white;

		@include breakpoint-down($bp-sm) {
			border: 0;
			padding: 0;
			gap: $space-6;
		}
	}

	:global(.back) {
		@include eyebrow;
		color: $color-black;
		align-self: flex-start;
	}

	.detail__header {
		display: flex;
		flex-direction: column;
		gap: $space-3;
		padding-bottom: $space-5;
		border-bottom: 1px solid rgba($color-black, 0.12);
	}

	.meta-top {
		display: flex;
		align-items: center;
		gap: $space-3;
	}

	.type-pill {
		padding: 4px 10px;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		border-radius: $radius-sm;

		&--intern {
			background: $color-primary-green;
		}
	}

	.date {
		font-family: $font-family-base;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
	}

	.detail__header h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, #{$font-size-4xl});
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		font-style: italic;
	}

	.company {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-lg;
		font-weight: $font-weight-semibold;
	}

	.meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		color: rgba($color-black, 0.72);
	}

	.dot {
		color: rgba($color-black, 0.4);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: $space-3;

		h2 {
			@include eyebrow;
		}

		p {
			margin: 0;
			font-size: $font-size-md;
			line-height: $line-height-relaxed;
			white-space: pre-wrap;
			max-width: 64ch;
		}
	}

	/* ---------------------------------------------------------------- panel */

	$color-error: #d62828;

	.panel {
		position: sticky;
		top: calc(var(--page-shell-top, 104px) + #{$space-6});
		display: flex;
		flex-direction: column;
		gap: $space-3;
		padding: $space-6;
		border: 1px solid $color-black;
		background: $color-white;

		@include breakpoint-down($bp-md) {
			position: static;
		}

		// On phone the panel becomes an inverted card: black ground, white
		// text, and every control below flips so it reads on the dark ground.
		@include breakpoint-down($bp-sm) {
			background: $color-black;
			color: $color-white;
			border-color: $color-black;
			border-radius: $radius-md;
			padding: $space-6 $space-5;

			.panel__note {
				border-bottom-color: rgba($color-white, 0.18);
				color: rgba($color-white, 0.72);
			}

			.field__name {
				color: rgba($color-white, 0.8);
			}

			.opt {
				color: rgba($color-white, 0.45);
			}

			.field input,
			.field textarea {
				color: $color-white;
				border-bottom-color: rgba($color-white, 0.3);

				&::placeholder {
					color: rgba($color-white, 0.35);
				}

				&:focus {
					border-bottom-color: $color-white;
				}
			}

			// date pickers render a dark glyph that vanishes on black
			.field input[type='date']::-webkit-calendar-picker-indicator {
				filter: invert(1);
			}

			.field__count,
			.file__name,
			.form__hint {
				color: rgba($color-white, 0.55);
			}

			.file__btn {
				border-color: $color-white;
			}

			.check__text {
				color: rgba($color-white, 0.8);
			}

			.check input {
				accent-color: $color-white;
			}

			.sent {
				border-top-color: rgba($color-white, 0.18);
			}

			.sent__note {
				color: rgba($color-white, 0.72);
			}
		}
	}

	.panel__eyebrow {
		@include eyebrow;
	}

	.panel__title {
		margin: 0;
		font-size: $font-size-2xl;
		line-height: $line-height-tight;
		font-weight: $font-weight-regular;
		font-style: italic;
	}

	.panel__note {
		margin: 0 0 $space-2;
		padding-bottom: $space-4;
		border-bottom: 1px solid rgba($color-black, 0.12);
		font-family: $font-family-base;
		font-size: $font-size-sm;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.72);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: $space-4;
		font-family: $font-family-base;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;

		input,
		textarea {
			appearance: none;
			width: 100%;
			padding: 8px 2px;
			font: inherit;
			font-size: $font-size-base;
			color: $color-black;
			background: transparent;
			border: 0;
			border-bottom: 1px solid rgba($color-black, 0.3);
			border-radius: 0;
			transition: border-color $transition-fast;

			&::placeholder {
				color: rgba($color-black, 0.35);
			}

			&:focus {
				outline: none;
				border-bottom-color: $color-black;
			}
		}

		textarea {
			resize: vertical;
			line-height: $line-height-relaxed;
		}

		&.has-error input,
		&.has-error textarea {
			border-bottom-color: $color-error;
		}
	}

	.field__label {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: $space-2;
	}

	.field__name {
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-black, 0.8);
	}

	.opt {
		font-weight: $font-weight-regular;
		color: rgba($color-black, 0.45);
	}

	.req {
		font-style: normal;
		color: $color-error;
		margin-left: 2px;
	}

	.field__error {
		font-size: $font-size-xs;
		font-weight: $font-weight-medium;
		color: $color-error;
		letter-spacing: 0;
		text-transform: none;

		&--block {
			display: block;
			margin-top: 4px;
		}
	}

	.field__count {
		align-self: flex-end;
		font-size: $font-size-xs;
		color: rgba($color-black, 0.45);
	}

	.file {
		display: flex;
		align-items: center;
		gap: $space-3;
		padding: $space-2 0;
		cursor: pointer;
	}

	.file__input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.file__btn {
		flex: none;
		padding: 7px 16px;
		border: 1px solid $color-black;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
	}

	.file__name {
		font-size: $font-size-xs;
		color: rgba($color-black, 0.55);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: $space-3;
		cursor: pointer;

		input {
			flex: none;
			margin-top: 3px;
			width: 15px;
			height: 15px;
			accent-color: $color-black;
		}
	}

	.check__text {
		font-size: $font-size-sm;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.8);
	}

	.check-wrap.has-error .check input {
		outline: 1px solid $color-error;
	}

	.captcha-wrap {
		min-height: 65px;
	}

	:global(button.button-reveal.submit) {
		align-self: stretch;
		padding: 12px 28px;
		border: 1px solid $color-black;
		background: $color-black;
		color: $color-white;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		--reveal-ray: #{$color-black};
	}

	// Inverted panel on phone: flip the submit button to white-on-black's opposite
	@include breakpoint-down($bp-sm) {
		:global(button.button-reveal.submit) {
			border-color: $color-white;
			background: $color-white;
			color: $color-black;
			--reveal-ray: #{$color-white};
		}
	}

	.form__hint {
		margin: 0;
		font-size: $font-size-xs;
		color: rgba($color-black, 0.55);
	}

	.form__error {
		margin: 0;
		padding: $space-3;
		border: 1px solid rgba($color-error, 0.4);
		background: rgba($color-error, 0.06);
		font-size: $font-size-sm;
		line-height: $line-height-relaxed;
		color: $color-error;
	}

	.sent {
		display: flex;
		flex-direction: column;
		gap: $space-2;
		padding-top: $space-4;
		border-top: 1px solid rgba($color-black, 0.12);
	}

	.sent__line {
		margin: 0;
		font-size: $font-size-lg;
		font-style: italic;
	}

	.sent__note {
		margin: 0;
		font-family: $font-family-base;
		font-size: $font-size-sm;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.72);
	}
</style>
