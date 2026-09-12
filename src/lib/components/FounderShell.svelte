<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { FOUNDER_NAV } from '$lib/utils/founderNav';
	import { signOut } from '$lib/utils/appAuth';

	// Every founder page is the same shell around different content, plus the same
	// three questions asked before the content is allowed to render: is this
	// account attached to a company, has TIC approved the person, and has TIC
	// verified the company. Asking them here means no page has to remember to.

	// Only what the shell itself reads. Pages take the fuller session from their
	// own data, so member_role lives there rather than here.
	type Founder = {
		name: string;
		email: string;
		companyId: string | null;
		memberStatus: 'pending' | 'approved' | 'rejected';
	};

	type Company = {
		companyName: string;
		status: 'pending' | 'verified' | 'rejected';
		rejectionReason?: string;
	} | null;

	interface Props {
		founder: Founder;
		company: Company;
		title: string;
		eyebrow?: string;
		/** Pages that must render whatever the account's standing — Support is the
		 *  one that matters, because being locked out is exactly when you need it. */
		alwaysAvailable?: boolean;
		/** Content that needs the company verified, not merely approved. */
		requiresVerifiedCompany?: boolean;
		children: Snippet;
		/** Named apart from the snippet handed down to AdminShell, which would
		 *  otherwise shadow it. */
		pageActions?: Snippet;
	}

	let {
		founder,
		company,
		title,
		eyebrow = '',
		alwaysAvailable = false,
		requiresVerifiedCompany = false,
		children,
		pageActions
	}: Props = $props();

	const label = $derived(company?.companyName || founder.name || founder.email);

	const gate = $derived.by(() => {
		if (alwaysAvailable) return null;
		if (!founder.companyId || !company) return 'unattached' as const;
		if (founder.memberStatus === 'pending') return 'member-pending' as const;
		if (founder.memberStatus === 'rejected') return 'member-rejected' as const;
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

	{#if gate === 'unattached'}
		<div class="gate" role="status">
			<p class="gate__title">No startup on this account yet</p>
			<p>
				This login works, but it is not attached to a company, so there is nothing here to manage.
				If you applied for incubation, your application is on the Application page. If you want to
				post roles for a startup, register it — TIC verifies it before anything goes public.
			</p>
				<a class="gate__cta" href={resolve('/signup')}>Register a startup</a>
		</div>
	{:else if gate === 'member-pending'}
		<div class="gate gate--wait" role="status">
			<p class="gate__title">Waiting for TIC to approve your access</p>
			<p>
				{label} added you to their team. A TIC admin checks every new team member before the account can
				post roles, read applicants or change company details. You will be able to work here as soon as
				that is done.
			</p>
		</div>
	{:else if gate === 'member-rejected'}
		<div class="gate gate--stop" role="alert">
			<p class="gate__title">Access not approved</p>
			<p>
				TIC has not approved this account for {label}. If you think that is a mistake, the Support
				page has the people to ask.
			</p>
		</div>
	{:else if gate === 'company-pending'}
		<div class="gate gate--wait" role="status">
			<p class="gate__title">{label} is still being verified</p>
			<p>
				TIC reviews every company before it can put anything in front of the public. Posting roles
				and reading applicants unlock as soon as the account is verified. Your incubation
				application does not wait on this and can be filled in now.
			</p>
		</div>
	{:else if gate === 'company-rejected'}
		<div class="gate gate--stop" role="alert">
			<p class="gate__title">{label} was not verified</p>
			<p>
				TIC has not verified this company, so it cannot post roles.
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
