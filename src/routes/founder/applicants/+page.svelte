<script lang="ts">
	import Pagination from '$lib/components/Pagination.svelte';
	import { Pager } from '$lib/utils/pager.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import Select from '$lib/components/Select.svelte';
	import { getMyApplicants, resumeUrl, type CompanyApplicant } from '$lib/utils/jobApplicants';
	import { supabase } from '$lib/supabaseClient';
	import { downloadResumesZip } from '$lib/utils/resumeZip';
	import { downloadCsv, stampedFileName, toCsv } from '$lib/utils/csv';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	// The company's own applicants, and only theirs — TIC sees how many applied,
	// never who. Received and read: there are no stages to move people through.
	// Read in the browser, because RLS already scopes this table to the company
	// that posted the role.

	let { data }: { data: PageData } = $props();

	let applicants = $state<CompanyApplicant[]>([]);
	let role = $state('all');
	let openId = $state('');

	const roles = $derived([...new Set(applicants.map((a) => a.jobSlug))].sort());

	function roleLabel(slug: string) {
		return applicants.find((a) => a.jobSlug === slug)?.jobRole ?? slug;
	}

	const byRole = $derived(
		role === 'all' ? applicants : applicants.filter((a) => a.jobSlug === role)
	);
	const filtered = $derived(byRole);

	let zipping = $state(false);

	// Every resume in view as one zip — how a role's resumes are kept once the
	// 90-day clear-out after the role ends has run.
	async function downloadAll() {
		const paths = filtered.filter((a) => a.resumePath);
		if (paths.length === 0) {
			showToast('No resumes to download in this view.', 'info');
			return;
		}
		zipping = true;
		try {
			const { data: signed } = await supabase.storage.from('job-applications').createSignedUrls(
				paths.map((a) => a.resumePath as string),
				600
			);
			await downloadResumesZip(
				(signed ?? []).map((link, i) => ({
					url: link.signedUrl ?? '',
					name: `${paths[i].fullName}.pdf`
				})),
				`resumes-${role === 'all' ? 'all-roles' : roleLabel(role).replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}`
			);
		} catch {
			showToast('Could not build the zip. Try again.', 'err');
		} finally {
			zipping = false;
		}
	}

	onMount(async () => {
		if (data.company?.status === 'verified') applicants = await getMyApplicants();
	});

	// Signed on demand rather than up front: a link is good for ten minutes, and
	// signing every row on load would spend them all before anyone clicked.
	async function openResume(applicant: CompanyApplicant) {
		if (!applicant.resumePath) return;

		const url = await resumeUrl(applicant.resumePath);
		if (!url) {
			showToast('That resume could not be opened. Try again in a moment.', 'err');
			return;
		}
		window.open(url, '_blank', 'noopener');
	}

	function exportCsv() {
		const scope = role === 'all' ? 'all-roles' : roleLabel(role);
		const csv = toCsv(
			[
				'Applied',
				'Role',
				'Name',
				'Email',
				'Phone',
				'Currently',
				'Earliest start',
				'On site',
				'Portfolio',
				'Why'
			],
			filtered.map((a) => [
				fmtDate(a.createdAt),
				a.jobRole,
				a.fullName,
				a.email,
				a.phone,
				a.applicantRole,
				a.startDate ?? '',
				a.onsiteOk,
				a.portfolioLink,
				a.why
			])
		);
		downloadCsv(stampedFileName('applicants', scope), csv);
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// A page at a time; back to the first page whenever the view changes.
	const pager = new Pager(
		() => filtered,
		() => [role]
	);
</script>

<svelte:head>
	<title>Founder Console · Applicants</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	companies={data.companies}
	title="Applicants"
	eyebrow="Hiring"
	requiresVerifiedCompany
>
	{#snippet pageActions()}
		{#if filtered.length > 0}
			<button class="btn" onclick={downloadAll} disabled={zipping}>
				{zipping ? 'Zipping…' : 'Download resumes'}
			</button>
			<button class="btn" onclick={exportCsv}>Export CSV</button>
		{/if}
	{/snippet}

	{#if applicants.length === 0}
		<div class="empty">
			<p>No one has applied to your roles yet.</p>
			<a class="btn-primary" href={resolve('/founder/jobs/[id]', { id: 'new' })}>Post a role</a>
		</div>
	{:else}
		<div class="controls">
			{#if roles.length > 1}
				<div class="picker">
					<span class="picker__label">Role</span>
					<div class="picker__control">
						<Select
							id="applicants-role"
							bind:value={role}
							options={[
								{ value: 'all', label: 'Every role' },
								...roles.map((slug) => ({ value: slug, label: roleLabel(slug) }))
							]}
							size="sm"
							ariaLabel="Filter applicants by role"
						/>
					</div>
				</div>
			{/if}
		</div>

		{#if filtered.length === 0}
			<div class="empty">
				<p>No applicants in this view.</p>
			</div>
		{:else}
			<div class="panel">
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th>Applicant</th>
								<th>Role</th>
								<th>Applied</th>
								<th class="actions-col"></th>
							</tr>
						</thead>
						<tbody>
							{#each pager.rows as applicant (applicant.id)}
								<tr>
									<td>
										<p class="cell__name">{applicant.fullName}</p>
										<p class="cell__sub">{applicant.applicantRole}</p>
									</td>
									<td>{applicant.jobRole}</td>
									<td>{fmtDate(applicant.createdAt)}</td>
									<td class="actions-col">
										<button
											class="btn-small"
											onclick={() => (openId = openId === applicant.id ? '' : applicant.id)}
											aria-expanded={openId === applicant.id}
										>
											{openId === applicant.id ? 'Hide' : 'View'}
										</button>
									</td>
								</tr>

								{#if openId === applicant.id}
									<tr class="detail-row">
										<td colspan="4">
											<div class="detail">
												<dl>
													<div>
														<dt>Email</dt>
														<dd><a href="mailto:{applicant.email}">{applicant.email}</a></dd>
													</div>
													{#if applicant.phone}
														<div>
															<dt>Phone</dt>
															<dd><a href="tel:{applicant.phone}">{applicant.phone}</a></dd>
														</div>
													{/if}
													{#if applicant.startDate}
														<div>
															<dt>Earliest start</dt>
															<dd>{fmtDate(applicant.startDate)}</dd>
														</div>
													{/if}
													<div>
														<dt>On site</dt>
														<dd>{applicant.onsiteOk ? 'Yes' : 'No'}</dd>
													</div>
													{#if applicant.portfolioLink}
														<div>
															<dt>Portfolio</dt>
															<dd>
																<!-- The applicant's own URL, off this site entirely, so
																	     there is no route to resolve it against. -->
																<!-- eslint-disable svelte/no-navigation-without-resolve -->
																<a
																	href={applicant.portfolioLink}
																	target="_blank"
																	rel="noopener noreferrer"
																>
																	{applicant.portfolioLink}
																</a>
																<!-- eslint-enable svelte/no-navigation-without-resolve -->
															</dd>
														</div>
													{/if}
												</dl>

												{#if applicant.why}
													<div class="why">
														<p class="why__label">Why this role</p>
														<p class="why__text">{applicant.why}</p>
													</div>
												{/if}

												{#if applicant.resumePath}
													<button class="btn" onclick={() => openResume(applicant)}>
														Open resume ({applicant.resumeName})
													</button>
												{:else}
													<p class="cleared">
														The resume was cleared 90 days after the role ended.
													</p>
												{/if}
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination {pager} noun="applicants" />
			</div>
		{/if}
	{/if}
</FounderShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	.picker {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.picker__label {
		@include admin-field-label;
	}

	.picker__control {
		min-width: 210px;
	}

	.panel {
		@include admin-panel;
	}

	.cleared {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.empty {
		@include admin-empty;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		@include admin-table(720px);
	}

	thead th {
		@include admin-thead;
	}

	td {
		@include admin-td;
	}

	.cell__name {
		@include admin-cell-name;
	}

	.cell__sub {
		@include admin-cell-sub;
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.btn {
		@include admin-btn-base;
	}

	.btn-primary {
		@include admin-btn-primary;
		justify-content: center;
	}

	.btn-small {
		@include admin-btn-small;
	}

	.detail-row td {
		background: $admin-sunken;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 4px 0 8px;
	}

	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px 20px;
		margin: 0;

		dt {
			@include admin-field-label;
			margin-bottom: 2px;
		}

		dd {
			margin: 0;
			font-size: 13px;
			color: #222;
			overflow-wrap: anywhere;
		}

		a {
			color: #2050d4;
			text-decoration: none;
		}
	}

	.why__label {
		@include admin-field-label;
		margin: 0 0 4px;
	}

	.why__text {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: #333;
		white-space: pre-wrap;
	}
</style>
