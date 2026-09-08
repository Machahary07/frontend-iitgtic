<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const firstName = $derived(adminName.trim().split(/\s+/)[0]);

	type Message = { id: number; role: 'you' | 'notice'; text: string };

	let messages = $state<Message[]>([]);
	let draft = $state('');
	let thread = $state<HTMLDivElement | null>(null);
	let box = $state<HTMLTextAreaElement | null>(null);
	let nextId = 0;

	const empty = $derived(messages.length === 0);

	// Written against the console as it stands, so the suggestions read as things
	// this admin could actually ask for rather than filler.
	const SUGGESTIONS = [
		'Summarise what changed in the console this week',
		'Draft a short bio for a governing body member',
		'Which applications are waiting on a decision?',
		'Rewrite the application-rejected email to be warmer'
	];

	function grow() {
		if (!box) return;
		box.style.height = 'auto';
		box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
	}

	async function send(text: string) {
		const body = text.trim();
		if (!body) return;

		messages = [
			...messages,
			{ id: nextId++, role: 'you', text: body },
			{
				id: nextId++,
				role: 'notice',
				text: 'No model is connected yet, so nothing was sent anywhere. This screen is the interface only.'
			}
		];
		draft = '';

		await tick();
		grow();
		thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
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
		<span class="preview">Preview · not connected</span>
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
						where they stand. Nothing is changed without you approving it first.
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
								<p class="msg__text">{message.text}</p>
							{:else}
								<span class="msg__who msg__who--notice">
									<Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
									Assistant
								</span>
								<p class="msg__text msg__text--notice">{message.text}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="composer">
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
				<button type="button" class="composer__icon" title="Attach a file" aria-label="Attach a file">
					<Paperclip size={16} strokeWidth={1.9} />
				</button>
				<span class="composer__hint">Enter to send · Shift + Enter for a new line</span>
				<button
					type="button"
					class="composer__send"
					disabled={!draft.trim()}
					aria-label="Send"
					onclick={() => send(draft)}
				>
					<ArrowUp size={17} strokeWidth={2.2} />
				</button>
			</div>
		</div>
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.preview {
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.04em;
		color: admin-tone-fg('violet');
		background: admin-tone-bg('violet');
		border-radius: $admin-radius-pill;
		padding: 6px 12px;
	}

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

	.msg__who--notice {
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

	// The stand-in reply is not an answer, so it does not dress as one.
	.msg__text--notice {
		background: transparent;
		border-style: dashed;
		color: $admin-ink-2;
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
	}
</style>
