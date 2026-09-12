<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import ButtonReveal from '$lib/components/ButtonReveal.svelte';
	import { loadUserSession, sendFounderWelcome } from '$lib/utils/userSession';
	import { submitApplication, notifyApplicationSubmitted } from '$lib/utils/applications';
	import { clearDraft, loadDraft, saveDraft, savedAgo } from '$lib/utils/applicationDraft';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	// The wizard is rendered in two places: on its own at /application, and inside
	// the founder console at /founder/application. `embedded` drops the standalone
	// page chrome — the navbar clearance and the centring — so it sits flush in
	// the console's content column.
	let { embedded = false }: { embedded?: boolean } = $props();

	const STEPS = [
		{ n: 1, title: 'Founder Info' },
		{ n: 2, title: 'Startup Basics' },
		{ n: 3, title: 'Problem & Solution' },
		{ n: 4, title: 'Product & Traction' },
		{ n: 5, title: 'Business & Funding' },
		{ n: 6, title: 'Incubation' },
		{ n: 7, title: 'Documents' },
		{ n: 8, title: 'Consent' }
	];

	const STAGES = ['Idea', 'Prototype', 'MVP', 'Revenue', 'Scaling'];
	const FUNDING_STATUS = ['Bootstrapped', 'Funded'];
	const SUPPORT_OPTIONS = [
		'Mentorship',
		'Funding access',
		'Office space / Infrastructure',
		'Technical guidance',
		'Legal & IP support',
		'Market access / Networking',
		'Investor connects',
		'Recruitment support'
	];

	type CoFounder = { name: string; email: string; role: string };

	type FormData = {
		// Step 1
		fullName: string;
		email: string;
		phone: string;
		role: string;
		location: string;
		university: string;
		linkedin: string;
		coFounders: CoFounder[];
		// Step 2
		startupName: string;
		stage: string;
		industry: string;
		yearFounded: string;
		teamSize: string;
		website: string;
		incorporation: string;
		// Step 3
		problem: string;
		solution: string;
		differentiation: string;
		whyNow: string;
		// Step 4
		productDescription: string;
		techStack: string;
		targetCustomers: string;
		users: string;
		revenue: string;
		demoLink: string;
		partnerships: string;
		// Step 5
		revenueModel: string;
		gtmStrategy: string;
		fundingStatus: string;
		investmentRequired: string;
		useOfFunds: string;
		competitors: string;
		previousFunding: string;
		// Step 6
		whyTic: string;
		expectedOutcomes: string;
		biggestChallenge: string;
		longTermVision: string;
		supportNeeded: string[];
		// Step 7
		pitchDeck: File | null;
		founderCv: File | null;
		financialProjections: File | null;
		incorporationCert: File | null;
		// Step 8
		infoAccurate: boolean;
		agreeTerms: boolean;
		allowReview: boolean;
	};

	let step = $state(1);
	let attempted = $state(false);
	let submitted = $state(false);
	let submittedId = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	// Email-confirmation gate for step 8. Defaults to true so the consent boxes are
	// never blocked before the session has loaded, or if the flag cannot be read.
	let emailVerified = $state(true);
	let resending = $state(false);
	let resent = $state(false);
	let errors = $state<Record<string, string>>({});
	let completedSteps = $state(new Set<number>());

	// Draft state. `draftReady` gates the autosave: without it the first effect
	// run would write the empty initial form over a saved draft before onMount
	// has had a chance to restore it.
	let userId = $state('');
	let draftReady = $state(false);
	let restoredFrom = $state('');

	const data = $state<FormData>({
		fullName: '',
		email: '',
		phone: '',
		role: '',
		location: '',
		university: '',
		linkedin: '',
		coFounders: [],
		startupName: '',
		stage: '',
		industry: '',
		yearFounded: '',
		teamSize: '',
		website: '',
		incorporation: '',
		problem: '',
		solution: '',
		differentiation: '',
		whyNow: '',
		productDescription: '',
		techStack: '',
		targetCustomers: '',
		users: '',
		revenue: '',
		demoLink: '',
		partnerships: '',
		revenueModel: '',
		gtmStrategy: '',
		fundingStatus: '',
		investmentRequired: '',
		useOfFunds: '',
		competitors: '',
		previousFunding: '',
		whyTic: '',
		expectedOutcomes: '',
		biggestChallenge: '',
		longTermVision: '',
		supportNeeded: [],
		pitchDeck: null,
		founderCv: null,
		financialProjections: null,
		incorporationCert: null,
		infoAccurate: false,
		agreeTerms: false,
		allowReview: false
	});

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const URL_RE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;

	function requireText(value: string, label: string) {
		if (!value.trim()) return `${label} is required.`;
		return '';
	}

	function validateStep(s: number): Record<string, string> {
		const e: Record<string, string> = {};
		if (s === 1) {
			e.fullName = requireText(data.fullName, 'Full name');
			if (!data.email.trim()) e.email = 'Email is required.';
			else if (!EMAIL_RE.test(data.email.trim())) e.email = 'Enter a valid email address.';
			const digits = data.phone.replace(/\D/g, '');
			if (!data.phone.trim()) e.phone = 'Phone number is required.';
			else if (digits.length !== 10) e.phone = 'Phone must be exactly 10 digits.';
			e.role = requireText(data.role, 'Role in startup');
			e.location = requireText(data.location, 'City / Country');
			e.university = requireText(data.university, 'University / Organization');
			if (data.linkedin && !URL_RE.test(data.linkedin.trim())) {
				e.linkedin = 'Enter a valid URL.';
			}
		} else if (s === 2) {
			e.startupName = requireText(data.startupName, 'Startup name');
			e.stage = requireText(data.stage, 'Startup stage');
			e.industry = requireText(data.industry, 'Industry / Domain');
			if (!data.yearFounded.trim()) e.yearFounded = 'Year founded is required.';
			else if (
				!/^\d{4}$/.test(data.yearFounded) ||
				+data.yearFounded < 1900 ||
				+data.yearFounded > new Date().getFullYear()
			) {
				e.yearFounded = 'Enter a valid 4-digit year.';
			}
			if (!data.teamSize.trim()) e.teamSize = 'Team size is required.';
			else if (!/^\d+$/.test(data.teamSize) || +data.teamSize < 1)
				e.teamSize = 'Enter a valid team size.';
			if (data.website && !URL_RE.test(data.website.trim())) e.website = 'Enter a valid URL.';
		} else if (s === 3) {
			e.problem = requireText(data.problem, 'Problem statement');
			e.solution = requireText(data.solution, 'Your solution');
			e.differentiation = requireText(data.differentiation, 'Differentiation');
			e.whyNow = requireText(data.whyNow, 'Why now');
		} else if (s === 4) {
			e.productDescription = requireText(data.productDescription, 'Product description');
			e.techStack = requireText(data.techStack, 'Tech stack');
			e.targetCustomers = requireText(data.targetCustomers, 'Target customers');
			if (data.demoLink && !URL_RE.test(data.demoLink.trim())) e.demoLink = 'Enter a valid URL.';
		} else if (s === 5) {
			e.revenueModel = requireText(data.revenueModel, 'Revenue model');
			e.gtmStrategy = requireText(data.gtmStrategy, 'Go-to-market strategy');
			e.fundingStatus = requireText(data.fundingStatus, 'Funding status');
			e.investmentRequired = requireText(data.investmentRequired, 'Investment required');
			e.useOfFunds = requireText(data.useOfFunds, 'Use of funds');
		} else if (s === 6) {
			e.whyTic = requireText(data.whyTic, 'Why IITG TIC');
			e.expectedOutcomes = requireText(data.expectedOutcomes, 'Expected outcomes');
			e.biggestChallenge = requireText(data.biggestChallenge, 'Biggest current challenge');
			if (data.supportNeeded.length === 0) e.supportNeeded = 'Select at least one option.';
		} else if (s === 7) {
			if (!data.pitchDeck) e.pitchDeck = 'Pitch deck is required.';
			else if (data.pitchDeck.type !== 'application/pdf') e.pitchDeck = 'Upload a PDF file.';
		} else if (s === 8) {
			if (!data.infoAccurate) e.infoAccurate = 'Please confirm the information is accurate.';
			if (!data.agreeTerms) e.agreeTerms = 'You must agree to the terms.';
			if (!data.allowReview) e.allowReview = 'You must allow evaluation review.';
		}

		Object.keys(e).forEach((k) => {
			if (!e[k]) delete e[k];
		});
		return e;
	}

	function revalidate() {
		if (attempted) errors = validateStep(step);
	}

	function onPhoneInput(ev: Event) {
		const input = ev.currentTarget as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '').slice(0, 10);
		data.phone = digits;
		input.value = digits;
		revalidate();
	}

	function toggleSupport(option: string) {
		const idx = data.supportNeeded.indexOf(option);
		if (idx === -1) data.supportNeeded.push(option);
		else data.supportNeeded.splice(idx, 1);
		revalidate();
	}

	function addCoFounder() {
		data.coFounders.push({ name: '', email: '', role: '' });
	}

	function removeCoFounder(i: number) {
		data.coFounders.splice(i, 1);
	}

	function onFile(field: keyof FormData, ev: Event) {
		const input = ev.currentTarget as HTMLInputElement;
		const file = input.files && input.files[0] ? input.files[0] : null;
		(data as Record<string, unknown>)[field as string] = file;
		revalidate();
	}

	// Every step's required fields, checked in one pass. The stepper lets an
	// applicant jump straight to step 8, so validating only the current step on
	// submit would let a half-empty application through — this is what closes that.
	function firstIncompleteStep(): number | null {
		for (const s of STEPS) {
			if (Object.keys(validateStep(s.n)).length > 0) return s.n;
		}
		return null;
	}

	// Keeps the progress dots honest after a jump or a submit attempt: a step is
	// "done" when it actually validates, not merely because it was walked past.
	function syncCompletedSteps() {
		const done = new Set<number>();
		for (const s of STEPS) {
			if (Object.keys(validateStep(s.n)).length === 0) done.add(s.n);
		}
		completedSteps = done;
	}

	function next() {
		attempted = true;
		const e = validateStep(step);
		errors = e;
		if (Object.keys(e).length === 0) {
			completedSteps = new Set(completedSteps).add(step);
			step += 1;
			attempted = false;
			errors = {};
			submitError = '';
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function prev() {
		if (step > 1) {
			step -= 1;
			attempted = false;
			errors = {};
			submitError = '';
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	async function resendConfirmation() {
		if (resending) return;
		resending = true;
		resent = false;
		await sendFounderWelcome();
		resending = false;
		resent = true;
	}

	async function submit() {
		attempted = true;

		// The consent step first, so its own boxes report on the step the applicant
		// is looking at rather than being masked by an earlier jump.
		const e = validateStep(step);
		errors = e;
		if (Object.keys(e).length > 0) return;

		// Then every other step. Anything still missing sends the applicant back to
		// the first step that needs it, with that step's errors already showing.
		const incomplete = firstIncompleteStep();
		if (incomplete !== null) {
			syncCompletedSteps();
			step = incomplete;
			errors = validateStep(incomplete);
			submitError = `Step ${incomplete} — ${STEPS[incomplete - 1].title} still has required fields to fill in.`;
			window.scrollTo({ top: 0, behavior: 'smooth' });
			return;
		}

		// The address must be confirmed before an application can be submitted. This
		// is the friendly gate; the RLS insert policy is the real one, so bypassing
		// the client still cannot write an application from an unverified account.
		if (!emailVerified) {
			submitError = 'Please confirm your email before submitting — check your inbox for the link.';
			return;
		}

		submitting = true;
		submitError = '';
		const result = await submitApplication(
			{ ...data },
			{
				pitchDeck: data.pitchDeck,
				founderCv: data.founderCv,
				financialProjections: data.financialProjections,
				incorporationCert: data.incorporationCert
			}
		);
		submitting = false;

		if (!result.ok) {
			submitError = result.error;
			return;
		}

		completedSteps = new Set(completedSteps).add(step);
		submitted = true;
		submittedId = result.id;
		// The row in public.applications is the record now, so the draft is done.
		clearDraft(userId);
		restoredFrom = '';
		// Fire-and-forget: the receipt email must not hold up or fail the submit.
		void notifyApplicationSubmitted(result.id);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function jumpToStep(n: number) {
		if (n === step) return;
		syncCompletedSteps();
		step = n;
		attempted = false;
		errors = {};
		submitError = '';
	}

	function goSignUp() {
		goto(resolve('/apply'));
	}

	function viewApplication() {
		// Runtime path carrying the new application's id, so there is no route id to
		// resolve it against.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`/account/${submittedId}`);
	}

	async function discardDraft() {
		const ok = await askConfirm({
			title: 'Start this application again?',
			body: 'The saved draft is discarded and every step goes back to empty.',
			confirmLabel: 'Discard draft',
			tone: 'danger'
		});
		if (!ok) return;
		clearDraft(userId);
		restoredFrom = '';
		location.reload();
	}

	onMount(async () => {
		const session = await loadUserSession();
		if (!session.id) {
			// The application is tied to an account. Anonymous visitors sign in
			// first and are brought straight back to it.
			// A path on this site with a query string, which resolve() cannot express.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/login?next=/founder/application');
			return;
		}
		emailVerified = session.emailVerified ?? true;
		if (session.name && !data.fullName) data.fullName = session.name;
		if (session.email && !data.email) data.email = session.email;
		if (session.phone && !data.phone) {
			const digits = session.phone.replace(/\D/g, '').slice(0, 10);
			data.phone = digits;
		}

		// The draft wins over the profile prefill: what someone typed is more
		// current than what their account happens to hold.
		userId = session.id;
		const draft = loadDraft(userId);
		if (draft) {
			for (const [key, value] of Object.entries(draft.values)) {
				if (key in data) (data as Record<string, unknown>)[key] = value;
			}
			step = Math.min(Math.max(draft.step, 1), STEPS.length);
			completedSteps = new Set(draft.completedSteps ?? []);
			restoredFrom = draft.savedAt;
		}

		draftReady = true;
	});

	// Autosaved on every change. Reading the serialised form inside the effect is
	// what subscribes it to all forty fields without listing them.
	$effect(() => {
		if (!draftReady || !userId || submitted) return;
		const snapshot = { ...data };
		void JSON.stringify({ snapshot, step, completed: [...completedSteps] });
		saveDraft(userId, snapshot as Record<string, unknown>, step, [...completedSteps]);
	});
</script>

<section class="app" class:app--embedded={embedded}>
	<div class="app__inner">
		{#if submitted}
			<div class="success" role="status" aria-live="polite">
				<h1 class="success__title">Your application has been submitted</h1>
				<p class="success__body">
					Thank you for applying to IITG TIC. Our team will review your submission and respond to <strong
						>{data.email}</strong
					> within 2 to 5 working days.
				</p>
				<p class="success__meta">
					Please keep an eye on your inbox for any follow-up questions during review. We have also
					emailed you a link to view your application.
				</p>
				<div class="success__actions">
					<ButtonReveal text="View your application" class="view" onclick={viewApplication} />
					<ButtonReveal text="Back to home" class="btn btn--ghost" onclick={goSignUp} />
				</div>
			</div>
		{:else}
			<header class="app__header">
				<div class="app__header-text">
					<h1>Apply to IITG TIC</h1>
					<p class="app__sub">
						Complete all 8 steps to submit your application. Your answers are saved on this device
						as you go, so you can close this and come back.
					</p>
				</div>
			</header>

			{#if restoredFrom}
				<div class="draft" role="status">
					<p class="draft__text">
						Picked up where you left off — saved {savedAgo(restoredFrom)}. Your uploads and the
						final consent boxes are not saved and will need doing again.
					</p>
					<button type="button" class="draft__discard" onclick={discardDraft}> Start over </button>
				</div>
			{/if}

			<!-- Progress bar -->
			<div class="progress" aria-label="Application progress">
				<div class="progress__steps">
					{#each STEPS as s, i (s.n)}
						{#if i > 0}
							<div class="progress__line" class:is-done={completedSteps.has(s.n - 1)}></div>
						{/if}
						<button
							type="button"
							class="progress__step"
							class:is-done={completedSteps.has(s.n)}
							class:is-current={s.n === step}
							onclick={() => jumpToStep(s.n)}
						>
							<span class="progress__dot">{s.n}</span>
							<span class="progress__label">{s.title}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="step">
				<p class="step__eyebrow">Step {step} of {STEPS.length}</p>
				<h2 class="step__title">{STEPS[step - 1].title}</h2>

				<form
					class="form"
					onsubmit={(e) => {
						e.preventDefault();
						if (step === STEPS.length) submit();
						else next();
					}}
					novalidate
				>
					{#if step === 1}
						<label class="field" class:has-error={errors.fullName}>
							<span class="field__label">
								<span class="field__name">Full name <em class="req">*</em></span>
								{#if errors.fullName}<span class="field__error">{errors.fullName}</span>{/if}
							</span>
							<input type="text" bind:value={data.fullName} oninput={revalidate} />
						</label>

						<label class="field" class:has-error={errors.email}>
							<span class="field__label">
								<span class="field__name">Email address <em class="req">*</em></span>
								{#if errors.email}<span class="field__error">{errors.email}</span>{/if}
							</span>
							<input type="email" bind:value={data.email} oninput={revalidate} />
						</label>

						<label class="field" class:has-error={errors.phone}>
							<span class="field__label">
								<span class="field__name">Phone number <em class="req">*</em></span>
								{#if errors.phone}<span class="field__error">{errors.phone}</span>{/if}
							</span>
							<input
								type="tel"
								inputmode="numeric"
								maxlength="10"
								value={data.phone}
								oninput={onPhoneInput}
							/>
						</label>

						<label class="field" class:has-error={errors.role}>
							<span class="field__label">
								<span class="field__name">Role in startup <em class="req">*</em></span>
								{#if errors.role}<span class="field__error">{errors.role}</span>{/if}
							</span>
							<input
								type="text"
								bind:value={data.role}
								oninput={revalidate}
								placeholder="e.g. CEO, CTO"
							/>
						</label>

						<div class="form__row">
							<label class="field" class:has-error={errors.location}>
								<span class="field__label">
									<span class="field__name">City / Country <em class="req">*</em></span>
									{#if errors.location}<span class="field__error">{errors.location}</span>{/if}
								</span>
								<input type="text" bind:value={data.location} oninput={revalidate} />
							</label>
							<label class="field" class:has-error={errors.university}>
								<span class="field__label">
									<span class="field__name">University / Organization <em class="req">*</em></span>
									{#if errors.university}<span class="field__error">{errors.university}</span>{/if}
								</span>
								<input type="text" bind:value={data.university} oninput={revalidate} />
							</label>
						</div>

						<label class="field" class:has-error={errors.linkedin}>
							<span class="field__label">
								<span class="field__name">LinkedIn profile <span class="opt">(optional)</span></span
								>
								{#if errors.linkedin}<span class="field__error">{errors.linkedin}</span>{/if}
							</span>
							<input
								type="url"
								bind:value={data.linkedin}
								oninput={revalidate}
								placeholder="https://linkedin.com/in/..."
							/>
						</label>

						<div class="field">
							<span class="field__label">
								<span class="field__name"
									>Co-founder details <span class="opt">(optional)</span></span
								>
							</span>
							{#each data.coFounders as cf, i (i)}
								<div class="cf">
									<input type="text" class="cf__input" placeholder="Name" bind:value={cf.name} />
									<input type="email" class="cf__input" placeholder="Email" bind:value={cf.email} />
									<input type="text" class="cf__input" placeholder="Role" bind:value={cf.role} />
									<button
										type="button"
										class="cf__remove"
										onclick={() => removeCoFounder(i)}
										aria-label="Remove co-founder">×</button
									>
								</div>
							{/each}
							<ButtonReveal
								text="+ Add co-founder"
								class="btn btn--ghost btn--sm"
								onclick={addCoFounder}
							/>
						</div>
					{/if}

					{#if step === 2}
						<label class="field" class:has-error={errors.startupName}>
							<span class="field__label">
								<span class="field__name">Startup name <em class="req">*</em></span>
								{#if errors.startupName}<span class="field__error">{errors.startupName}</span>{/if}
							</span>
							<input type="text" bind:value={data.startupName} oninput={revalidate} />
						</label>

						<label class="field" class:has-error={errors.stage}>
							<span class="field__label">
								<span class="field__name">Startup stage <em class="req">*</em></span>
								{#if errors.stage}<span class="field__error">{errors.stage}</span>{/if}
							</span>
							<div class="radio-group">
								{#each STAGES as s}
									<label class="radio">
										<input
											type="radio"
											name="stage"
											value={s}
											checked={data.stage === s}
											onchange={() => {
												data.stage = s;
												revalidate();
											}}
										/>
										<span class="radio__dot"></span>
										<span>{s}</span>
									</label>
								{/each}
							</div>
						</label>

						<div class="form__row">
							<label class="field" class:has-error={errors.industry}>
								<span class="field__label">
									<span class="field__name">Industry / Domain <em class="req">*</em></span>
									{#if errors.industry}<span class="field__error">{errors.industry}</span>{/if}
								</span>
								<input type="text" bind:value={data.industry} oninput={revalidate} />
							</label>
							<label class="field" class:has-error={errors.yearFounded}>
								<span class="field__label">
									<span class="field__name">Year founded <em class="req">*</em></span>
									{#if errors.yearFounded}<span class="field__error">{errors.yearFounded}</span
										>{/if}
								</span>
								<input
									type="text"
									inputmode="numeric"
									maxlength="4"
									bind:value={data.yearFounded}
									oninput={revalidate}
								/>
							</label>
						</div>

						<div class="form__row">
							<label class="field" class:has-error={errors.teamSize}>
								<span class="field__label">
									<span class="field__name">Team size <em class="req">*</em></span>
									{#if errors.teamSize}<span class="field__error">{errors.teamSize}</span>{/if}
								</span>
								<input
									type="text"
									inputmode="numeric"
									bind:value={data.teamSize}
									oninput={revalidate}
								/>
							</label>
							<label class="field" class:has-error={errors.website}>
								<span class="field__label">
									<span class="field__name">Website URL <span class="opt">(optional)</span></span>
									{#if errors.website}<span class="field__error">{errors.website}</span>{/if}
								</span>
								<input type="url" bind:value={data.website} oninput={revalidate} />
							</label>
						</div>

						<label class="field">
							<span class="field__label">
								<span class="field__name"
									>Incorporation status <span class="opt">(optional)</span></span
								>
							</span>
							<input
								type="text"
								bind:value={data.incorporation}
								placeholder="e.g. Pvt. Ltd., LLP, not yet incorporated"
							/>
						</label>
					{/if}

					{#if step === 3}
						<label class="field" class:has-error={errors.problem}>
							<span class="field__label">
								<span class="field__name">Problem statement <em class="req">*</em></span>
								{#if errors.problem}<span class="field__error">{errors.problem}</span>{/if}
							</span>
							<textarea rows="3" bind:value={data.problem} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.solution}>
							<span class="field__label">
								<span class="field__name">Your solution <em class="req">*</em></span>
								{#if errors.solution}<span class="field__error">{errors.solution}</span>{/if}
							</span>
							<textarea rows="3" bind:value={data.solution} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.differentiation}>
							<span class="field__label">
								<span class="field__name">What makes you different? <em class="req">*</em></span>
								{#if errors.differentiation}<span class="field__error"
										>{errors.differentiation}</span
									>{/if}
							</span>
							<textarea rows="3" bind:value={data.differentiation} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.whyNow}>
							<span class="field__label">
								<span class="field__name">Why now? <em class="req">*</em></span>
								{#if errors.whyNow}<span class="field__error">{errors.whyNow}</span>{/if}
							</span>
							<textarea rows="3" bind:value={data.whyNow} oninput={revalidate}></textarea>
						</label>
					{/if}

					{#if step === 4}
						<label class="field" class:has-error={errors.productDescription}>
							<span class="field__label">
								<span class="field__name">Product description <em class="req">*</em></span>
								{#if errors.productDescription}<span class="field__error"
										>{errors.productDescription}</span
									>{/if}
							</span>
							<textarea rows="3" bind:value={data.productDescription} oninput={revalidate}
							></textarea>
						</label>

						<label class="field" class:has-error={errors.techStack}>
							<span class="field__label">
								<span class="field__name">Tech stack <em class="req">*</em></span>
								{#if errors.techStack}<span class="field__error">{errors.techStack}</span>{/if}
							</span>
							<input type="text" bind:value={data.techStack} oninput={revalidate} />
						</label>

						<label class="field" class:has-error={errors.targetCustomers}>
							<span class="field__label">
								<span class="field__name">Target customers <em class="req">*</em></span>
								{#if errors.targetCustomers}<span class="field__error"
										>{errors.targetCustomers}</span
									>{/if}
							</span>
							<textarea rows="2" bind:value={data.targetCustomers} oninput={revalidate}></textarea>
						</label>

						<div class="form__row">
							<label class="field">
								<span class="field__label">
									<span class="field__name"
										>Users / customers <span class="opt">(optional)</span></span
									>
								</span>
								<input type="text" bind:value={data.users} />
							</label>
							<label class="field">
								<span class="field__label">
									<span class="field__name"
										>Revenue generated <span class="opt">(optional)</span></span
									>
								</span>
								<input type="text" bind:value={data.revenue} />
							</label>
						</div>

						<label class="field" class:has-error={errors.demoLink}>
							<span class="field__label">
								<span class="field__name"
									>Demo / GitHub link <span class="opt">(optional)</span></span
								>
								{#if errors.demoLink}<span class="field__error">{errors.demoLink}</span>{/if}
							</span>
							<input type="url" bind:value={data.demoLink} oninput={revalidate} />
						</label>

						<label class="field">
							<span class="field__label">
								<span class="field__name"
									>Partnerships or pilots <span class="opt">(optional)</span></span
								>
							</span>
							<textarea rows="2" bind:value={data.partnerships}></textarea>
						</label>
					{/if}

					{#if step === 5}
						<label class="field" class:has-error={errors.revenueModel}>
							<span class="field__label">
								<span class="field__name">Revenue model <em class="req">*</em></span>
								{#if errors.revenueModel}<span class="field__error">{errors.revenueModel}</span
									>{/if}
							</span>
							<textarea rows="2" bind:value={data.revenueModel} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.gtmStrategy}>
							<span class="field__label">
								<span class="field__name">Go-to-market strategy <em class="req">*</em></span>
								{#if errors.gtmStrategy}<span class="field__error">{errors.gtmStrategy}</span>{/if}
							</span>
							<textarea rows="2" bind:value={data.gtmStrategy} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.fundingStatus}>
							<span class="field__label">
								<span class="field__name">Funding status <em class="req">*</em></span>
								{#if errors.fundingStatus}<span class="field__error">{errors.fundingStatus}</span
									>{/if}
							</span>
							<div class="radio-group">
								{#each FUNDING_STATUS as s}
									<label class="radio">
										<input
											type="radio"
											name="fundingStatus"
											value={s}
											checked={data.fundingStatus === s}
											onchange={() => {
												data.fundingStatus = s;
												revalidate();
											}}
										/>
										<span class="radio__dot"></span>
										<span>{s}</span>
									</label>
								{/each}
							</div>
						</label>

						<div class="form__row">
							<label class="field" class:has-error={errors.investmentRequired}>
								<span class="field__label">
									<span class="field__name">Investment required <em class="req">*</em></span>
									{#if errors.investmentRequired}<span class="field__error"
											>{errors.investmentRequired}</span
										>{/if}
								</span>
								<input
									type="text"
									bind:value={data.investmentRequired}
									oninput={revalidate}
									placeholder="₹"
								/>
							</label>
							<label class="field">
								<span class="field__label">
									<span class="field__name"
										>Previous funding raised <span class="opt">(optional)</span></span
									>
								</span>
								<input type="text" bind:value={data.previousFunding} />
							</label>
						</div>

						<label class="field" class:has-error={errors.useOfFunds}>
							<span class="field__label">
								<span class="field__name">Use of funds <em class="req">*</em></span>
								{#if errors.useOfFunds}<span class="field__error">{errors.useOfFunds}</span>{/if}
							</span>
							<textarea rows="2" bind:value={data.useOfFunds} oninput={revalidate}></textarea>
						</label>

						<label class="field">
							<span class="field__label">
								<span class="field__name">Competitors <span class="opt">(optional)</span></span>
							</span>
							<textarea rows="2" bind:value={data.competitors}></textarea>
						</label>
					{/if}

					{#if step === 6}
						<label class="field" class:has-error={errors.whyTic}>
							<span class="field__label">
								<span class="field__name">Why IITG TIC? <em class="req">*</em></span>
								{#if errors.whyTic}<span class="field__error">{errors.whyTic}</span>{/if}
							</span>
							<textarea rows="3" bind:value={data.whyTic} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.expectedOutcomes}>
							<span class="field__label">
								<span class="field__name">Expected outcomes <em class="req">*</em></span>
								{#if errors.expectedOutcomes}<span class="field__error"
										>{errors.expectedOutcomes}</span
									>{/if}
							</span>
							<textarea rows="3" bind:value={data.expectedOutcomes} oninput={revalidate}></textarea>
						</label>

						<label class="field" class:has-error={errors.biggestChallenge}>
							<span class="field__label">
								<span class="field__name">Biggest current challenge <em class="req">*</em></span>
								{#if errors.biggestChallenge}<span class="field__error"
										>{errors.biggestChallenge}</span
									>{/if}
							</span>
							<textarea rows="2" bind:value={data.biggestChallenge} oninput={revalidate}></textarea>
						</label>

						<label class="field">
							<span class="field__label">
								<span class="field__name">Long-term vision <span class="opt">(optional)</span></span
								>
							</span>
							<textarea rows="2" bind:value={data.longTermVision}></textarea>
						</label>

						<div class="field" class:has-error={errors.supportNeeded}>
							<span class="field__label">
								<span class="field__name">Support needed <em class="req">*</em></span>
								{#if errors.supportNeeded}<span class="field__error">{errors.supportNeeded}</span
									>{/if}
							</span>
							<div class="check-group">
								{#each SUPPORT_OPTIONS as option}
									<label class="check">
										<input
											type="checkbox"
											checked={data.supportNeeded.includes(option)}
											onchange={() => toggleSupport(option)}
										/>
										<span class="check__box"></span>
										<span>{option}</span>
									</label>
								{/each}
							</div>
						</div>
					{/if}

					{#if step === 7}
						<div class="field" class:has-error={errors.pitchDeck}>
							<span class="field__label">
								<span class="field__name">Pitch deck PDF <em class="req">*</em></span>
								{#if errors.pitchDeck}<span class="field__error">{errors.pitchDeck}</span>{/if}
							</span>
							<label class="file">
								<input
									type="file"
									accept="application/pdf"
									onchange={(e) => onFile('pitchDeck', e)}
								/>
								<span class="file__btn">Choose file</span>
								<span class="file__name"
									>{data.pitchDeck ? data.pitchDeck.name : 'No file selected'}</span
								>
							</label>
						</div>

						<div class="field">
							<span class="field__label">
								<span class="field__name">Founder CV <span class="opt">(optional)</span></span>
							</span>
							<label class="file">
								<input
									type="file"
									accept=".pdf,.doc,.docx"
									onchange={(e) => onFile('founderCv', e)}
								/>
								<span class="file__btn">Choose file</span>
								<span class="file__name"
									>{data.founderCv ? data.founderCv.name : 'No file selected'}</span
								>
							</label>
						</div>

						<div class="field">
							<span class="field__label">
								<span class="field__name"
									>Financial projections <span class="opt">(optional)</span></span
								>
							</span>
							<label class="file">
								<input
									type="file"
									accept=".pdf,.xlsx,.xls"
									onchange={(e) => onFile('financialProjections', e)}
								/>
								<span class="file__btn">Choose file</span>
								<span class="file__name"
									>{data.financialProjections
										? data.financialProjections.name
										: 'No file selected'}</span
								>
							</label>
						</div>

						<div class="field">
							<span class="field__label">
								<span class="field__name"
									>Incorporation certificate <span class="opt">(optional)</span></span
								>
							</span>
							<label class="file">
								<input
									type="file"
									accept="application/pdf"
									onchange={(e) => onFile('incorporationCert', e)}
								/>
								<span class="file__btn">Choose file</span>
								<span class="file__name"
									>{data.incorporationCert ? data.incorporationCert.name : 'No file selected'}</span
								>
							</label>
						</div>
					{/if}

					{#if step === 8}
						{#if !emailVerified}
							<div class="verify-gate" role="status" aria-live="polite">
								<p class="verify-gate__text">
									Confirm your email to submit. We sent a confirmation link to
									<strong>{data.email}</strong>. Open it, then come back to this step.
								</p>
								<ButtonReveal
									text={resending ? 'Sending…' : 'Resend confirmation email'}
									class="resend"
									loading={resending}
									onclick={resendConfirmation}
								/>
								{#if resent}<span class="verify-gate__done">Sent — check your inbox.</span>{/if}
							</div>
						{/if}
						<div class="consent-list" class:consent-list--locked={!emailVerified}>
							<label class="consent" class:has-error={errors.infoAccurate}>
								<input
									type="checkbox"
									bind:checked={data.infoAccurate}
									onchange={revalidate}
									disabled={!emailVerified}
								/>
								<span class="check__box"></span>
								<span class="consent__text">
									I confirm that all information provided is accurate to the best of my knowledge. <em
										class="req">*</em
									>
									{#if errors.infoAccurate}<span class="field__error field__error--block"
											>{errors.infoAccurate}</span
										>{/if}
								</span>
							</label>

							<label class="consent" class:has-error={errors.agreeTerms}>
								<input
									type="checkbox"
									bind:checked={data.agreeTerms}
									onchange={revalidate}
									disabled={!emailVerified}
								/>
								<span class="check__box"></span>
								<span class="consent__text">
									I agree to the IITG TIC application terms and privacy policy. <em class="req"
										>*</em
									>
									{#if errors.agreeTerms}<span class="field__error field__error--block"
											>{errors.agreeTerms}</span
										>{/if}
								</span>
							</label>

							<label class="consent" class:has-error={errors.allowReview}>
								<input
									type="checkbox"
									bind:checked={data.allowReview}
									onchange={revalidate}
									disabled={!emailVerified}
								/>
								<span class="check__box"></span>
								<span class="consent__text">
									I allow the IITG TIC evaluation committee to review my application and documents. <em
										class="req">*</em
									>
									{#if errors.allowReview}<span class="field__error field__error--block"
											>{errors.allowReview}</span
										>{/if}
								</span>
							</label>
						</div>
					{/if}

					{#if submitError}
						<p class="submit-error" role="alert">{submitError}</p>
					{/if}

					<div class="nav">
						{#if step > 1}
							<ButtonReveal text="← Previous" class="btn btn--ghost" onclick={prev} />
						{/if}
						{#if step < STEPS.length}
							<ButtonReveal type="submit" text="Next →" class="btn btn--primary nav__next" />
						{:else}
							<ButtonReveal
								type="submit"
								text={submitting ? 'Submitting…' : 'Submit application'}
								class="btn btn--primary nav__next"
								loading={submitting}
							/>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</div>
</section>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/mixins' as *;

	$color-error: #d62828;

	.app {
		min-height: 100svh;
		background: $color-white;
		color: $color-black;
		// Clear the fixed event bar + navbar before the content starts.
		padding: calc(var(--page-shell-top, 104px) + #{$space-8}) 0 $space-9;

		@include breakpoint-down($bp-sm) {
			padding-top: calc(var(--page-shell-top, 100px) + #{$space-6});
		}
	}

	// Inside the console the shell already supplies the ground, the page header
	// and the gutters, so the wizard gives all three back.
	.app--embedded {
		min-height: 0;
		padding: 0;
		background: transparent;

		.app__inner {
			max-width: none;
			padding-inline: 0;
		}
	}

	.app__inner {
		width: 100%;
		max-width: 880px;
		margin-inline: auto;
		padding-inline: $space-6;

		@include breakpoint-down($bp-sm) {
			padding-inline: $space-4;
		}
	}

	.app__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: $space-4;
		flex-wrap: wrap;
		margin-bottom: $space-6;

		h1 {
			margin: 0 0 $space-2;
			font-size: $font-size-3xl;
			font-weight: $font-weight-bold;
			letter-spacing: $letter-spacing-tight;
		}
	}

	.app__header-text {
		min-width: 0;
	}

	.app__sub {
		margin: 0;
		font-size: $font-size-base;
		color: rgba($color-black, 0.7);
	}

	// ---- Restored draft ----
	.draft {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $space-4;
		margin-bottom: $space-6;
		padding: $space-3 $space-4;
		border: 1px solid rgba($color-black, 0.12);
		border-left: 2px solid $color-black;
		border-radius: 4px;
		background: rgba($color-black, 0.03);

		@include breakpoint-down($bp-sm) {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	.draft__text {
		margin: 0;
		font-size: $font-size-sm;
		line-height: 1.55;
		color: rgba($color-black, 0.75);
	}

	.draft__discard {
		flex-shrink: 0;
		padding: 8px 14px;
		font: inherit;
		font-size: $font-size-sm;
		font-weight: $font-weight-semibold;
		color: $color-black;
		background: $color-white;
		border: 1px solid rgba($color-black, 0.2);
		border-radius: 4px;
		cursor: pointer;

		&:hover {
			background: rgba($color-black, 0.05);
		}
	}

	// ---- Progress bar ----
	.progress {
		margin-bottom: $space-7;
	}

	.progress__steps {
		display: flex;
		align-items: flex-start;
		gap: 0;
	}

	.progress__line {
		flex: 1 1 auto;
		height: 2px;
		margin-top: 10px;
		background: rgba($color-black, 0.15);
		transition: background $transition-base;

		&.is-done {
			background: $color-black;
		}
	}

	.progress__step {
		@include reset-button;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: 0 0 auto;
		color: rgba($color-black, 0.45);
		font-size: $font-size-xs;
		text-align: center;
		min-width: 22px;

		&:disabled {
			cursor: default;
		}

		&.is-current,
		&.is-done {
			color: $color-black;
		}
	}

	.progress__dot {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: $color-white;
		border: 2px solid rgba($color-black, 0.3);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: $font-weight-bold;
		color: rgba($color-black, 0.5);
		transition:
			background $transition-base,
			border-color $transition-base,
			color $transition-base;

		.is-current & {
			background: $color-white;
			border-color: $color-black;
			color: $color-black;
		}

		.is-done & {
			background: $color-black;
			border-color: $color-black;
			color: $color-white;
		}
	}

	.progress__label {
		font-size: 10px;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		line-height: 1.2;
		max-width: 80px;

		@include breakpoint-down($bp-sm) {
			display: none;
		}
	}

	// ---- Step ----
	.step__eyebrow {
		margin: 0 0 $space-1;
		font-size: $font-size-xs;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-black, 0.55);
		font-weight: $font-weight-semibold;
	}

	.step__title {
		margin: 0 0 $space-6;
		font-size: clamp(#{$font-size-xl}, 4vw, #{$font-size-2xl});
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-tight;
	}

	// ---- Form ----
	.form {
		display: flex;
		flex-direction: column;
		gap: $space-5;
	}

	.form__row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $space-4;

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		input[type='text'],
		input[type='email'],
		input[type='tel'],
		input[type='url'],
		textarea {
			appearance: none;
			width: 100%;
			padding: 8px 2px;
			font: inherit;
			font-size: $font-size-base;
			color: $color-black;
			background: transparent;
			border: 0;
			border-bottom: 1px solid rgba($color-black, 0.25);
			border-radius: 0;
			resize: vertical;
			transition: border-color $transition-fast;

			&::placeholder {
				color: rgba($color-black, 0.35);
			}

			&:focus {
				outline: none;
				border-bottom-color: $color-black;
			}

			&:-webkit-autofill {
				-webkit-text-fill-color: $color-black;
				-webkit-box-shadow: 0 0 0 1000px $color-white inset;
				caret-color: $color-black;
			}
		}

		&.has-error input,
		&.has-error textarea {
			border-bottom-color: $color-error;
		}
	}

	.field__label {
		display: flex;
		align-items: baseline;
		gap: $space-2;
		flex-wrap: wrap;
	}

	.field__name {
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		color: rgba($color-black, 0.7);
	}

	.opt {
		font-size: $font-size-xs;
		font-weight: $font-weight-regular;
		letter-spacing: 0;
		text-transform: none;
		color: rgba($color-black, 0.45);
		font-style: italic;
		margin-left: 4px;
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
	}

	.field__error--block {
		display: block;
		margin-top: 4px;
	}

	// ---- Radio group ----
	.radio-group {
		display: flex;
		flex-wrap: wrap;
		gap: $space-4;
		margin-top: 4px;
	}

	.radio {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: $font-size-sm;

		input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}
	}

	.radio__dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1.5px solid $color-black;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;

		&::after {
			content: '';
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: $color-black;
			transform: scale(0);
			transition: transform $transition-fast;
		}
	}

	.radio input:checked + .radio__dot::after {
		transform: scale(1);
	}

	// ---- Checkbox group ----
	.check-group {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $space-3;
		margin-top: 4px;

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: $font-size-sm;

		input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}
	}

	.check__box {
		width: 14px;
		height: 14px;
		border: 1.5px solid $color-black;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;

		&::after {
			content: '';
			width: 7px;
			height: 7px;
			background: $color-black;
			transform: scale(0);
			transition: transform $transition-fast;
		}
	}

	.check input:checked + .check__box::after,
	.consent input:checked + .check__box::after {
		transform: scale(1);
	}

	// ---- Co-founder dynamic ----
	.cf {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr auto;
		gap: $space-3;
		margin-top: $space-2;
		padding-top: $space-2;
		border-top: 1px dashed rgba($color-black, 0.15);

		@include breakpoint-down($bp-sm) {
			grid-template-columns: 1fr 1fr auto;
		}

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr auto;
		}
	}

	.cf__input {
		appearance: none;
		padding: 6px 2px;
		font: inherit;
		font-size: $font-size-sm;
		color: $color-black;
		background: transparent;
		border: 0;
		border-bottom: 1px solid rgba($color-black, 0.25);

		&::placeholder {
			color: rgba($color-black, 0.4);
		}

		&:focus {
			outline: none;
			border-bottom-color: $color-black;
		}
	}

	.cf__remove {
		@include reset-button;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid rgba($color-black, 0.3);
		font-size: 16px;
		line-height: 1;
		color: $color-black;
		align-self: center;
		justify-self: end;

		&:hover {
			background: rgba($color-black, 0.06);
		}
	}

	// ---- File input ----
	.file {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: $space-3;
		cursor: pointer;
		margin-top: 4px;

		input {
			position: absolute;
			opacity: 0;
			width: 1px;
			height: 1px;
			pointer-events: none;
		}
	}

	.file__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 14px;
		background: transparent;
		color: $color-black;
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
		border: 1px solid $color-black;
	}

	.file__name {
		font-size: $font-size-sm;
		color: rgba($color-black, 0.65);
		word-break: break-all;
		min-width: 0;
		flex: 1;
	}

	.has-error .file__btn {
		border-color: $color-error;
		color: $color-error;
	}

	// ---- Consent (Step 8) ----
	.verify-gate {
		margin-bottom: $space-5;
		padding: $space-4;
		border: 1px solid rgba($color-black, 0.15);
		background: #fff9e9;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: $space-3;
	}

	.verify-gate__text {
		margin: 0;
		font-size: $font-size-sm;
		line-height: 1.55;
		color: rgba($color-black, 0.8);

		strong {
			font-weight: $font-weight-semibold;
			color: $color-black;
		}
	}

	:global(button.button-reveal.resend) {
		padding: 9px 20px;
		border: 1px solid $color-black;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-xs;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
	}

	.verify-gate__done {
		font-size: $font-size-xs;
		font-weight: $font-weight-semibold;
		color: #1a6b2f;
	}

	.consent-list {
		display: flex;
		flex-direction: column;
		gap: $space-4;
	}

	// Locked until the email is confirmed: the boxes read as unavailable and the
	// disabled input ignores label clicks, so none of the three can be ticked.
	.consent-list--locked {
		.consent {
			cursor: not-allowed;
		}

		.check__box {
			opacity: 0.4;
		}
	}

	.consent {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: $space-3;
		align-items: start;
		cursor: pointer;
		font-size: $font-size-base;
		line-height: $line-height-snug;

		input {
			position: absolute;
			opacity: 0;
			pointer-events: none;
		}

		.check__box {
			margin-top: 4px;
		}
	}

	.consent__text {
		display: block;
	}

	// ---- Nav ----
	.submit-error {
		margin-top: 16px;
		font-size: $font-size-xs;
		font-weight: $font-weight-medium;
		color: $color-error;
	}

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: $space-3;
		margin-top: $space-5;
		padding-top: $space-5;
		border-top: 1px solid rgba($color-black, 0.12);
	}

	:global(.nav__next) {
		margin-left: auto;
	}

	:global(.btn) {
		padding: 11px 24px;
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;

		&:disabled {
			opacity: 0.35;
		}
	}

	:global(.btn--primary) {
		background: $color-black;
		color: $color-white;
		--reveal-ray: #{$color-black};
	}

	:global(.btn--ghost) {
		background: transparent;
		color: $color-black;
		border: 1px solid $color-black;
	}

	:global(.btn--sm) {
		padding: 6px 14px;
		font-size: $font-size-xs;
		margin-top: $space-3;
	}

	// ---- Success ----
	.success {
		min-height: calc(100svh - var(--page-shell-top, 104px) - #{$space-10} - #{$space-9});
		max-width: 760px;
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: $space-4;
		padding: $space-7 0;
	}

	.success__title {
		margin: 0;
		font-size: clamp(2.25rem, 5vw, 3.5rem);
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-tight;
		line-height: 1.05;
	}

	.success__body {
		margin: 0;
		font-size: $font-size-lg;
		line-height: $line-height-relaxed;
		color: rgba($color-black, 0.8);

		strong {
			font-weight: $font-weight-semibold;
			color: $color-black;
		}
	}

	.success__meta {
		margin: 0;
		font-size: $font-size-base;
		color: rgba($color-black, 0.6);
		line-height: $line-height-relaxed;
	}

	.success__actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: $space-5;
		flex-wrap: wrap;
		margin-top: $space-2;
	}

	:global(button.button-reveal.view) {
		padding: 11px 28px;
		border: 1px solid $color-black;
		background: $color-black;
		color: $color-white;
		font-size: $font-size-sm;
		font-weight: $font-weight-bold;
		letter-spacing: $letter-spacing-wide;
		text-transform: uppercase;
	}
</style>
