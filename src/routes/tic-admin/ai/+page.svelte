<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Settings from '@lucide/svelte/icons/settings-2';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import Square from '@lucide/svelte/icons/square';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import { ASSISTANT_MODELS, findModel } from '$lib/utils/assistantModels';
	import { assistantSettings } from '$lib/utils/assistantSettings.svelte';
	import { renderMarkdown } from '$lib/utils/assistantMarkdown';
	import { showToast } from '$lib/utils/toast.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const firstName = $derived(adminName.trim().split(/\s+/)[0]);

	// Either the admin pasted a key into settings, or the deployment carries a
	// shared one. Without either there is nothing to send a request with.
	const configured = $derived(Boolean(assistantSettings.apiKey) || data.hasServerKey);
	const model = $derived(assistantSettings.model);

	type Message = {
		id: number;
		role: 'you' | 'assistant';
		text: string;
		/** base64 data URIs shown back to the admin and sent with the question. */
		images: string[];
		/** What the assistant looked at, in the order it looked. */
		steps: string[];
		/** sarvam-105b reasons out loud before answering. Kept separate from the
		 *  answer, because it is working-out and not a claim about the data. */
		reasoning: string;
		streaming: boolean;
		error: string;
	};

	let messages = $state<Message[]>([]);
	let draft = $state('');
	let pending = $state<string[]>([]);
	let busy = $state(false);
	let thread = $state<HTMLDivElement | null>(null);
	let box = $state<HTMLTextAreaElement | null>(null);
	let picker = $state<HTMLInputElement | null>(null);
	let nextId = 0;
	let controller: AbortController | null = null;

	const empty = $derived(messages.length === 0);
	const canSend = $derived(!busy && (draft.trim().length > 0 || pending.length > 0));

	// Written against the console as it stands, so the suggestions read as things
	// this admin could actually ask for rather than filler.
	const SUGGESTIONS = [
		'Summarise what changed in the console this week',
		'Which applications are waiting on a decision?',
		'How many companies are still pending verification?',
		'Rewrite the application-rejected email to be warmer'
	];

	// ---- settings ------------------------------------------------------------

	let settingsEl = $state<HTMLDialogElement | null>(null);
	let settingsOpen = $state(false);
	let keyDraft = $state('');
	let modelDraft = $state(assistantSettings.modelId);
	let keyVisible = $state(false);

	// <dialog> is what gives the focus trap, the inert background and Esc to
	// dismiss, the same as the app's confirm dialog.
	$effect(() => {
		if (!settingsEl) return;
		if (settingsOpen && !settingsEl.open) settingsEl.showModal();
		else if (!settingsOpen && settingsEl.open) settingsEl.close();
	});

	function openSettings() {
		keyDraft = assistantSettings.apiKey;
		modelDraft = assistantSettings.modelId;
		keyVisible = false;
		settingsOpen = true;
	}

	function saveSettings(event: SubmitEvent) {
		event.preventDefault();
		assistantSettings.save(keyDraft, modelDraft);

		// A model that cannot read images must not leave images queued behind it.
		if (!findModel(modelDraft).images && pending.length > 0) {
			pending = [];
			showToast('Attachments cleared — this model reads text only.', 'info');
		} else {
			showToast('Assistant settings saved.');
		}

		settingsOpen = false;
	}

	function forgetKey() {
		assistantSettings.forget();
		keyDraft = '';
		showToast('The key was removed from this browser.', 'info');
	}

	// ---- attachments ---------------------------------------------------------

	// The whole request is capped at 10 MB and base64 adds about a third, so a
	// source file over ~7 MB cannot fit however few of them there are.
	const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

	function readAsDataUrl(file: File): Promise<string> {
		return new Promise((done, fail) => {
			const reader = new FileReader();
			reader.onload = () => done(String(reader.result));
			reader.onerror = () => fail(new Error(`Could not read ${file.name}.`));
			reader.readAsDataURL(file);
		});
	}

	async function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';

		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				showToast(`${file.name} is not an image.`, 'err');
				continue;
			}
			if (file.size > MAX_IMAGE_BYTES) {
				showToast(`${file.name} is larger than 7 MB.`, 'err');
				continue;
			}
			try {
				pending = [...pending, await readAsDataUrl(file)];
			} catch (cause) {
				showToast(cause instanceof Error ? cause.message : 'Could not read that file.', 'err');
			}
		}
	}

	function removeAttachment(index: number) {
		pending = pending.filter((_, position) => position !== index);
	}

	// ---- sending -------------------------------------------------------------

	function grow() {
		if (!box) return;
		box.style.height = 'auto';
		box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
	}

	// Following the answer down is only wanted while the admin is already at the
	// bottom — yanking the view back while they are reading earlier output is the
	// thing every chat window gets wrong.
	function atBottom(): boolean {
		if (!thread) return true;
		return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
	}

	async function follow(force = false) {
		if (!force && !atBottom()) return;
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight });
	}

	function stop() {
		controller?.abort();
		controller = null;
	}

	async function send(text: string) {
		const body = text.trim();
		if (busy || (!body && pending.length === 0)) return;

		if (!configured) {
			showToast('Add a Sarvam API key first.', 'info');
			openSettings();
			return;
		}

		const images = model.images ? pending : [];
		const question: Message = {
			id: nextId++,
			role: 'you',
			text: body,
			images,
			steps: [],
			reasoning: '',
			streaming: false,
			error: ''
		};
		const reply: Message = {
			id: nextId++,
			role: 'assistant',
			text: '',
			images: [],
			steps: [],
			reasoning: '',
			streaming: true,
			error: ''
		};

		messages = [...messages, question, reply];
		draft = '';
		pending = [];
		busy = true;
		await tick();
		grow();
		await follow(true);

		// The reply object inside the reactive array, so the stream writes straight
		// into what is rendered.
		const live = messages[messages.length - 1];

		controller = new AbortController();

		try {
			const response = await fetch('/api/tic-admin/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					model: assistantSettings.modelId,
					apiKey: assistantSettings.apiKey || undefined,
					messages: messages
						.filter((message) => message !== live && (message.text || message.images.length))
						.map((message) => ({
							role: message.role === 'you' ? 'user' : 'assistant',
							content: message.text,
							images: message.images
						}))
				})
			});

			if (!response.ok || !response.body) {
				const detail = await response
					.json()
					.then((payload) => payload?.message)
					.catch(() => null);
				throw new Error(detail || `The assistant request failed (${response.status}).`);
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// One JSON object per line, and a chunk can split a line in half, so
				// only whole lines are consumed and the remainder waits for more.
				let newline: number;
				while ((newline = buffer.indexOf('\n')) >= 0) {
					const line = buffer.slice(0, newline).trim();
					buffer = buffer.slice(newline + 1);
					if (!line) continue;

					let event: { type: string; delta?: string; label?: string; message?: string };
					try {
						event = JSON.parse(line);
					} catch {
						continue;
					}

					if (event.type === 'text' && event.delta) {
						live.text += event.delta;
						await follow();
					} else if (event.type === 'reasoning' && event.delta) {
						live.reasoning += event.delta;
						await follow();
					} else if (event.type === 'step' && event.label) {
						live.steps = [...live.steps, event.label];
						await follow();
					} else if (event.type === 'error' && event.message) {
						live.error = event.message;
					}
				}
			}
		} catch (cause) {
			if (cause instanceof Error && cause.name === 'AbortError') {
				live.error = live.text.trim() ? '' : 'Stopped.';
			} else {
				live.error = cause instanceof Error ? cause.message : 'The assistant failed.';
			}
		} finally {
			live.streaming = false;
			busy = false;
			controller = null;
			await follow();
		}
	}

	// Nothing is kept between threads — there is no history to go back to — so
	// starting over is the one action here that actually destroys something, and
	// it asks first once there is a conversation to lose.
	async function newChat() {
		if (!empty) {
			const ok = await askConfirm({
				title: 'Start a new chat?',
				body: 'This conversation is not saved anywhere, so it will be gone.',
				confirmLabel: 'Start new chat',
				tone: 'danger'
			});
			if (!ok) return;
		}

		stop();
		messages = [];
		draft = '';
		pending = [];
		busy = false;

		await tick();
		grow();
		box?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		// Enter sends, Shift+Enter breaks the line — the convention everywhere else
		// people type into a chat.
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send(draft);
		}
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}
</script>

