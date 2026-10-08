<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import JobForm from '$lib/components/JobForm.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import { EMPTY_JOB, type JobFields, type JobType, type WorkMode } from '$lib/utils/jobPostings';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type JobRow = {
		id: string;
		role: string;
		company: string;
		location: string;
		type: JobType;
		work_mode: WorkMode;
		sector: string;
		pay: string;
		closes_on: string | null;
		max_applicants: number;
		description: string;
		status: 'open' | 'closed' | 'removed';
		removed_reason: string | null;
	};

	const existing = $derived(data.job as JobRow | null);

	const initial = $derived<JobFields>(
		existing
			? {
					role: existing.role,
					company: existing.company,
					type: existing.type,
					workMode: existing.work_mode,
					location: existing.location,
					sector: existing.sector,
					pay: existing.pay,
					closesOn: existing.closes_on ?? '',
					maxApplicants: existing.max_applicants,
					description: existing.description
				}
			: { ...EMPTY_JOB, company: data.defaultCompanyName }
	);

	async function save(fields: JobFields) {
		const res = await fetch('/api/founder/jobs', {
			method: data.isNew ? 'POST' : 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...fields, companyId: data.activeCompanyId, id: existing?.id })
		});
		const body = (await res.json().catch(() => ({}))) as {
			ok?: boolean;
			error?: string;
			message?: string;
		};
		if (!res.ok || !body.ok) {
			showToast(body.error ?? body.message ?? 'Could not save the role.', 'err');
			return;
		}
		showToast(data.isNew ? 'Role posted. It is live.' : 'Role saved.', 'ok');
		await goto(resolve('/founder/jobs'));
	}
</script>

<svelte:head>
	<title>{data.isNew ? 'Post a role' : 'Edit role'} · Founder Console</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title={data.isNew ? 'Post a role' : 'Edit role'}
	eyebrow={data.isNew ? 'New posting' : 'Editing'}
	requiresVerifiedCompany
>
	{#if existing?.status === 'removed'}
		<div class="note" role="alert">
			<p class="note__title">TIC removed this role</p>
			<p>{existing.removed_reason || 'No reason was given.'}</p>
			<p>A removed role cannot be edited. Post a new one instead.</p>
		</div>
	{:else}
		<JobForm
			{initial}
			showCompany
			intro={data.isNew
				? 'The role goes live on the Opportunities board as soon as you post it. Applicants land in your Applicants inbox.'
				: existing?.status === 'closed'
					? 'This role is closed. Saving keeps it closed — reopen it from your roles list.'
					: 'This role is live. Saving updates it on the board straight away.'}
			submitLabel={data.isNew ? 'Post role' : 'Save changes'}
			cancelHref={resolve('/founder/jobs')}
			onsubmit={save}
		/>
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.note {
		@include admin-panel;
		padding: 16px 18px;
		border-left: 3px solid admin-tone-fg('bad');
		max-width: 680px;

		p {
			margin: 0 0 6px;
			font-size: 13px;
			line-height: 1.6;
			color: $admin-ink-2;
		}
	}

	.note__title {
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}
</style>
