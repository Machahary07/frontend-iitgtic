<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import GoogleMeetLogo from '$lib/components/GoogleMeetLogo.svelte';
	import ScreeningScores from '$lib/components/ScreeningScores.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';
	import {
		EVALUATION_CRITERIA,
		MAX_CRITERION_SCORE,
		type EvaluationCard,
		type Marks
	} from '$lib/utils/evaluationCriteria';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const isAdmin = $derived(data.scope === 'admin');
	const active = $derived(data.active as EvaluationCard[]);
	const done = $derived(data.done as EvaluationCard[]);
	const POINTS = Array.from({ length: MAX_CRITERION_SCORE + 1 }, (_, i) => i);

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/login'));
	}

	function fmtWhen(iso: string | null) {
		if (!iso) return '';
		return new Date(iso).toLocaleString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function readError(res: Response, fallback: string) {
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		return body.message ?? fallback;
	}

	// ---- admin: meeting set-up ---------------------------------------------------

	// <input type="datetime-local"> wants local time without a zone.
	function toLocalInput(iso: string | null) {
		if (!iso) return '';
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	// Seeded up front, not while drawing the card: creating state during render
	// is what Svelte refuses (state_unsafe_mutation).
	const draftOf = (card: EvaluationCard) => ({
		url: card.meetUrl ?? '',
		at: toLocalInput(card.meetAt)
	});
	let meetDrafts = $state<Record<string, { url: string; at: string }>>(
		untrack(() =>
			Object.fromEntries((data.active as EvaluationCard[]).map((c) => [c.id, draftOf(c)]))
		)
	);
	$effect.pre(() => {
		for (const card of active) meetDrafts[card.id] ??= draftOf(card);
	});
	let busy = $state<string | null>(null);

	async function saveMeeting(card: EvaluationCard) {
		const draft = meetDrafts[card.id];
		if (!draft?.at) {
			showToast('Choose the meeting date and time.', 'err');
			return;
		}
		busy = card.id;
		const res = await fetch('/api/tic-admin/evaluation', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				id: card.id,
				meetUrl: draft.url,
				meetAt: new Date(draft.at).toISOString()
			})
		});
		busy = null;
		if (!res.ok) {
			showToast(await readError(res, 'Could not save the meeting.'), 'err');
			return;
		}
		const body = (await res.json()) as { notified?: number; applicantInvited?: boolean };
		await invalidateAll();
		const told = [
			body.notified ? `${body.notified} coordinator${body.notified === 1 ? '' : 's'}` : '',
			body.applicantInvited ? 'the applicant' : ''
		].filter(Boolean);
		showToast(told.length ? `Meeting saved. Emailed ${told.join(' and ')}.` : 'Meeting saved.');
	}

	async function endMeeting(card: EvaluationCard) {
		const ok = await askConfirm({
			title: `End the screening call for ${card.startupName}?`,
			body: 'Every coordinator has submitted. Their scores are kept as they are, and the application goes to the CEO for the recheck.',
			confirmLabel: 'End meeting',
			tone: 'danger'
		});
		if (!ok) return;
		busy = card.id;
		const res = await fetch('/api/tic-admin/evaluation', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: card.id, action: 'end' })
		});
		busy = null;
		if (!res.ok) {
			showToast(await readError(res, 'Could not end the meeting.'), 'err');
			return;
		}
		await invalidateAll();
		showToast('Meeting ended. Passed to the CEO.');
	}

	function total(marks: Marks) {
		return EVALUATION_CRITERIA.reduce((sum, c) => sum + (marks[c.key]?.score ?? 0), 0);
	}

	// ---- coordinator: scoring with auto-save -----------------------------------
	//
	// Every change lands in this device's storage first and the server a moment
	// later. If the connection drops, the device copy is kept, marked unsynced,
	// and pushed again as soon as the browser is back online — so a lost
	// connection never loses a score.

	type SyncState = 'idle' | 'saving' | 'saved' | 'offline';

	const storageKey = (appId: string) => `tic-eval:${data.me}:${appId}`;

	function readBackup(appId: string): Marks | null {
		try {
			const raw = localStorage.getItem(storageKey(appId));
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { marks: Marks; unsynced: boolean };
			return parsed.unsynced ? parsed.marks : null;
		} catch {
			return null;
		}
	}

	function writeBackup(appId: string, marks: Marks, unsynced: boolean) {
		try {
			localStorage.setItem(storageKey(appId), JSON.stringify({ marks, unsynced }));
		} catch {
			// Storage blocked: the server save still runs.
		}
	}

	function clearBackup(appId: string) {
		try {
			localStorage.removeItem(storageKey(appId));
		} catch {
			// Nothing to clear.
		}
	}

	// Seeded once from the server; the page owns the draft from then on.
	const initial = untrack(() =>
		Object.fromEntries(
			(data.active as EvaluationCard[]).map((c) => [c.id, structuredClone(c.mine)])
		)
	) as Record<string, Marks>;
	let marks = $state<Record<string, Marks>>(initial);
	// A call assigned after the page opened still gets a draft of its own.
	$effect.pre(() => {
		for (const card of active) marks[card.id] ??= structuredClone(card.mine);
	});
	let sync = $state<Record<string, { state: SyncState; at: string | null }>>({});
	const timers: Record<string, ReturnType<typeof setTimeout>> = {};

	const canScore = (card: EvaluationCard) =>
		!isAdmin && Boolean(card.meetUrl) && !card.submitted && !card.meetingEndedAt;

	async function pushToServer(appId: string) {
		sync[appId] = { state: 'saving', at: sync[appId]?.at ?? null };
		try {
			const res = await fetch('/api/tic-admin/evaluation', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id: appId, marks: marks[appId] })
			});
			if (!res.ok) {
				// A refusal (submitted elsewhere, meeting ended) is not a connection
				// problem: say so and stop retrying.
				if (res.status < 500) {
					sync[appId] = { state: 'idle', at: null };
					showToast(await readError(res, 'Could not save.'), 'err');
					return;
				}
				throw new Error('server');
			}
			writeBackup(appId, marks[appId], false);
			sync[appId] = { state: 'saved', at: new Date().toISOString() };
		} catch {
			sync[appId] = { state: 'offline', at: sync[appId]?.at ?? null };
		}
	}

	function changed(appId: string) {
		writeBackup(appId, marks[appId], true);
		sync[appId] = { state: 'saving', at: sync[appId]?.at ?? null };
		clearTimeout(timers[appId]);
		timers[appId] = setTimeout(() => pushToServer(appId), 700);
	}

	function setScore(appId: string, key: string, score: number) {
		marks[appId][key].score = marks[appId][key].score === score ? null : score;
		changed(appId);
	}

	function retryUnsynced() {
		for (const [appId, s] of Object.entries(sync)) {
			if (s.state === 'offline') pushToServer(appId);
		}
	}

	onMount(() => {
		// A draft this device could not get to the server last time wins over
		// what the server has, and is sent straight away.
		for (const card of active) {
			if (!canScore(card)) continue;
			const backup = readBackup(card.id);
			if (backup) {
				marks[card.id] = { ...marks[card.id], ...backup };
				pushToServer(card.id);
			}
		}
		const retry = setInterval(retryUnsynced, 15000);
		window.addEventListener('online', retryUnsynced);
		return () => {
			clearInterval(retry);
			window.removeEventListener('online', retryUnsynced);
		};
	});

	async function submit(card: EvaluationCard) {
		const mine = marks[card.id];
		const missing = EVALUATION_CRITERIA.filter((c) => mine[c.key]?.score === null);
		if (missing.length) {
			showToast(`Score every criterion first: ${missing.map((c) => c.name).join(', ')}.`, 'err');
			return;
		}
		const ok = await askConfirm({
			title: `Submit your scores for ${card.startupName}?`,
			body: `Total ${total(mine)} / ${EVALUATION_CRITERIA.length * MAX_CRITERION_SCORE}. Once submitted they cannot be changed.`,
			confirmLabel: 'Submit scores'
		});
		if (!ok) return;

		clearTimeout(timers[card.id]);
		busy = card.id;
		const res = await fetch('/api/tic-admin/evaluation', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: card.id, action: 'submit', marks: mine })
		}).catch(() => null);
		busy = null;
		if (!res) {
			writeBackup(card.id, mine, true);
			showToast(
				'You are offline. Your scores are saved on this device — submit again once you are back online.',
				'err'
			);
			return;
		}
		if (!res.ok) {
			showToast(await readError(res, 'Could not submit.'), 'err');
			return;
		}
		clearBackup(card.id);
		await invalidateAll();
		showToast('Scores submitted.');
	}

	function syncLabel(appId: string) {
		const s = sync[appId];
		if (!s || s.state === 'idle') return 'Changes save automatically';
		if (s.state === 'saving') return 'Saving…';
		if (s.state === 'offline') return 'Offline — kept on this device, will sync when you are back';
		return `Saved ${new Date(s.at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
	}
</script>

<svelte:head>
	<title>TIC Admin · Evaluation</title>
</svelte:head>

{#snippet joinButton(card: EvaluationCard)}
	<!-- An external Google Meet URL, not an app route. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a class="join" href={card.meetUrl} target="_blank" rel="noopener noreferrer">
		<GoogleMeetLogo size={22} />
		<span>Join Google Meet</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/snippet}

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Evaluation"
	eyebrow="Screening calls"
	user={adminName}
	onLogout={handleLogout}
>
	{#if active.length === 0}
		<div class="panel">
			<p class="empty">
				{isAdmin
					? 'No application is at the screening call. Once the CEO assigns coordinators, it shows up here.'
					: 'Nothing to evaluate right now. When you are assigned a screening call, it shows up here.'}
			</p>
		</div>
	{/if}

	{#each active as card (card.id)}
		<section class="eval">
			<header class="eval__head">
				<div>
					<p class="eval__eyebrow">Screening call</p>
					<h2 class="eval__title">{card.startupName}</h2>
					{#if card.founderName}<p class="eval__sub">{card.founderName}</p>{/if}
				</div>
				<a class="btn" href={resolve('/tic-admin/applications/[id]', { id: card.id })}
					>View application</a
				>
			</header>

			<!-- Meeting card -->
			<div class="meet">
				{#if isAdmin}
					{@const draft = meetDrafts[card.id]}
					<div class="meet__form">
						<label class="field field--grow">
							<span>Google Meet link</span>
							<input
								type="url"
								placeholder="https://meet.google.com/abc-defg-hij"
								bind:value={draft.url}
							/>
						</label>
						<label class="field">
							<span>Date &amp; time</span>
							<input type="datetime-local" bind:value={draft.at} />
						</label>
						<button
							class="btn btn--primary"
							disabled={busy === card.id}
							onclick={() => saveMeeting(card)}
						>
							{card.meetUrl ? 'Update & notify' : 'Save & notify'}
						</button>
					</div>
					<p class="quiet">
						Saving emails the link and time to the assigned coordinators and invites the applicant.
						Changing either later emails them again.
					</p>
					{#if card.meetUrl}
						<div class="meet__row">
							{@render joinButton(card)}
							<span class="meet__when">{fmtWhen(card.meetAt)}</span>
						</div>
					{/if}
				{:else if card.meetUrl}
					<div class="meet__row">
						{@render joinButton(card)}
						<span class="meet__when">{fmtWhen(card.meetAt)}</span>
					</div>
				{:else}
					<p class="meet__waiting">
						<GoogleMeetLogo size={20} />
						Waiting for admin to set up the meeting. Scoring opens once it is.
					</p>
				{/if}
			</div>

			{#if isAdmin}
				<div class="panel-row">
					<p class="label">Coordinators</p>
					<ul class="people">
						{#each card.coordinators as c (c.userId)}
							<li class="person" class:person--done={c.submitted}>
								{c.name}
								<span>{c.submitted ? 'Submitted' : 'Not submitted'}</span>
							</li>
						{/each}
					</ul>
				</div>

				<ScreeningScores people={card.all ?? []} />

				{@const waiting = card.coordinators.filter((c) => !c.submitted).length}
				<div class="end">
					<p class="quiet">
						{#if !card.meetUrl}
							Set up the meeting first.
						{:else if waiting}
							Waiting for {waiting} coordinator{waiting === 1 ? '' : 's'} to submit before the meeting
							can end.
						{:else}
							Everyone has submitted. Ending the meeting passes it to the CEO.
						{/if}
					</p>
					<button
						class="btn btn--danger"
						disabled={busy === card.id || !card.meetUrl || waiting > 0}
						onclick={() => endMeeting(card)}>End meeting</button
					>
				</div>
			{:else if card.submitted}
				<p class="submitted">
					You submitted your scores. Total {total(card.mine)} / {EVALUATION_CRITERIA.length *
						MAX_CRITERION_SCORE}.
				</p>
			{:else if card.meetUrl}
				<!-- Scoring -->
				<div class="criteria">
					{#each EVALUATION_CRITERIA as criterion, i (criterion.key)}
						{@const mark = marks[card.id][criterion.key]}
						<article class="crit">
							<div class="crit__head">
								<div>
									<h3 class="crit__name"><span>{i + 1}</span>{criterion.name}</h3>
									<p class="crit__tag">{criterion.tagline}</p>
								</div>
								<p class="crit__score">
									<b>{mark.score ?? '—'}</b>/{MAX_CRITERION_SCORE}
								</p>
							</div>
							<div class="points" role="radiogroup" aria-label="{criterion.name} score">
								{#each POINTS as point (point)}
									<button
										type="button"
										role="radio"
										aria-checked={mark.score === point}
										class="point"
										class:point--on={mark.score === point}
										disabled={!canScore(card) || busy === card.id}
										onclick={() => setScore(card.id, criterion.key, point)}>{point}</button
									>
								{/each}
							</div>
							<textarea
								rows="2"
								placeholder="Your remarks (optional)"
								bind:value={mark.remark}
								oninput={() => changed(card.id)}
								disabled={!canScore(card) || busy === card.id}
							></textarea>
						</article>
					{/each}
				</div>

				<div class="submit">
					<p class="sync" class:sync--off={sync[card.id]?.state === 'offline'}>
						{syncLabel(card.id)}
					</p>
					<p class="quiet">
						Total {total(marks[card.id])} / {EVALUATION_CRITERIA.length * MAX_CRITERION_SCORE}
					</p>
					<button class="btn btn--primary" disabled={busy === card.id} onclick={() => submit(card)}
						>Submit scores</button
					>
				</div>
			{/if}
		</section>
	{/each}

	<!-- Admin only: every screening call that has ended, newest first. -->
	{#if isAdmin && done.length}
		<h2 class="section-title">History</h2>
		{#each done as card (card.id)}
			<details class="eval eval--done">
				<summary>
					<span class="eval__title">{card.startupName}</span>
					<span class="quiet">
						{card.coordinators.length} coordinator{card.coordinators.length === 1 ? '' : 's'} · met
						{fmtWhen(card.meetAt)} · ended {fmtWhen(card.meetingEndedAt)}
					</span>
				</summary>
				<div class="history__links">
					<a class="btn" href={resolve('/tic-admin/applications/[id]', { id: card.id })}
						>View application</a
					>
				</div>
				<ScreeningScores people={card.all ?? []} />
			</details>
		{/each}
	{/if}
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.panel {
		@include admin-panel;
	}
	.empty {
		@include admin-empty;
	}

	.eval {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 860px;
		margin-bottom: 20px;
		padding: 20px;
		background: #fff;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		box-shadow: $admin-shadow-card;
		font-family: $font-family-base;
	}

	.eval__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.eval__eyebrow {
		margin: 0 0 4px;
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.eval__title {
		margin: 0;
		font-size: 17px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.eval__sub {
		margin: 2px 0 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.meet {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: $admin-sunken;
		border-radius: $admin-radius-md;
	}

	.meet__form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 10px;
	}

	.meet__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}

	.meet__when {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
	}

	.meet__waiting {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-size: 13px;
		color: $admin-ink-2;
	}

	.join {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 18px;
		font-size: 14px;
		font-weight: $font-weight-semibold;
		color: #111;
		text-decoration: none;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: 999px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;

		&--grow {
			flex: 1 1 260px;
		}

		> span {
			@include admin-field-label;
		}

		input {
			@include admin-input;
		}
	}

	.panel-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.label {
		margin: 0;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #444;
	}

	.people {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.person {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 10px;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		border: 1px solid $admin-line-soft;
		border-radius: 999px;

		span {
			padding: 1px 7px;
			font-size: 10px;
			border-radius: 999px;
			background: #fff4d4;
			color: #6a4f00;
		}

		&--done span {
			background: #d6f5e1;
			color: #0e6b2c;
		}
	}

	.end,
	.submit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding-top: 14px;
		border-top: 1px solid $admin-line-soft;
	}

	.criteria {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.crit {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;

		textarea {
			padding: 9px 12px;
			font: inherit;
			font-family: $font-family-base;
			font-size: 13px;
			color: #111;
			border: 1px solid $admin-line;
			border-radius: $admin-radius-sm;
			resize: vertical;

			&:focus {
				outline: none;
				border-color: #111;
				box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
			}
		}
	}

	.crit__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.crit__name {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 0;
		font-size: 15px;
		font-weight: $font-weight-semibold;
		color: #111;

		span {
			font-size: 11px;
			color: $admin-ink-3;
		}
	}

	.crit__tag {
		margin: 4px 0 0;
		font-size: 12.5px;
		line-height: 1.5;
		color: $admin-ink-2;
	}

	.crit__score {
		flex: none;
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;

		b {
			font-size: 20px;
			color: #111;
		}
	}

	.points {
		display: grid;
		grid-template-columns: repeat(11, minmax(0, 1fr));
		gap: 4px;
	}

	.point {
		min-height: 36px;
		padding: 0;
		font: inherit;
		font-family: $font-family-base;
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		@include admin-focus-ring;

		&--on {
			color: #fff;
			background: #111;
			border-color: #111;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}
	}

	.sync {
		margin: 0;
		font-size: 12px;
		color: #0e6b2c;

		&--off {
			color: #a01515;
		}
	}

	.submitted {
		margin: 0;
		padding: 12px 14px;
		font-size: 13px;
		color: #0e6b2c;
		background: #d6f5e1;
		border-radius: $admin-radius-sm;
	}

	.quiet {
		margin: 0;
		font-size: 12px;
		color: $admin-ink-3;
	}

	.section-title {
		@include admin-section-title;
		margin: 28px 0 12px;
	}

	.eval--done {
		gap: 12px;

		summary {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			justify-content: space-between;
			gap: 8px;
			cursor: pointer;
		}
	}

	.history__links {
		display: flex;
		gap: 8px;
	}

	.btn {
		display: inline-block;
		padding: 8px 14px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		text-align: center;
		text-decoration: none;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&--primary {
			color: #fff;
			background: #111;
			border-color: #111;
		}

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;
		}
	}

	@media (max-width: 560px) {
		.points {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