<svelte:head>
	<title>TIC Admin · Assistant</title>
</svelte:head>

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	assistantHref="/tic-admin/ai"
	title="Assistant"
	eyebrow="Ask"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<span class="status" class:status--off={!configured}>
			{#if configured}{model.label}{:else}Not connected{/if}
		</span>
		<button
			type="button"
			class="gear"
			onclick={newChat}
			disabled={empty && !busy}
			title="New chat"
			aria-label="New chat"
		>
			<SquarePen size={16} strokeWidth={1.9} />
		</button>
		<button type="button" class="gear" onclick={openSettings} aria-label="Assistant settings">
			<Settings size={16} strokeWidth={1.9} />
		</button>
	{/snippet}

	<div class="chat">
		<div class="chat__thread" bind:this={thread}>
			{#if empty}
				<div class="opener">
					<span class="opener__mark" aria-hidden="true">
						<Sparkles size={22} strokeWidth={1.6} />
					</span>
					<h2 class="opener__title">What can I do for you, {firstName}?</h2>
					<p class="opener__sub">
						Ask about anything in the console — the content, the email templates, who applied and
						where they stand. I read the database to answer; I never change it.
					</p>
					<ul class="chips">
						{#each SUGGESTIONS as suggestion (suggestion)}
							<li>
								<button type="button" class="chip" onclick={() => send(suggestion)}>
									{suggestion}
								</button>
							</li>
						{/each}
					</ul>
					{#if !configured}
						<button type="button" class="opener__link" onclick={openSettings}>
							Add a Sarvam API key to begin
						</button>
					{/if}
				</div>
			{:else}
				<ul class="msgs">
					{#each messages as message (message.id)}
						<li class="msg msg--{message.role}">
							{#if message.role === 'you'}
								<span class="msg__who">You</span>
								{#if message.images.length}
									<ul class="shots">
										{#each message.images as image, index (index)}
											<li><img src={image} alt="" /></li>
										{/each}
									</ul>
								{/if}
								{#if message.text}
									<p class="msg__text">{message.text}</p>
								{/if}
							{:else}
								<span class="msg__who msg__who--bot">
									<Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
									Assistant
								</span>

								{#if message.reasoning}
									<details class="think" open={message.streaming && !message.text.trim()}>
										<summary class="think__head">
											{message.streaming && !message.text.trim()
												? 'Thinking…'
												: 'Thought it through'}
										</summary>
										<p class="think__body">{message.reasoning}</p>
									</details>
								{/if}

								{#if message.steps.length}
									<ul class="steps">
										{#each message.steps as step, index (index)}
											<li class="step">
												<Check size={12} strokeWidth={2.4} aria-hidden="true" />
												{step}
											</li>
										{/each}
									</ul>
								{/if}

								{#if message.text.trim()}
									<!-- renderMarkdown HTML-escapes the reply before it adds a single
										 tag, so the only markup here is the handful it emits itself.
										 Model output is untrusted — it echoes database rows. -->
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<div class="md">{@html renderMarkdown(message.text.trim())}</div>
								{/if}

								{#if message.streaming && !message.text.trim() && !message.reasoning}
									<p class="thinking">
										<span class="dot"></span><span class="dot"></span><span class="dot"></span>
									</p>
								{/if}

								{#if message.error}
									<p class="fail">{message.error}</p>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="composer">
			{#if pending.length}
				<ul class="queue">
					{#each pending as image, index (index)}
						<li class="queue__item">
							<img src={image} alt="" />
							<button
								type="button"
								class="queue__drop"
								onclick={() => removeAttachment(index)}
								aria-label="Remove attachment"
							>
								<X size={12} strokeWidth={2.4} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<textarea
				class="composer__box"
				bind:this={box}
				bind:value={draft}
				oninput={grow}
				onkeydown={onKeydown}
				rows="1"
				placeholder="Ask, or describe what you want done…"
				aria-label="Message the assistant"
			></textarea>

			<div class="composer__bar">
				{#if model.images}
					<input
						type="file"
						accept="image/*"
						multiple
						class="composer__file"
						bind:this={picker}
						onchange={onPick}
						tabindex="-1"
						aria-hidden="true"
					/>
					<button
						type="button"
						class="composer__icon"
						title="Attach an image"
						aria-label="Attach an image"
						onclick={() => picker?.click()}
					>
						<Paperclip size={16} strokeWidth={1.9} />
					</button>
				{/if}

				<span class="composer__hint">Enter to send · Shift + Enter for a new line</span>

				{#if busy}
					<button type="button" class="composer__send" aria-label="Stop" onclick={stop}>
						<Square size={13} strokeWidth={2.4} fill="currentColor" />
					</button>
				{:else}
					<button
						type="button"
						class="composer__send"
						disabled={!canSend}
						aria-label="Send"
						onclick={() => send(draft)}
					>
						<ArrowUp size={17} strokeWidth={2.2} />
					</button>
				{/if}
			</div>
		</div>
	</div>
</AdminShell>

<dialog
	bind:this={settingsEl}
	class="sheet"
	onclose={() => (settingsOpen = false)}
	onclick={(event) => {
		if (event.target === settingsEl) settingsOpen = false;
	}}
>
	{#if settingsOpen}
		<form class="sheet__panel" onsubmit={saveSettings}>
			<header class="sheet__head">
				<div>
					<h2 class="sheet__title">Assistant settings</h2>
					<p class="sheet__sub">
						The key stays in this browser and is sent with each question. It is never saved to the
						database.
					</p>
				</div>
				<button
					type="button"
					class="sheet__close"
					onclick={() => (settingsOpen = false)}
					aria-label="Close"
				>
					<X size={16} strokeWidth={2} />
				</button>
			</header>

			<div class="field">
				<label class="field__label" for="sarvam-key">Sarvam API key</label>
				<div class="field__row">
					{#if keyVisible}
						<input
							id="sarvam-key"
							class="field__input"
							type="text"
							bind:value={keyDraft}
							placeholder="sk_…"
							autocomplete="off"
							spellcheck="false"
						/>
					{:else}
						<input
							id="sarvam-key"
							class="field__input"
							type="password"
							bind:value={keyDraft}
							placeholder="sk_…"
							autocomplete="off"
							spellcheck="false"
						/>
					{/if}
					<button type="button" class="field__toggle" onclick={() => (keyVisible = !keyVisible)}>
						{keyVisible ? 'Hide' : 'Show'}
					</button>
				</div>
				<p class="field__note">
					{#if data.hasServerKey}
						This deployment already has a key set on the server. Paste one here only to use your own
						instead.
					{:else}
						From your Sarvam dashboard. Anyone who can open this browser profile can read it, so
						rotate it if the machine is shared.
					{/if}
				</p>
			</div>

			<div class="field">
				<span class="field__label">Model</span>
				<ul class="models">
					{#each ASSISTANT_MODELS as option (option.id)}
						<li>
							<label class="model" class:model--on={modelDraft === option.id}>
								<input type="radio" name="model" value={option.id} bind:group={modelDraft} />
								<span class="model__body">
									<span class="model__name">
										{option.label}
										<span class="model__tag">{option.contextLabel}</span>
									</span>
									<span class="model__blurb">{option.blurb}</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
				<p class="field__note">
					Only Gemma 4 accepts images, so the attach button appears for that model alone.
				</p>
			</div>

			<footer class="sheet__foot">
				{#if assistantSettings.apiKey}
					<button type="button" class="sheet__forget" onclick={forgetKey}> Forget this key </button>
				{/if}
				<button type="button" class="sheet__cancel" onclick={() => (settingsOpen = false)}>
					Cancel
				</button>
				<button type="submit" class="sheet__save">Save</button>
			</footer>
		</form>
	{/if}
</dialog>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	// ---- header ---------------------------------------------------------------

	.status {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		color: admin-tone-fg('violet');
		background: admin-tone-bg('violet');
		border-radius: $admin-radius-pill;
		padding: 6px 12px;
	}

	.status--off {
		color: $admin-ink-3;
		background: $admin-sunken;
	}

	.gear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 34px;
		height: 34px;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover:not(:disabled) {
			color: $admin-ink;
		}

		&:active:not(:disabled) {
			transform: translateY(0.5px);
		}

		&:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
	}

	// ---- shell ----------------------------------------------------------------

	.chat {
		@include admin-panel;
		display: flex;
		flex-direction: column;
		height: min(72vh, 780px);
		min-height: 460px;
	}

	.chat__thread {
		flex: 1;
		overflow-y: auto;
		padding: 26px;
		scroll-behavior: smooth;
	}

	@media (prefers-reduced-motion: reduce) {
		.chat__thread {
			scroll-behavior: auto;
		}
	}

	// ---- empty state ---------------------------------------------------------

	.opener {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 10px;
		padding: 20px 0;
	}

	.opener__mark {
		@include admin-icon-tile('violet', 52px);
		margin-bottom: 4px;
	}

	.opener__title {
		margin: 0;
		font-family: $font-family-serif;
		font-size: 26px;
		font-weight: $font-weight-regular;
		letter-spacing: -0.02em;
		color: $admin-ink;
	}

	.opener__sub {
		margin: 0;
		max-width: 52ch;
		font-size: 13px;
		line-height: 1.65;
		color: $admin-ink-2;
	}

	.opener__link {
		font: inherit;
		font-size: 12.5px;
		font-weight: $font-weight-semibold;
		color: $admin-accent;
		background: none;
		border: 0;
		border-radius: $admin-radius-sm;
		margin-top: 14px;
		padding: 4px 6px;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
		@include admin-focus-ring($admin-accent);
	}

	.chips {
		list-style: none;
		margin: 18px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		max-width: 620px;
	}

	.chip {
		font: inherit;
		font-size: 12.5px;
		color: $admin-ink-2;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
		padding: 8px 14px;
		cursor: pointer;
		text-align: left;
		@include admin-focus-ring;

		&:hover {
			color: $admin-ink;
			border-color: $admin-line;
		}

		&:active {
			transform: translateY(0.5px);
		}
	}

	// ---- messages ------------------------------------------------------------

	.msgs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 70ch;
	}

	.msg--you {
		margin-left: auto;
		align-items: flex-end;
		text-align: right;
	}

	.msg__who {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.msg__who--bot {
		color: admin-tone-fg('violet');
	}

	.msg__text {
		margin: 0;
		font-size: 14px;
		line-height: 1.65;
		color: $admin-ink;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-lg;
		padding: 12px 16px;
	}

	// Images sent with a question, shown back so the thread is a full record of
	// what was actually asked.
	.shots {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;

		img {
			display: block;
			width: 92px;
			height: 92px;
			object-fit: cover;
			border-radius: $admin-radius-md;
			border: 1px solid $admin-line;
		}
	}

	// ---- what the assistant looked at ----------------------------------------

	.steps {
		list-style: none;
		margin: 0 0 2px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.step {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		color: $admin-ink-3;
	}

	// The model's working-out. Deliberately quiet and collapsed once the answer
	// itself arrives: it is useful for seeing why a figure was reached, and noise
	// the rest of the time.
	.think {
		font-size: 12px;
		color: $admin-ink-3;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
		padding: 8px 12px;
		margin-bottom: 2px;
	}

	.think__head {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.03em;
		color: $admin-ink-3;
		cursor: pointer;
		list-style: none;
		@include admin-focus-ring;

		&::-webkit-details-marker {
			display: none;
		}

		&::before {
			content: '▸';
			display: inline-block;
			margin-right: 6px;
			transition: transform $transition-fast;
		}
	}

	.think[open] .think__head::before {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.think__head::before {
			transition: none;
		}
	}

	.think__body {
		margin: 8px 0 0;
		max-height: 190px;
		overflow-y: auto;
		font-size: 12px;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: $admin-ink-3;
	}

	.thinking {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 6px 0 0;
		padding-left: 2px;
	}

	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: $admin-ink-3;
		animation: pulse 1.2s ease-in-out infinite;

		&:nth-child(2) {
			animation-delay: 0.15s;
		}

		&:nth-child(3) {
			animation-delay: 0.3s;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
			opacity: 0.5;
		}
	}

	.fail {
		@include admin-msg('bad');
		margin-top: 6px;
		font-size: 12.5px;
	}

	// ---- rendered reply ------------------------------------------------------

	.md {
		font-size: 14px;
		line-height: 1.7;
		color: $admin-ink;
		overflow-wrap: anywhere;

		// The renderer emits these, so they are reached through :global rather than
		// being scoped away by the compiler.
		:global(p) {
			margin: 0 0 10px;
		}

		:global(p:last-child),
		:global(ul:last-child),
		:global(ol:last-child) {
			margin-bottom: 0;
		}

		:global(.md-h) {
			font-weight: $font-weight-semibold;
			margin-top: 14px;
		}

		:global(ul),
		:global(ol) {
			margin: 0 0 10px;
			padding-left: 20px;
		}

		:global(li) {
			margin-bottom: 4px;
		}

		:global(strong) {
			font-weight: $font-weight-semibold;
		}

		:global(code) {
			font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			font-size: 0.88em;
			background: $admin-sunken;
			border: 1px solid $admin-line-soft;
			border-radius: 5px;
			padding: 1px 5px;
		}

		// Wide tables scroll inside the bubble rather than stretching the thread.
		:global(.md-table) {
			overflow-x: auto;
			margin: 0 0 10px;
			border: 1px solid $admin-line;
			border-radius: $admin-radius-md;
		}

		:global(table) {
			border-collapse: collapse;
			width: 100%;
			font-size: 12.5px;
		}

		:global(th) {
			text-align: left;
			font-weight: $font-weight-semibold;
			white-space: nowrap;
			color: $admin-ink-2;
			background: $admin-sunken;
			padding: 8px 12px;
			border-bottom: 1px solid $admin-line;
		}

		:global(td) {
			padding: 8px 12px;
			vertical-align: top;
			border-bottom: 1px solid $admin-line-soft;
		}

		:global(tbody tr:last-child td) {
			border-bottom: 0;
		}

		:global(blockquote) {
			margin: 0 0 10px;
			padding: 2px 0 2px 12px;
			border-left: 2px solid $admin-line;
			color: $admin-ink-2;
		}

		:global(a) {
			color: $admin-accent;
			text-underline-offset: 2px;
		}
	}

	// ---- composer ------------------------------------------------------------

	.composer {
		border-top: 1px solid $admin-line-soft;
		padding: 14px 18px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.composer__box {
		@include admin-input;
		resize: none;
		min-height: 44px;
		max-height: 200px;
		line-height: 1.55;
		overflow-y: auto;
	}

	.composer__bar {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.composer__hint {
		font-size: 11px;
		color: $admin-ink-3;
		margin-right: auto;
	}

	.composer__file {
		display: none;
	}

	.composer__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 32px;
		height: 32px;
		color: $admin-ink-3;
		background: transparent;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			color: $admin-ink;
		}
	}

	.composer__send {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 34px;
		height: 34px;
		color: $color-white;
		background: $admin-ink;
		border: 1px solid $admin-ink;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:active {
			transform: translateY(0.5px);
		}

		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}
	}

	// ---- queued attachments --------------------------------------------------

	.queue {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.queue__item {
		position: relative;

		img {
			display: block;
			width: 56px;
			height: 56px;
			object-fit: cover;
			border-radius: $admin-radius-sm;
			border: 1px solid $admin-line;
		}
	}

	.queue__drop {
		position: absolute;
		top: -6px;
		right: -6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		color: $color-white;
		background: $admin-ink;
		border: 0;
		border-radius: 50%;
		cursor: pointer;
		@include admin-focus-ring;
	}

	// ---- settings dialog -----------------------------------------------------

	.sheet {
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		// The reset zeroes every margin, which takes the UA's `margin: auto` with
		// it and leaves a modal <dialog> pinned to the top-left.
		margin: auto;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;

		&::backdrop {
			background: rgba(12, 15, 20, 0.42);
		}
	}

	.sheet__panel {
		@include admin-panel-raised;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		font-family: $font-family-base;
		max-height: calc(100vh - 64px);
		overflow-y: auto;
	}

	.sheet__head {
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}

	.sheet__title {
		margin: 0 0 4px;
		font-family: $font-family-serif;
		font-size: 19px;
		font-weight: $font-weight-regular;
		letter-spacing: -0.01em;
		color: $admin-ink;
	}

	.sheet__sub {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.6;
		color: $admin-ink-2;
	}

	.sheet__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		margin-left: auto;
		width: 30px;
		height: 30px;
		color: $admin-ink-3;
		background: transparent;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field__label {
		@include admin-field-label;
	}

	.field__row {
		display: flex;
		gap: 8px;
	}

	.field__input {
		@include admin-input;
		flex: 1;
		min-width: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
	}

	.field__toggle {
		@include admin-btn-base;
		flex: none;
		padding: 0 14px;
		font-size: 12px;
	}

	.field__note {
		margin: 0;
		font-size: 11.5px;
		line-height: 1.6;
		color: $admin-ink-3;
	}

	// ---- model picker --------------------------------------------------------

	.models {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.model {
		display: flex;
		align-items: flex-start;
		gap: 11px;
		padding: 13px 15px;
		background: $admin-surface;
		border: 1px solid $admin-field-border;
		border-radius: $admin-radius-md;
		cursor: pointer;
		transition:
			border-color $transition-fast,
			box-shadow $transition-fast;

		&:hover {
			border-color: $admin-ink-3;
		}

		// The ring follows the radio inside, so the whole row shows focus rather
		// than a dot the eye has to hunt for.
		&:focus-within {
			border-color: $admin-accent;
			box-shadow: 0 0 0 3px rgba(32, 80, 212, 0.14);
		}

		input {
			flex: none;
			margin: 2px 0 0;
			accent-color: $admin-accent;
			// 44 px of comfortable target comes from the label wrapping the input,
			// so the control itself only has to be visible.
			width: 15px;
			height: 15px;
		}
	}

	.model--on {
		border-color: $admin-accent;
		background: admin-tone-bg('info');
	}

	.model__body {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	.model__name {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 13.5px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
	}

	.model__tag {
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		color: $admin-ink-3;
		background: $admin-sunken;
		border-radius: $admin-radius-pill;
		padding: 3px 8px;
	}

	.model__blurb {
		font-size: 12px;
		line-height: 1.55;
		color: $admin-ink-2;
	}

	.sheet__foot {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.sheet__forget {
		@include admin-btn-base;
		margin-right: auto;
		color: admin-tone-fg('bad');
		border-color: transparent;
		background: admin-tone-bg('bad');
	}

	.sheet__cancel {
		@include admin-btn-base;
		margin-left: auto;
	}

	.sheet__save {
		@include admin-btn-primary;
	}

	@media (max-width: $bp-sm) {
		.chat {
			height: auto;
			min-height: 70vh;
		}

		.chat__thread {
			padding: 18px;
		}

		.composer__hint {
			display: none;
		}

		.sheet__foot {
			flex-wrap: wrap;
		}
	}
</style>
