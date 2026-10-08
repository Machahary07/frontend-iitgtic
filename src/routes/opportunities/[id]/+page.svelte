<script lang="ts">
	import { phoneInput } from '$lib/utils/phone';
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
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const job = $derived(data.job);
	const slug = $derived(job.slug);

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// Application panel. A submission posts to /api/job-applications, which
	// re-runs the human check server-side, stores the resume in the private
	// job-applications bucket and writes the row whoever posted the role reviews.
	const requiresOnsite = $derived(job.workMode === 'On-site');

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
		else if (!resumeExtension(resume.name)) e.resume = 'PDF only, please.';
		else if (resume.size > RESUME_MAX_BYTES) e.resume = 'Your resume must be 2 MB or smaller.';

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
	<title>{job.role} · {job.company}</title>
</svelte:head>

<section class="role">
	<LinkReveal href="/opportunities" text="← All roles" class="back" />

	<header class="head">
		<p class="tags">
			<span class="tag" class:tag--intern={job.type === 'Internship'}>{job.type}</span>
			<span class="tag tag--plain">{job.workMode}</span>
		</p>
		<h1>{job.role}</h1>
		<p class="company">{job.company}</p>
	</header>

	<dl class="facts">
		<div>
			<dt>Location</dt>
			<dd>{job.location}</dd>
		</div>
		{#if job.pay}
			<div>
				<dt>Pay</dt>
				<dd>{job.pay}</dd>
			</div>
		{/if}
		{#if job.sector}
			<div>
				<dt>Sector</dt>
				<dd>{job.sector}</dd>
			</div>
		{/if}
		<div>
			<dt>{job.closesOn ? 'Apply by' : 'Posted'}</dt>
			<dd>{formatDate(job.closesOn ?? job.posted)}</dd>
		</div>
	</dl>

	<p class="description">{job.description}</p>

	<div class="apply" id="apply">
		<h2>Apply</h2>

		{#if sent}
			<div class="sent">
				<p class="sent__line">Application sent.</p>
				<p class="sent__note">
					{job.company} has it. If they want to take it further they will write to {email}.
				</p>
			</div>
		{:else}
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
					<input type="tel" bind:value={phone} autocomplete="tel" use:phoneInput />
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
						<span class="file__name">{resume ? resume.name : 'PDF, up to 2 MB'}</span>
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
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	$color-error: #d62828;

	.role {
		width: min(100%, 760px);
		margin: 0 auto;
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) $space-6 $space-10;
		color: $color-black;
		font-family: $font-family-base;

		@include breakpoint-down($bp-sm) {
			padding: calc(var(--page-shell-top, 100px) + #{$space-6}) $space-4 $space-8;
		}
	}

	:global(.back) {
		@include eyebrow;
		color: $color-black;
	}

	.head {
		margin: $space-6 0 $space-6;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: $space-2;
		margin: 0 0 $space-4;
	}

	.tag {
		padding: 4px 10px;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-xs;
		font-weight: $font-weight-bold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border-radius: $radius-sm;

		&--intern {
			background: $color-primary-green;
		}

		&--plain {
			background: transparent;
			color: $color-black;
			box-shadow: inset 0 0 0 1px $color-black;
		}
	}

	h1 {
		margin: 0;
		font-size: clamp(2.25rem, 7vw, 3.5rem);
		font-weight: $font-weight-black;
		line-height: 1.02;
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}

	.company {
		margin: $space-3 0 0;
		font-size: $font-size-xl;
		font-weight: $font-weight-bold;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: $space-4;
		margin: 0;
		padding: $space-5 0;
		border-top: 2px solid $color-black;
		border-bottom: 1px solid rgba($color-black, 0.12);

		dt {
			font-size: $font-size-xs;
			font-weight: $font-weight-bold;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			color: rgba($color-black, 0.55);
		}

		dd {
			margin: 4px 0 0;
			font-size: $font-size-md;
			font-weight: $font-weight-semibold;
			overflow-wrap: anywhere;
		}
	}

	.description {
		margin: $space-6 0 0;
		font-size: $font-size-lg;
		line-height: 1.65;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.apply {
		margin-top: $space-9;
		padding-top: $space-6;
		border-top: 2px solid $color-black;

		h2 {
			margin: 0 0 $space-5;
			font-size: clamp(1.75rem, 5vw, 2.5rem);
			font-weight: $font-weight-black;
			letter-spacing: -0.01em;
		}
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;

		input,
		textarea {
			appearance: none;
			width: 100%;
			padding: 10px 2px;
			font: inherit;
			font-size: $font-size-md;
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
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
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
	}

	.sent__line {
		margin: 0;
		font-size: $font-size-2xl;
		font-weight: $font-weight-black;
	}

	.sent__note {
		margin: 0;
		font-size: $font-size-md;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.72);
	}
</style>
