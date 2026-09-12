<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import FounderShell from '$lib/components/FounderShell.svelte';
	import {
		getMyApplicants,
		resumeUrl,
		type ApplicantStatus,
		type CompanyApplicant
	} from '$lib/utils/jobApplicants';
	import { downloadCsv, stampedFileName, toCsv } from '$lib/utils/csv';
	import { showToast } from '$lib/utils/toast.svelte';
	import type { PageData } from './$types';

	// The company's own applicants. Read-only by design: a status is TIC's to
	// set, and the schema backs that up — the company has a select grant on this
	// table and nothing else.
	//
	// Still read in the browser rather than in a load function, because RLS
	// already scopes this table to the company that posted the role — there is no
	// pending row here that the policy would hide from its owner.

	let { data }: { data: PageData } = $props();

	type Filter = 'all' | ApplicantStatus;

	let applicants = $state<CompanyApplicant[]>([]);
	let filter = $state<Filter>('all');
	let role = $state('all');
	let openId = $state('');

	const roles = $derived([...new Set(applicants.map((a) => a.jobSlug))].sort());

	function roleLabel(slug: string) {
		return applicants.find((a) => a.jobSlug === slug)?.jobRole ?? slug;
	}

	const byRole = $derived(
		role === 'all' ? applicants : applicants.filter((a) => a.jobSlug === role)
	);
	const filtered = $derived(filter === 'all' ? byRole : byRole.filter((a) => a.status === filter));

	const counts = $derived({
		all: byRole.length,
		new: byRole.filter((a) => a.status === 'new').length,
		shortlisted: byRole.filter((a) => a.status === 'shortlisted').length,
		forwarded: byRole.filter((a) => a.status === 'forwarded').length,
		rejected: byRole.filter((a) => a.status === 'rejected').length
	});

	// What each status means from the company's side. "new" and "shortlisted" are
	// TIC's internal stages, so they read as one thing here: not sent on yet.
	const STATUS_LABEL: Record<ApplicantStatus, string> = {
		new: 'With TIC',
		shortlisted: 'Shortlisted by TIC',
		forwarded: 'Sent to you',
		rejected: 'Not taken forward'
	};

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
				'Status',
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
				STATUS_LABEL[a.status],
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
</script>

<svelte:head>
	<title>Founder Console · Applicants</title>
</svelte:head>

<FounderShell
	founder={data.founder}
	company={data.company}
	title="Applicants"
	eyebrow="Hiring"
	requiresVerifiedCompany
>
	{#snippet pageActions()}
		{#if filtered.length > 0}
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
			<div class="tabs">
				<button class="tab" class:tab--active={filter === 'all'} onclick={() => (filter = 'all')}>
					All <span class="tab__count">{counts.all}</span>
				</button>
				<button
					class="tab"
					class:tab--active={filter === 'forwarded'}
					onclick={() => (filter = 'forwarded')}
				>
					Sent to you <span class="tab__count">{counts.forwarded}</span>
				</button>
				<button
					class="tab"
					class:tab--active={filter === 'shortlisted'}
					onclick={() => (filter = 'shortlisted')}
				>
					Shortlisted <span class="tab__count">{counts.shortlisted}</span>
				</button>
				<button class="tab" class:tab--active={filter === 'new'} onclick={() => (filter = 'new')}>
					With TIC <span class="tab__count">{counts.new}</span>
				</button>
				<button
					class="tab"
					class:tab--active={filter === 'rejected'}
					onclick={() => (filter = 'rejected')}
				>
					Not taken forward <span class="tab__count">{counts.rejected}</span>
				</button>
			</div>

			{#if roles.length > 1}
				<label class="picker">
					<span>Role</span>
					<select bind:value={role}>
						<option value="all">Every role</option>
						{#each roles as slug (slug)}
							<option value={slug}>{roleLabel(slug)}</option>
						{/each}
					</select>
				</label>
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
								<th>Status</th>
								<th class="actions-col"></th>
							</tr>
						</thead>
						<tbody>
							{#each filtered as applicant (applicant.id)}
								<tr>
									<td>
										<p class="cell__name">{applicant.fullName}</p>
										<p class="cell__sub">{applicant.applicantRole}</p>
									</td>
									<td>{applicant.jobRole}</td>
									<td>{fmtDate(applicant.createdAt)}</td>
									<td>
										<span class="badge badge--{applicant.status}">
											{STATUS_LABEL[applicant.status]}
										</span>
									</td>
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
										<td colspan="5">
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
												{/if}
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
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

	.tabs {
		@include admin-tabs;
	}

	.tab {
		@include admin-tab;
	}

	.tab__count {
		@include admin-tab-count;
	}

	.picker {
		display: flex;
		align-items: center;
		gap: 8px;

		> span {
			@include admin-field-label;
		}

		select {
			@include admin-input;
			min-width: 200px;
		}
	}

	.panel {
		@include admin-panel;
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

	.badge {
		@include admin-badge;

		// 'new' keeps the base grey the mixin already sets.
		&--shortlisted {
			@include admin-badge-tone('info');
		}
		&--forwarded {
			@include admin-badge-tone('good');
		}
		&--rejected {
			@include admin-badge-tone('bad');
		}
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
