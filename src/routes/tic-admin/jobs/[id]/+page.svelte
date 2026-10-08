<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import JobForm from '$lib/components/JobForm.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { showToast } from '$lib/utils/toast.svelte';
	import { EMPTY_JOB, type JobFields, type JobType, type WorkMode } from '$lib/utils/jobPostings';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type JobRow = {
		id: string;
		role: string;
		location: string;
		type: JobType;
		work_mode: WorkMode;
		sector: string;
		pay: string;
		closes_on: string | null;
		max_applicants: number;
		description: string;
		status: 'open' | 'closed' | 'removed';
	};

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const job = $derived(data.job as JobRow | null);

	const initial = $derived<JobFields>(
		job
			? {
					role: job.role,
					company: '',
					type: job.type,
					workMode: job.work_mode,
					location: job.location,
					sector: job.sector,
					pay: job.pay,
					closesOn: job.closes_on ?? '',
					maxApplicants: job.max_applicants,
					description: job.description
				}
			: { ...EMPTY_JOB, location: 'IIT Guwahati' }
	);

	async function save(fields: JobFields) {
		const res = await fetch('/api/tic-admin/jobs', {
			method: job ? 'PATCH' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...fields, id: job?.id })
		});
		const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
		if (!res.ok || !body.ok) {
			showToast(body.error ?? 'Could not save the role.', 'err');
			return;
		}
		showToast(job ? 'Role saved.' : 'Role posted. It is live.', 'ok');
		await goto(resolve('/tic-admin/jobs'));
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · {job ? 'Edit role' : 'Post a job'}</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title={job ? 'Edit role' : 'Post a job'}
	eyebrow="Job postings"
	user={adminName}
	onLogout={handleLogout}
>
	<JobForm
		{initial}
		showCompany={false}
		intro={job
			? job.status === 'closed'
				? 'This role is closed. Saving keeps it closed — reopen it from Job postings.'
				: 'This role is live. Saving updates it on the TIC jobs board straight away.'
			: 'Posted as IITG TIC on the TIC jobs board, live as soon as you post. Responses land in Job responses.'}
		submitLabel={job ? 'Save changes' : 'Post job'}
		cancelHref={resolve('/tic-admin/jobs')}
		onsubmit={save}
	/>
</AdminShell>
