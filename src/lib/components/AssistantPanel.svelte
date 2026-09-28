<script lang="ts">
	import { tick } from 'svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Settings from '@lucide/svelte/icons/settings-2';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import Square from '@lucide/svelte/icons/square';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import History from '@lucide/svelte/icons/history';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Zap from '@lucide/svelte/icons/zap';
	import FileText from '@lucide/svelte/icons/file-text';
	import { ASSISTANT_MODELS } from '$lib/utils/assistantModels';
	import { assistantPanel } from '$lib/utils/assistantPanel.svelte';
	import { assistantSettings } from '$lib/utils/assistantSettings.svelte';
	import { renderMarkdown } from '$lib/utils/assistantMarkdown';
	import { showToast } from '$lib/utils/toast.svelte';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	// The assistant, as a panel docked beside whichever console page is open. It
	// is mounted once by the /tic-admin layout and only hidden when closed, so a
	// conversation carries on across pages and survives the panel being shut.

	interface Props {
		adminName: string;
		/** The deployment has SARVAM_API_KEY set, so nobody has to paste one. */
		hasServerKey: boolean;
		/** SARVAM_MODEL_ID, used until the admin picks a model themselves. */
		defaultModel: string;
	}

	let { adminName, hasServerKey, defaultModel }: Props = $props();

	const firstName = $derived(adminName.trim().split(/\s+/)[0]);

	$effect(() => {
		assistantSettings.useDefaultModel(defaultModel);
	});

	// Either the deployment carries a shared key, or the admin pasted their own
	// into settings. Without either there is nothing to send a request with.
	const configured = $derived(Boolean(assistantSettings.apiKey) || hasServerKey);
	const model = $derived(assistantSettings.model);

	// A content edit the assistant wants to make, waiting on the admin. Only ever
	// appears in manual-approval mode; in auto mode the write just happens.
	type Proposal = {
		id: string;
		tool: string;
		args: Record<string, unknown>;
		summary: string;
		before: unknown;
		after: unknown;
		/** For an email proposal: the rendered message, shown instead of before/after. */
		html: string;
		status: 'pending' | 'applying' | 'approved' | 'rejected' | 'error';
		error: string;
		/** What happened once applied — e.g. how many the newsletter reached. */
		note: string;
	};

	// A file the admin attached. It is uploaded to a public bucket on attach, so
	// `url` is a link the assistant can drop into content or an email — an image
	// into a member's avatar, a PDF as an email attachment. The assistant only
	// ever gets the name and URL, never the file's contents. `dataUrl` is the
	// thumbnail for an image; `size` the human label for a document.
	type Attachment = {
		id: number;
		name: string;
		url: string;
		kind: 'image' | 'file';
		size: string;
		dataUrl: string;
		uploading: boolean;
	};

	type Message = {
		id: number;
		role: 'you' | 'assistant';
		text: string;
		/** Images the admin attached, already uploaded to the media bucket. */
		attachments: Attachment[];
		/** What the assistant looked at, in the order it looked. */
		steps: string[];
		/** sarvam-105b reasons out loud before answering. Kept separate from the
		 *  answer, because it is working-out and not a claim about the data. */
		reasoning: string;
		/** Content edits it is asking to make, in manual-approval mode. */
		proposals: Proposal[];
		streaming: boolean;
		error: string;
	};

	let messages = $state<Message[]>([]);
	let draft = $state('');
	let pending = $state<Attachment[]>([]);
	let busy = $state(false);
	let thread = $state<HTMLDivElement | null>(null);
	let box = $state<HTMLTextAreaElement | null>(null);
	let picker = $state<HTMLInputElement | null>(null);
	let nextId = 0;
	let attachSeq = 0;
	let controller: AbortController | null = null;

	// ---- saved chats ---------------------------------------------------------

	// The row this conversation is saved as, once it has been. Autosaved after
	// every turn, so leaving and coming back to it loses nothing.
	let conversationId = $state<string | null>(null);
	let conversations = $state<{ id: string; title: string; updated_at: string }[]>([]);
	let historyOpen = $state(false);
	let historyLoading = $state(false);

	const empty = $derived(messages.length === 0);
	const uploading = $derived(pending.some((item) => item.uploading));
	const canSend = $derived(!busy && !uploading && (draft.trim().length > 0 || pending.length > 0));

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

	let historyEl = $state<HTMLDialogElement | null>(null);

	// Opening the panel is a request to type, so the composer takes focus — after
	// the slide-in has started, or the browser scrolls the page to reach it.
	$effect(() => {
		if (!assistantPanel.open) return;
		const timer = setTimeout(() => box?.focus({ preventScroll: true }), 60);
		return () => clearTimeout(timer);
	});

	// <dialog> is what gives the focus trap, the inert background and Esc to
	// dismiss, the same as the app's confirm dialog.
	$effect(() => {
		if (!settingsEl) return;
		if (settingsOpen && !settingsEl.open) settingsEl.showModal();
		else if (!settingsOpen && settingsEl.open) settingsEl.close();
	});

	$effect(() => {
		if (!historyEl) return;
		if (historyOpen && !historyEl.open) historyEl.showModal();
		else if (!historyOpen && historyEl.open) historyEl.close();
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
		showToast('Assistant settings saved.');
		settingsOpen = false;
	}

	function forgetKey() {
		assistantSettings.forget();
		keyDraft = '';
		showToast('The key was removed from this browser.', 'info');
	}

	// ---- attachments ---------------------------------------------------------

	// Both buckets cap an upload at 5 MB, so anything larger is refused here before
	// it is sent. Non-image files can only be what an email can carry.
	const MAX_BYTES = 5 * 1024 * 1024;
	const FILE_TYPES = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'text/plain',
		'text/csv'
	];

	function readAsDataUrl(file: File): Promise<string> {
		return new Promise((done, fail) => {
			const reader = new FileReader();
			reader.onload = () => done(String(reader.result));
			reader.onerror = () => fail(new Error(`Could not read ${file.name}.`));
			reader.readAsDataURL(file);
		});
	}

	// Images go to the site's media bucket, so the assistant can place one into
	// content; other files go to the email-assets bucket, so it can attach one to
	// an email. Both return a public URL the assistant is handed as text.
	async function uploadAsset(file: File, image: boolean): Promise<{ url: string; size: string }> {
		const endpoint = image ? '/api/tic-admin/content/assets' : '/api/tic-admin/email/assets';
		const form = new FormData();
		form.append('file', file);
		const response = await fetch(endpoint, { method: 'POST', body: form });
		if (!response.ok) {
			const detail = await response
				.json()
				.then((payload) => payload?.message)
				.catch(() => null);
			throw new Error(detail || 'The upload failed.');
		}
		const payload = await response.json();
		return { url: payload.url as string, size: (payload.size as string) ?? '' };
	}

	async function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';

		for (const file of files) {
			const isImage = file.type.startsWith('image/');
			if (!isImage && !FILE_TYPES.includes(file.type)) {
				showToast(`${file.name} is not a supported file.`, 'err');
				continue;
			}
			if (file.size > MAX_BYTES) {
				showToast(`${file.name} is larger than 5 MB.`, 'err');
				continue;
			}

			// Show the chip immediately, then upload — the row flips out of its
			// uploading state once the bucket has the file and a URL to point at.
			// Updates go through a whole-array reassignment keyed by id: mutating the
			// pushed object in place would not fire the reactive setter, so the
			// uploading flag (and the send button that watches it) would never update.
			const id = attachSeq++;
			const attachment: Attachment = {
				id,
				name: file.name,
				url: '',
				kind: isImage ? 'image' : 'file',
				size: '',
				dataUrl: isImage ? await readAsDataUrl(file).catch(() => '') : '',
				uploading: true
			};

			pending = [...pending, attachment];
			try {
				const uploaded = await uploadAsset(file, isImage);
				pending = pending.map((item) =>
					item.id === id
						? { ...item, url: uploaded.url, size: uploaded.size, uploading: false }
						: item
				);
			} catch (cause) {
				pending = pending.filter((item) => item.id !== id);
				showToast(cause instanceof Error ? cause.message : `Could not upload ${file.name}.`, 'err');
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

		const question: Message = {
			id: nextId++,
			role: 'you',
			text: body,
			attachments: pending,
			steps: [],
			reasoning: '',
			proposals: [],
			streaming: false,
			error: ''
		};
		const reply: Message = {
			id: nextId++,
			role: 'assistant',
			text: '',
			attachments: [],
			steps: [],
			reasoning: '',
			proposals: [],
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
					autoApprove: assistantSettings.autoApprove,
					messages: messages
						.filter((message) => message !== live && (message.text || message.attachments.length))
						.map((message) => ({
							role: message.role === 'you' ? 'user' : 'assistant',
							content: message.text,
							// URLs let any model place a file into content or an email; the
							// base64 data URIs are only images, only for a vision model.
							attachments: message.attachments
								.filter((item) => item.url)
								.map((item) => ({
									name: item.name,
									url: item.url,
									kind: item.kind,
									size: item.size
								})),
							images: model.images
								? message.attachments
										.filter((item) => item.kind === 'image')
										.map((item) => item.dataUrl)
								: []
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

					let event: {
						type: string;
						delta?: string;
						label?: string;
						message?: string;
						id?: string;
						tool?: string;
						args?: Record<string, unknown>;
						summary?: string;
						before?: unknown;
						after?: unknown;
						html?: string;
					};
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
					} else if (event.type === 'proposal' && event.id && event.tool) {
						live.proposals = [
							...live.proposals,
							{
								id: event.id,
								tool: event.tool,
								args: event.args ?? {},
								summary: event.summary ?? 'Content change',
								before: event.before,
								after: event.after,
								html: event.html ?? '',
								status: 'pending',
								error: '',
								note: ''
							}
						];
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
			// Persist the exchange so it survives a reload and shows in history.
			saveConversation();
		}
	}

	// The current chat is autosaved after every turn, so starting a new one loses
	// nothing — the last is already in history. No confirmation to get in the way.
	async function newChat() {
		stop();
		messages = [];
		draft = '';
		pending = [];
		busy = false;
		conversationId = null;

		await tick();
		grow();
		box?.focus();
	}

	// A conversation is worth saving once the assistant has actually answered.
	// Images are dropped from the stored copy — a base64 attachment would bloat the
	// row for little value once the question has been answered.
	function saveConversation() {
		if (!messages.some((message) => message.role === 'assistant' && message.text.trim())) return;

		const firstAsk = messages.find((message) => message.role === 'you' && message.text.trim());
		const title = firstAsk ? firstAsk.text.trim().slice(0, 120) : 'New chat';
		const stored = messages
			.filter((message) => message.text || message.steps.length)
			.map((message) => ({
				role: message.role,
				text: message.text,
				steps: message.steps,
				reasoning: message.reasoning
			}));

		fetch('/api/tic-admin/ai/conversations', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: conversationId, title, messages: stored })
		})
			.then((response) => (response.ok ? response.json() : null))
			.then((payload) => {
				if (payload?.id) conversationId = payload.id;
			})
			.catch(() => {
				// A failed autosave must never interrupt the chat.
			});
	}

	async function openHistory() {
		historyOpen = true;
		historyLoading = true;
		try {
			const response = await fetch('/api/tic-admin/ai/conversations');
			if (response.ok) conversations = (await response.json()).conversations ?? [];
		} catch {
			// Leave the list as it was; the panel shows the empty state.
		} finally {
			historyLoading = false;
		}
	}

	async function openConversation(id: string) {
		if (busy) stop();
		try {
			const response = await fetch(`/api/tic-admin/ai/conversations?id=${id}`);
			if (!response.ok) {
				showToast('Could not open that chat.', 'err');
				return;
			}
			const { conversation } = await response.json();
			messages = (conversation.messages ?? []).map(
				(m: { role?: string; text?: string; steps?: string[]; reasoning?: string }) => ({
					id: nextId++,
					role: m.role === 'assistant' ? 'assistant' : 'you',
					text: m.text ?? '',
					attachments: [],
					steps: m.steps ?? [],
					reasoning: m.reasoning ?? '',
					proposals: [],
					streaming: false,
					error: ''
				})
			);
			conversationId = conversation.id;
			historyOpen = false;
			await tick();
			grow();
			await follow(true);
		} catch {
			showToast('Could not open that chat.', 'err');
		}
	}

	async function deleteConversation(id: string) {
		const ok = await askConfirm({
			title: 'Delete this chat?',
			body: 'It will be removed for good.',
			confirmLabel: 'Delete',
			tone: 'danger'
		});
		if (!ok) return;

		try {
			await fetch(`/api/tic-admin/ai/conversations?id=${id}`, { method: 'DELETE' });
			conversations = conversations.filter((chat) => chat.id !== id);
			if (conversationId === id) {
				conversationId = null;
				messages = [];
			}
		} catch {
			showToast('Could not delete that chat.', 'err');
		}
	}

	// ---- approvals -----------------------------------------------------------

	function toggleApprove() {
		assistantSettings.setAutoApprove(!assistantSettings.autoApprove);
		showToast(
			assistantSettings.autoApprove
				? 'Edits will now apply automatically.'
				: 'Edits will now wait for your approval.',
			'info'
		);
	}

	// Applying runs the very same tool the assistant would have, server-side —
	// see /api/tic-admin/ai/apply — so the edit is audited exactly as an auto one.
	async function approveProposal(proposal: Proposal) {
		proposal.status = 'applying';
		try {
			const response = await fetch('/api/tic-admin/ai/apply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool: proposal.tool, args: proposal.args })
			});
			if (!response.ok) {
				const detail = await response
					.json()
					.then((payload) => payload?.message)
					.catch(() => null);
				proposal.status = 'error';
				proposal.error = detail || 'The change could not be applied.';
				return;
			}

			// A newsletter blast reports how many it reached; a plain edit does not.
			const result = await response
				.json()
				.then((payload) => payload?.result)
				.catch(() => null);
			proposal.status = 'approved';
			if (result && typeof result.sent === 'number') {
				const extra =
					result.blocked || result.failed
						? ` (${result.blocked} blocked, ${result.failed} failed)`
						: '';
				proposal.note = `Sent to ${result.sent} of ${result.recipients} recipient${result.recipients === 1 ? '' : 's'}${extra}`;
				showToast(`Email sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}.`);
			} else {
				showToast('Change applied to the site.');
			}
		} catch {
			proposal.status = 'error';
			proposal.error = 'The change could not be applied.';
		}
	}

	function rejectProposal(proposal: Proposal) {
		proposal.status = 'rejected';
	}

	// Size the email preview to its own height so it shows the whole message with
	// no scrollbar of its own. allow-same-origin lets us read the rendered height;
	// the frame runs no scripts.
	function fitEmailFrame(event: Event) {
		const frame = event.currentTarget as HTMLIFrameElement;
		const doc = frame.contentDocument;
		if (doc) frame.style.height = `${doc.documentElement.scrollHeight + 4}px`;
	}

	// A compact, readable rendering of a proposed value for the before/after card.
	function preview(value: unknown): string {
		if (value === undefined || value === null) return '—';
		const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
		return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
	}

	// When a proposed value is itself an image URL, the card shows the picture
	// rather than the link — the point of an image edit is what it looks like.
	function imageUrl(value: unknown): string {
		return typeof value === 'string' &&
			/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(value)
			? value
			: '';
	}

	function onKeydown(event: KeyboardEvent) {
		// Enter sends, Shift+Enter breaks the line — the convention everywhere else
		// people type into a chat.
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send(draft);
		}
	}
