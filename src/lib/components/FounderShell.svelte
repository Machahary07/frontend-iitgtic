<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import Select from '$lib/components/Select.svelte';
	import { FOUNDER_NAV } from '$lib/utils/founderNav';
	import { signOut } from '$lib/utils/appAuth';
	import { showToast } from '$lib/utils/toast.svelte';

	// Every founder page is the same shell around different content, plus the same
	// questions asked before the content is allowed to render: does this account
	// have a startup in view at all, has TIC approved the person, and has TIC
	// verified the startup. Asking them here means no page has to remember to.
	//
	// A founder may run several startups, so the shell also carries the switcher.
	// Everything below it — postings, applicants, team, activity — is about the
	// one company named there, which is why it sits above all of them.

	type Founder = {
		name: string;
		email: string;
		memberOf: string | null;
		memberStatus: 'pending' | 'approved' | 'rejected';
	};

	type Company = {
		id: string;
		companyName: string;
		status: 'pending' | 'verified' | 'rejected';
		rejectionReason?: string;
	} | null;

	type CompanyOption = { id: string; name: string; status: string; relation: 'owner' | 'member' };

	interface Props {
		founder: Founder;
		company: Company;
		companies: CompanyOption[];
		title: string;
		eyebrow?: string;
		/** Pages that must render whatever the account's standing — Support is the
		 *  one that matters, because being locked out is exactly when you need it. */
		alwaysAvailable?: boolean;
		/** Content that needs the company verified, not merely registered. */
		requiresVerifiedCompany?: boolean;
		children: Snippet;
		/** Named apart from the snippet handed down to AdminShell, which would
		 *  otherwise shadow it. */
		pageActions?: Snippet;
	}

	let {
		founder,
		company,
		companies,
		title,
		eyebrow = '',
		alwaysAvailable = false,
		requiresVerifiedCompany = false,
		children,
		pageActions
	}: Props = $props();

	const label = $derived(company?.companyName || founder.name || founder.email);

	const STATUS_HINT: Record<string, string> = {
		pending: 'not incubated yet',
		verified: 'verified',
		rejected: 'not verified'
	};

	const options = $derived(
		companies.map((c) => ({
			value: c.id,
			label: c.name,
			hint: `${STATUS_HINT[c.status] ?? c.status}${c.relation === 'member' ? ' · you were added to this' : ''}`
		}))
	);

	// Mirrors the company the server chose. It is a copy rather than a binding on
	// the prop because the dropdown writes to it the instant someone picks, and
	// the real change only lands once the server has agreed and the page reloads.
	let switching = $state('');
	$effect(() => {
		switching = company?.id ?? '';
	});

	async function switchCompany(id: string) {
		if (!id || id === company?.id) return;
		const res = await fetch('/api/founder/companies', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ companyId: id })
		});
		if (!res.ok) {
			showToast('Could not switch company.', 'err');
			switching = company?.id ?? '';
			return;
		}
		// The whole console is about one company, so every load function on the
		// page has to run again — not just the one that named it.
		await invalidateAll();
	}

	const gate = $derived.by(() => {
		if (alwaysAvailable) return null;
		// Added to someone's startup and still waiting: they have no companies to
		// switch between, so this comes before anything about a company.
		if (founder.memberOf && founder.memberStatus === 'pending') return 'member-pending' as const;
		if (founder.memberOf && founder.memberStatus === 'rejected') return 'member-rejected' as const;
		if (companies.length === 0 || !company) return 'no-company' as const;
		if (requiresVerifiedCompany && company.status === 'pending') return 'company-pending' as const;
		if (requiresVerifiedCompany && company.status === 'rejected') {
			return 'company-rejected' as const;
		}
		return null;
	});

	async function handleLogout() {
		await signOut();
		goto(resolve('/login'));
	}
</script>

<AdminShell
	brand="Founder Console"
	navItems={FOUNDER_NAV}
	{title}
	{eyebrow}
	user={label}
	onLogout={handleLogout}
>
	{#snippet actions()}
		{#if !gate && pageActions}{@render pageActions()}{/if}
	{/snippet}

	{#if companies.length > 0}
		<div class="switcher">
			<span class="switcher__label">Working on</span>
			<div class="switcher__control">
				<Select
					id="company-switcher"
					bind:value={switching}
					{options}
					size="sm"
					ariaLabel="Choose which company to work on"
					onchange={switchCompany}
				/>
			</div>
			<a class="switcher__link" href={resolve('/founder/companies')}>Companies</a>
		</div>
	{/if}

	{#if gate === 'member-pending'}
		<div class="gate gate--wait" role="status">
			<p class="gate__title">Waiting for TIC to approve your access</p>
			<p>
				A founder added you to their startup. A TIC admin checks every new team member before the
				account can post roles, read applicants or change company details. You will be able to work
				here as soon as that is done.
			</p>
		</div>
	{:else if gate === 'member-rejected'}
		<div class="gate gate--stop" role="alert">
			<p class="gate__title">Access not approved</p>
			<p>
				TIC has not approved this account for the startup you were added to. If you think that is a
				mistake, the Support page has the people to ask.
			</p>
		</div>
	{:else if gate === 'no-company'}
		<div class="gate" role="status">
			<p class="gate__title">No startup on this account yet</p>
			<p>
				Register the startup you are building and this console fills in around it — the incubation
				application, job postings, applicants and your team are all kept per startup. You can add
				more than one later.
			</p>
			<a class="gate__cta" href={resolve('/founder/companies')}>Register a startup</a>
		</div>
	{:else if gate === 'company-pending'}
		<div class="gate gate--wait" role="status">
			<p class="gate__title">Fill in the incubation application for {label}</p>
			<p>
				Posting roles and reading applicants unlock once TIC accepts {label} for incubation. Start
				with the application form; you can follow its review from the Startups page.
			</p>
			<a class="gate__cta" href={resolve('/founder/application')}>Fill application form</a>
		</div>
	{:else if gate === 'company-rejected'}
		<div class="gate gate--stop" role="alert">
			<p class="gate__title">{label} was not verified</p>
			<p>
				TIC has not verified this startup, so it cannot post roles.
				{#if company?.rejectionReason}
					Reason given: {company.rejectionReason}
				{/if}
			</p>
		</div>
	{:else}
		{@render children()}
	{/if}
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.switcher {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 18px;

		@include breakpoint-down($bp-sm) {
			flex-wrap: wrap;
		}
	}

	.switcher__label {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-3;
		white-space: nowrap;
	}

	.switcher__control {
		width: 100%;
		max-width: 290px;
	}

	.switcher__link {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		text-decoration: none;
		white-space: nowrap;
		@include admin-focus-ring($admin-accent);
	}

	.gate {
		@include admin-panel;
		padding: 22px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-left: 3px solid $admin-ink;
		max-width: 72ch;

		p {
			margin: 0;
			font-size: 13px;
			line-height: 1.6;
			color: $admin-ink-2;
		}

		&--wait {
			border-left-color: admin-tone-fg('warn');
		}

		&--stop {
			border-left-color: admin-tone-fg('bad');
		}
	}

	.gate__cta {
		align-self: flex-start;
		margin-top: 6px;
		@include admin-btn-primary;
		text-decoration: none;
	}

	.gate__title {
		font-size: 15px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}
</style>
