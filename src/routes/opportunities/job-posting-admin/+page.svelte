<script lang="ts">
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { COMPANY_PORTAL_NAV } from '$lib/utils/companyNav';
	import {
		getCurrentCompany,
		loginCompany,
		logoutCompany,
		type CompanyAccount
	} from '$lib/utils/companyAuth';
	import { deleteJob, getMyJobs, type PostedJob } from '$lib/utils/jobPostings';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import { verifyTurnstileToken } from '$lib/utils/turnstile';
	import { onMount } from 'svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	let mounted = $state(false);
	let account = $state<CompanyAccount | null>(null);
	let jobs = $state<PostedJob[]>([]);

	let email = $state('');
	let password = $state('');
	let loginError = $state('');
	let turnstileToken = $state('');
	let captcha = $state<{ reset: () => void }>();
	let showPassword = $state(false);

	const isVerified = $derived(account?.status === 'verified');

	onMount(async () => {
		account = await getCurrentCompany();
		if (account) jobs = await getMyJobs(account.id);
		mounted = true;
	});

	async function refreshJobs() {
		if (!account) return;
		jobs = await getMyJobs(account.id);
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!turnstileToken) {
			loginError = 'Please complete the verification below.';
			return;
		}
		const human = await verifyTurnstileToken(turnstileToken);
		captcha?.reset();
		if (!human) {
			loginError = 'Verification failed. Please try again.';
			return;
		}
		const result = await loginCompany(email, password);
		if (!result.ok) {
			loginError = result.error;
			return;
		}
		loginError = '';
		password = '';
		account = result.account;
		jobs = await getMyJobs(result.account.id);
	}

	async function handleLogout() {
		await logoutCompany();
		account = null;
		jobs = [];
	}

	async function handleDelete(id: string, role: string) {
		if (!account) return;
		const ok = await askConfirm({
			title: `Remove "${role}"?`,
			body: 'The role disappears from Opportunities straight away. This cannot be undone.',
			confirmLabel: 'Remove role',
			tone: 'danger'
		});
		if (!ok) return;
		await deleteJob(id, account.id);
		await refreshJobs();
	}

	function formatPosted(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Job posting admin · IITG TIC</title>
</svelte:head>

{#snippet eyeIcon(shown: boolean)}
	{#if shown}
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	{/if}
{/snippet}

{#if !mounted}
	<div class="loading">Loading…</div>
{:else if !account}
	<section class="login">
		<div class="card">
			<div class="card__head">
				<p class="eyebrow">Companies</p>
				<h1>Sign in</h1>
				<p class="sub">Manage open roles for your team.</p>
			</div>

			<form onsubmit={handleLogin} novalidate>
				<label class="field">
					<span>Email</span>
					<input type="email" bind:value={email} autocomplete="email" required />
				</label>

				<label class="field">
					<span>Password</span>
					<div class="field__control">
						<input
							type={showPassword ? 'text' : 'password'}
							value={password}
							oninput={(e) => (password = e.currentTarget.value)}
							autocomplete="current-password"
							required
						/>
						<button
							type="button"
							class="reveal-toggle"
							onclick={() => (showPassword = !showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							aria-pressed={showPassword}
						>
							{@render eyeIcon(showPassword)}
						</button>
					</div>
				</label>

				<Turnstile bind:token={turnstileToken} bind:this={captcha} />

				{#if loginError}
					<p class="error" role="alert">{loginError}</p>
				{/if}

				<button type="submit" class="btn-primary">Sign in</button>
			</form>

			<p class="hint">
				New here? <a href="/opportunities/job-posting-admin/signup">Create a company account</a>
			</p>
		</div>
	</section>
{:else}
	<AdminShell
		brand="Company portal"
		navItems={COMPANY_PORTAL_NAV}
		title="Your roles"
		eyebrow="Job posting"
		user={account.companyName}
		onLogout={handleLogout}
	>
		{#snippet actions()}
			{#if isVerified}
				<a class="btn-primary" href="/opportunities/job-posting-admin/edit/new">+ Post role</a>
			{/if}
		{/snippet}

		{#if account.status === 'pending'}
			<div class="banner banner--pending" role="status">
				<p class="banner__title">Awaiting verification</p>
				<p>
					Thanks for signing up. The IITG-TIC team is reviewing your account to confirm you are a
					partner, incubatee or otherwise affiliated with TIC. Posting will unlock once approved.
				</p>
				<p class="banner__hint">
					Questions? Email <a href="mailto:tic@iitg.ac.in">tic@iitg.ac.in</a>.
				</p>
			</div>
		{:else if account.status === 'rejected'}
			<div class="banner banner--rejected" role="alert">
				<p class="banner__title">Account not approved</p>
				<p>
					The IITG-TIC team has not approved this account for posting roles.
					{#if account.rejectionReason}
						Reason: {account.rejectionReason}
					{/if}
				</p>
				<p class="banner__hint">
					Questions? Email <a href="mailto:tic@iitg.ac.in">tic@iitg.ac.in</a>.
				</p>
			</div>
		{/if}

		{#if !isVerified}
			<div class="empty">
				<p>Job posting is locked until your account is verified by the IITG-TIC team.</p>
			</div>
		{:else if jobs.length === 0}
			<div class="empty">
				<p>No roles posted yet.</p>
				<a class="btn-primary" href="/opportunities/job-posting-admin/edit/new"
					>Post your first role</a
				>
			</div>
		{:else}
			<div class="panel">
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th>Role</th>
								<th>Type</th>
								<th>Location</th>
								<th>Posted</th>
								<th class="actions-col"></th>
							</tr>
						</thead>
						<tbody>
							{#each jobs as job (job.id)}
								<tr>
									<td>
										<p class="cell__name">{job.role}</p>
										<p class="cell__sub">{job.sector}</p>
									</td>
									<td
										><span
											class="type type--{job.type.startsWith('Internship') ? 'intern' : 'full'}"
											>{job.type}</span
										></td
									>
									<td><p class="cell__sub">{job.location}</p></td>
									<td><p class="cell__sub">{formatPosted(job.posted)}</p></td>
									<td class="actions-col">
										<div class="actions">
											<a
												class="link"
												href="/opportunities/{job.slug}"
												target="_blank"
												rel="noopener noreferrer">View</a
											>
											<a class="link" href="/opportunities/job-posting-admin/edit/{job.id}">Edit</a>
											<button
												type="button"
												class="link link--danger"
												onclick={() => handleDelete(job.id, job.role)}>Delete</button
											>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</AdminShell>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.loading {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: $admin-sunken;
		font-family: $font-family-base;
		font-size: 13px;
		color: $admin-ink-3;
	}

	.login {
		min-height: 100svh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: $admin-sunken;
		padding: 24px;
		font-family: $font-family-base;
	}

	.card {
		width: 100%;
		max-width: 380px;
		padding: 32px 28px 28px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
	}

	.card__head {
		margin-bottom: 22px;
	}

	.eyebrow {
		@include admin-eyebrow;
	}

	h1 {
		margin: 0 0 8px;
		font-size: 22px;
		font-weight: $font-weight-semibold;
		color: #111;
		letter-spacing: -0.01em;
	}

	.sub {
		margin: 0;
		font-size: 13px;
		color: #555;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		> span {
			@include admin-field-label;
		}

		input {
			@include admin-input;
		}
	}

	.field__control {
		position: relative;
		display: flex;
		align-items: center;

		input {
			flex: 1;
			padding-right: 40px;
		}
	}

	.reveal-toggle {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: none;
		border: 0;
		color: $admin-ink-3;
		cursor: pointer;

		svg {
			display: block;
		}
	}

	.error {
		@include admin-msg-err;
	}

	.btn-primary {
		@include admin-btn-primary;
		justify-content: center;
	}

	.hint {
		margin: 18px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
		text-align: center;

		a {
			color: #2050d4;
			text-decoration: none;
			font-weight: $font-weight-semibold;
		}
	}

	.banner {
		padding: 14px 16px;
		margin-bottom: 18px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: $font-family-base;
		font-size: 13px;
		color: #444;

		p {
			margin: 0;
			line-height: 1.5;
		}

		&--pending {
			border-left: 3px solid #d9a900;
		}

		&--rejected {
			border-left: 3px solid #c0392b;
		}

		a {
			color: #2050d4;
			text-decoration: none;
			font-weight: $font-weight-semibold;
		}
	}

	.banner__title {
		font-size: 12px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #111;
	}

	.banner__hint {
		opacity: 0.85;
		font-size: 12px;
	}

	.empty {
		padding: 40px 22px;
		background: #fff;
		border: 1px dashed $admin-line;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		font-family: $font-family-base;

		p {
			margin: 0;
			font-size: 14px;
			color: #555;
		}
	}

	.panel {
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		overflow: hidden;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-family: $font-family-base;
		font-size: 13px;
		min-width: 680px;
	}

	thead th {
		text-align: left;
		padding: 10px 14px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-2;
		background: $admin-sunken;
		border-bottom: 1px solid $admin-line-soft;
	}

	tbody td {
		padding: 12px 14px;
		border-bottom: 1px solid $admin-line-soft;
		vertical-align: middle;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.cell__name {
		margin: 0;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.cell__sub {
		margin: 2px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.type {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-radius: 999px;

		&--full {
			background: $admin-line-soft;
			color: #333;
		}

		&--intern {
			background: #e0f0e6;
			color: #0e6b2c;
		}
	}

	.actions-col {
		text-align: right;
		white-space: nowrap;
	}

	.actions {
		display: inline-flex;
		gap: 12px;
		align-items: center;
	}

	.link {
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #2050d4;
		text-decoration: none;
		cursor: pointer;
		&--danger {
			color: #a01515;
		}
	}
</style>