</script>

<div class="chat">
	<header class="head">
		<span class="head__mark" aria-hidden="true">
			<Sparkles size={15} strokeWidth={1.9} />
		</span>
		<div class="head__text">
			<h2 class="head__title">Assistant</h2>
			<span class="head__model" class:head__model--off={!configured}>
				{#if configured}{model.label}{:else}No API key{/if}
			</span>
		</div>
		<div class="head__actions">
			<button
				type="button"
				class="mode"
				class:mode--auto={assistantSettings.autoApprove}
				onclick={toggleApprove}
				title={assistantSettings.autoApprove
					? 'Edits apply automatically — click to require your approval'
					: 'Edits wait for your approval — click to apply them automatically'}
			>
				{#if assistantSettings.autoApprove}
					<Zap size={13} strokeWidth={2} aria-hidden="true" /> Auto
				{:else}
					<ShieldCheck size={13} strokeWidth={2} aria-hidden="true" /> Review
				{/if}
			</button>
			<button
				type="button"
				class="gear"
				onclick={openHistory}
				title="Chat history"
				aria-label="Chat history"
			>
				<History size={16} strokeWidth={1.9} />
			</button>
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
			<button
				type="button"
				class="gear"
				onclick={openSettings}
				title="Assistant settings"
				aria-label="Assistant settings"
			>
				<Settings size={16} strokeWidth={1.9} />
			</button>
			<button
				type="button"
				class="gear"
				onclick={() => assistantPanel.close()}
				title="Close (Esc)"
				aria-label="Close the assistant"
			>
				<X size={16} strokeWidth={1.9} />
			</button>
		</div>
	</header>

	<div class="chat__thread" bind:this={thread}>
		{#if empty}
			<div class="opener">
				<span class="opener__mark" aria-hidden="true">
					<Sparkles size={22} strokeWidth={1.6} />
				</span>
				<h2 class="opener__title">What can I do for you, {firstName}?</h2>
				<p class="opener__sub">
					Ask about anything in the console — the content, the email templates, who applied and
					where they stand. I can edit the website's copy for you; everything else I only read.
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
			</div>
		{:else}
			<ul class="msgs">
				{#each messages as message (message.id)}
					<li class="msg msg--{message.role}">
						{#if message.role === 'you'}
							<span class="msg__who">You</span>
							{#if message.attachments.length}
								<ul class="shots">
									{#each message.attachments as shot, index (index)}
										<li>
											{#if shot.kind === 'image' && (shot.dataUrl || shot.url)}
												<img src={shot.dataUrl || shot.url} alt={shot.name} />
											{:else}
												<span class="doc">
													<FileText size={15} strokeWidth={1.8} aria-hidden="true" />
													<span class="doc__name">{shot.name}</span>
												</span>
											{/if}
										</li>
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
										{message.streaming && !message.text.trim() ? 'Thinking…' : 'Thought it through'}
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

							{#each message.proposals as proposal (proposal.id)}
								<div class="prop" class:prop--done={proposal.status !== 'pending'}>
									<p class="prop__head">
										<ShieldCheck size={13} strokeWidth={2} aria-hidden="true" />
										{proposal.summary}
									</p>
									{#if proposal.html}
										<!-- The rendered email, so a non-technical admin approves how the
												 message looks rather than its HTML. allow-same-origin (without
												 allow-scripts) keeps the content inert but lets us measure it, so
												 the frame is sized to the email and never grows its own scrollbar. -->
										<div class="prop__email">
											<iframe
												class="prop__frame"
												title="Email preview"
												sandbox="allow-same-origin"
												srcdoc={proposal.html}
												onload={fitEmailFrame}
											></iframe>
										</div>
									{:else}
										<div class="prop__diff">
											<div class="prop__side">
												<span class="prop__label">Now</span>
												{#if imageUrl(proposal.before)}
													<img class="prop__img" src={imageUrl(proposal.before)} alt="" />
												{:else}
													<pre class="prop__code">{preview(proposal.before)}</pre>
												{/if}
											</div>
											<div class="prop__side">
												<span class="prop__label">After</span>
												{#if imageUrl(proposal.after)}
													<img class="prop__img" src={imageUrl(proposal.after)} alt="" />
												{:else}
													<pre class="prop__code prop__code--new">{preview(proposal.after)}</pre>
												{/if}
											</div>
										</div>
									{/if}

									{#if proposal.status === 'pending' || proposal.status === 'applying'}
										<div class="prop__actions">
											<button
												type="button"
												class="prop__reject"
												disabled={proposal.status === 'applying'}
												onclick={() => rejectProposal(proposal)}
											>
												Reject
											</button>
											<button
												type="button"
												class="prop__approve"
												disabled={proposal.status === 'applying'}
												onclick={() => approveProposal(proposal)}
											>
												{proposal.status === 'applying' ? 'Applying…' : 'Approve & apply'}
											</button>
										</div>
									{:else if proposal.status === 'approved'}
										<p class="prop__state prop__state--ok">
											<Check size={12} strokeWidth={2.4} aria-hidden="true" />
											{proposal.note || 'Applied to the site'}
										</p>
									{:else if proposal.status === 'rejected'}
										<p class="prop__state">Rejected — nothing was changed</p>
									{:else if proposal.status === 'error'}
										<p class="prop__state prop__state--err">{proposal.error}</p>
									{/if}
								</div>
							{/each}

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
				{#each pending as item, index (index)}
					<li
						class="queue__item"
						class:queue__item--busy={item.uploading}
						class:queue__item--file={item.kind === 'file'}
					>
						{#if item.kind === 'image'}
							<img src={item.dataUrl} alt={item.name} />
						{:else}
							<span class="queue__doc">
								<FileText size={16} strokeWidth={1.8} aria-hidden="true" />
								<span class="queue__docname">{item.name}</span>
								{#if item.size}<span class="queue__docsize">{item.size}</span>{/if}
							</span>
						{/if}
						{#if item.uploading}
							<span class="queue__spin" aria-label="Uploading"></span>
						{/if}
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
			<input
				type="file"
				accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv"
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
				title="Attach an image or file"
				aria-label="Attach an image or file"
				onclick={() => picker?.click()}
			>
				<Paperclip size={16} strokeWidth={1.9} />
			</button>

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
					{#if hasServerKey}
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
					Attach an image on any model to upload it and have the assistant place it in content. Only
					Gemma 4 can also look at an image to answer questions about it.
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

<dialog
	bind:this={historyEl}
	class="sheet"
	onclose={() => (historyOpen = false)}
	onclick={(event) => {
		if (event.target === historyEl) historyOpen = false;
	}}
>
	{#if historyOpen}
		<div class="sheet__panel">
			<header class="sheet__head">
				<div>
					<h2 class="sheet__title">Chat history</h2>
					<p class="sheet__sub">Your saved conversations. Open one to pick it back up.</p>
				</div>
				<button
					type="button"
					class="sheet__close"
					onclick={() => (historyOpen = false)}
					aria-label="Close"
				>
					<X size={16} strokeWidth={2} />
				</button>
			</header>

			{#if historyLoading}
				<p class="history__empty">Loading…</p>
			{:else if conversations.length === 0}
				<p class="history__empty">No saved chats yet.</p>
			{:else}
				<ul class="history">
					{#each conversations as chat (chat.id)}
						<li class="history__item" class:history__item--on={chat.id === conversationId}>
							<button type="button" class="history__open" onclick={() => openConversation(chat.id)}>
								<span class="history__title">{chat.title}</span>
								<span class="history__when">{new Date(chat.updated_at).toLocaleString()}</span>
							</button>
							<button
								type="button"
								class="history__delete"
								onclick={() => deleteConversation(chat.id)}
								aria-label="Delete chat"
							>
								<Trash2 size={14} strokeWidth={1.9} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</dialog>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	// ---- header ---------------------------------------------------------------

	// The panel draws its own header rather than borrowing the page's: the page
	// behind it keeps its title, and the close button belongs beside New chat,
	// not in a second bar above it.
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 12px 12px 16px;
		border-bottom: 1px solid $admin-line-soft;
	}

	.head__mark {
		@include admin-icon-tile('violet', 30px);
	}

	.head__text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		margin-right: auto;
	}

	.head__title {
		margin: 0;
		font-size: 14px;
		font-weight: $font-weight-bold;
		letter-spacing: -0.01em;
		color: $admin-ink;
	}

	.head__model {
		font-size: 11px;
		color: admin-tone-fg('violet');
		white-space: nowrap;

		&--off {
			color: $admin-ink-3;
		}
	}

	.head__actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.gear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 30px;
		height: 30px;
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

	// Fills whatever the layout gives it: a docked column, a floating panel, or
	// the whole screen on a phone. The thread is the only part that scrolls.
	.chat {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: $admin-surface;
		color: $admin-ink;
		font-family: $font-family-base;
	}

	.chat__thread {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 20px 18px;
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
		@include admin-icon-tile('violet', 46px);
		margin-bottom: 4px;
	}

	.opener__title {
		margin: 0;
		font-family: $font-family-serif;
		font-size: 22px;
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

	// A column, not a wrapped row: in a panel this narrow a wrapped row lands
	// one chip per line anyway, just unevenly.
	.chips {
		list-style: none;
		margin: 14px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
		width: 100%;
	}

	.chip {
		font: inherit;
		font-size: 12.5px;
		color: $admin-ink-2;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
		padding: 9px 12px;
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

	.doc {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 220px;
		padding: 8px 11px;
		font-size: 12.5px;
		color: $admin-ink;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
	}

	.doc__name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		padding: 12px 14px 14px;
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

	.queue__item--busy img,
	.queue__item--busy .queue__doc {
		opacity: 0.5;
	}

	.queue__doc {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 56px;
		max-width: 200px;
		padding: 0 12px;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
	}

	.queue__docname {
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.queue__docsize {
		font-size: 10.5px;
		color: $admin-ink-3;
		flex: none;
	}

	.queue__spin {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 18px;
		height: 18px;
		margin: -9px 0 0 -9px;
		border: 2px solid rgba($color-white, 0.6);
		border-top-color: $color-white;
		border-radius: 50%;
		animation: queue-spin 0.7s linear infinite;
	}

	@keyframes queue-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.queue__spin {
			animation: none;
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

	// ---- approval mode toggle -------------------------------------------------

	.mode {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 30px;
		padding: 0 10px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.03em;
		color: $admin-ink-2;
		background: $admin-surface;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			color: $admin-ink;
		}

		&:active {
			transform: translateY(0.5px);
		}
	}

	.mode--auto {
		color: admin-tone-fg('warn');
		background: admin-tone-bg('warn');
		border-color: transparent;
	}

	// ---- proposed content edits ----------------------------------------------

	.prop {
		margin-top: 12px;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
		background: $admin-surface;
		overflow: hidden;
	}

	.prop--done {
		opacity: 0.92;
	}

	.prop__head {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 10px 12px;
		font-size: 12.5px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		background: $admin-sunken;
		border-bottom: 1px solid $admin-line;
	}

	.prop__diff {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: $admin-line;
	}

	.prop__side {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 12px;
		background: $admin-surface;
		min-width: 0;
	}

	.prop__label {
		font-size: 10px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.prop__code {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 11.5px;
		line-height: 1.5;
		color: $admin-ink-2;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		max-height: 220px;
		overflow-y: auto;
	}

	.prop__code--new {
		color: $admin-ink;
	}

	.prop__img {
		display: block;
		max-width: 100%;
		max-height: 160px;
		width: auto;
		border-radius: $admin-radius-sm;
		border: 1px solid $admin-line;
	}

	.prop__email {
		padding: 12px;
		background: $admin-sunken;
	}

	.prop__frame {
		display: block;
		width: 100%;
		height: 240px;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		background: #fff;
		// Sized to the email's own height on load (see fitEmailFrame), so it never
		// shows a scrollbar; this is only the height before that runs.
		overflow: hidden;
	}

	.prop__actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 10px 12px;
		border-top: 1px solid $admin-line;
	}

	.prop__reject {
		@include admin-btn-base;
	}

	.prop__approve {
		@include admin-btn-primary;
	}

	.prop__state {
		display: flex;
		align-items: center;
		gap: 5px;
		margin: 0;
		padding: 10px 12px;
		font-size: 12px;
		color: $admin-ink-3;
		border-top: 1px solid $admin-line;
	}

	.prop__state--ok {
		color: admin-tone-fg('good');
	}

	.prop__state--err {
		color: admin-tone-fg('bad');
	}

	// ---- chat history ---------------------------------------------------------

	.history {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 52vh;
		overflow-y: auto;
	}

	.history__item {
		display: flex;
		align-items: stretch;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-md;
		background: $admin-surface;
		overflow: hidden;
	}

	.history__item--on {
		border-color: $admin-accent;
	}

	.history__open {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		@include admin-focus-ring;
	}

	.history__title {
		font-size: 13px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history__when {
		font-size: 11px;
		color: $admin-ink-3;
	}

	.history__delete {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		color: $admin-ink-3;
		background: none;
		border: none;
		border-left: 1px solid $admin-line;
		cursor: pointer;
		@include admin-focus-ring;

		&:hover {
			color: admin-tone-fg('bad');
		}
	}

	.history__empty {
		margin: 0;
		padding: 24px 0;
		text-align: center;
		font-size: 13px;
		color: $admin-ink-3;
	}

	// Two columns of before/after do not fit a panel; they stack.
	.prop__diff {
		grid-template-columns: 1fr;
	}

	@media (max-width: $bp-sm) {
		.composer__hint {
			display: none;
		}

		.sheet__foot {
			flex-wrap: wrap;
		}
	}
</style>
