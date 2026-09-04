<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/components/AdminShell.svelte';
	import { TIC_ADMIN_NAV } from '$lib/utils/ticAdminNav';
	import { logoutTicAdmin } from '$lib/utils/ticAdminAuth';
	import {
		adminResetEmailTemplate,
		adminSaveEmailTemplate,
		adminSendTestEmail,
		adminUploadEmailAsset
	} from '$lib/utils/ticAdmin';
	import {
		EMAIL_LAYOUT_KEY,
		htmlToText,
		renderTemplate,
		sampleVariables
	} from '$lib/utils/emailTemplates';
	import {
		BLOCK_GROUPS,
		BLOCK_LABELS,
		IMAGE_WIDTH_LABELS,
		SPACER_LABELS,
		TONE_LABELS,
		blankBlock,
		blockProblems,
		renderBlocks,
		type BlockTone,
		type BlockType,
		type EmailBlock,
		type ImageWidth,
		type SpacerSize
	} from '$lib/utils/emailBlocks';
	import type { PageData } from './$types';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleSlash from '@lucide/svelte/icons/circle-slash';
	import FilePenLine from '@lucide/svelte/icons/file-pen-line';
	import { askConfirm } from '$lib/utils/dialog.svelte';
	import { showToast } from '$lib/utils/toast.svelte';

	let { data }: { data: PageData } = $props();

	const adminName = $derived(data.admin?.name || data.admin?.email || 'TIC Team');
	const template = $derived(data.template);
	const isLayout = $derived(template.key === EMAIL_LAYOUT_KEY);

	// Two ways to hold the same message. `blocks` is what an admin composes;
	// `htmlBody` is the escape hatch for anyone who wants the markup. Only one is
	// saved — sending blocks makes the server compile the body from them, sending
	// a body stores it as written and drops the composed version.
	let mode = $state<'compose' | 'html'>('compose');
	let blocks = $state<EmailBlock[]>([]);
	let htmlBody = $state('');
	let subject = $state('');
	let enabled = $state(true);

	let saving = $state(false);
	let resetting = $state(false);
	let testing = $state(false);
	let testTo = $state('');
	let tab = $state<'preview' | 'text'>('preview');

	// Reseeds the form whenever a save or a reset reloads the page's data.
	$effect(() => {
		subject = template.subject;
		htmlBody = template.body;
		enabled = template.enabled;
		blocks = structuredClone(template.blocks ?? []) as EmailBlock[];
		mode = template.blocks ? 'compose' : 'html';
	});

	// A template saved from the HTML tab has no blocks to go back to, so composing
	// is offered again only after a reset.
	const composable = $derived(template.blocks !== null);

	const currentBody = $derived(mode === 'compose' ? renderBlocks(blocks) : htmlBody);

	const dirty = $derived(
		subject !== template.subject ||
			enabled !== template.enabled ||
			(mode === 'compose'
				? JSON.stringify(blocks) !== JSON.stringify(template.blocks ?? [])
				: htmlBody !== template.body) ||
			mode !== (template.blocks ? 'compose' : 'html')
	);

	// Clearing a template out and rebuilding it is a normal thing to do, so an
	// empty list is only a problem at the point of saving — said here rather than
	// left to come back as a server error.
	const problems = $derived.by(() => {
		if (mode !== 'compose') return [];
		if (blocks.length === 0) return ['Add at least one block before saving.'];
		return blockProblems(blocks);
	});

	// Sample values, so the preview reads like a real message rather than a page
	// of braces. The same set is what a test send uses.
	const samples = $derived({
		...sampleVariables(template),
		siteName: data.config.siteName,
		siteUrl: data.config.siteUrl
	});

	// Everything a block may be gated on, or dropped into a field.
	const variableNames = $derived([
		...template.variables.map((v) => v.name),
		...data.commonVariables.map((v) => v.name)
	]);

	const renderedSubject = $derived(renderTemplate(subject, samples));

	// Rendered exactly as the server would: the body first, then dropped into the
	// layout's content slot. Editing the layout previews itself with a stand-in
	// message so the chrome is visible on its own.
	const renderedHtml = $derived.by(() => {
		if (isLayout) {
			return renderTemplate(htmlBody, {
				...samples,
				content:
					'<h1 style="margin:0 0 16px;font:600 20px/1.3 sans-serif;color:#111;">A message goes here</h1><p style="margin:0 0 14px;">Each template is rendered into the layout at this point, so anything above and below is what every message shares.</p>',
				subject: renderedSubject,
				preheader: 'Inbox preview line'
			});
		}
		const content = renderTemplate(currentBody, samples);
		return renderTemplate(data.layoutBody, {
			...samples,
			content,
			subject: renderedSubject,
			preheader: htmlToText(content).split('\n')[0]?.slice(0, 140) ?? ''
		});
	});

	const renderedText = $derived(htmlToText(renderedHtml));

	// --- block editing -------------------------------------------------------

	const TONES: BlockTone[] = ['info', 'good', 'bad'];
	const SPACERS: SpacerSize[] = ['small', 'medium', 'large'];
	const WIDTHS: ImageWidth[] = ['small', 'half', 'full'];

	const PALETTE = BLOCK_GROUPS.map((group) => ({
		group,
		types: (Object.keys(BLOCK_LABELS) as BlockType[]).filter(
			(type) => BLOCK_LABELS[type].group === group
		)
	}));

	// Which "+" is open, as the index the new block would land at. null is closed.
	let paletteAt = $state<number | null>(null);

	// A popover that only closes by picking something is a trap on a long page,
	// so anywhere else and Escape both dismiss it.
	function dismissPalette(event: MouseEvent) {
		if (paletteAt === null) return;
		if (!(event.target instanceof Element) || !event.target.closest('.insert')) paletteAt = null;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && paletteAt !== null) paletteAt = null;
	}

	function addBlock(type: BlockType, at: number) {
		const next = [...blocks];
		next.splice(at, 0, blankBlock(type));
		blocks = next;
		paletteAt = null;
	}

	function removeBlock(index: number) {
		blocks = blocks.filter((_, i) => i !== index);
	}

	function duplicateBlock(index: number) {
		const next = [...blocks];
		next.splice(index + 1, 0, structuredClone($state.snapshot(blocks[index])) as EmailBlock);
		blocks = next;
	}

	// --- list items ----------------------------------------------------------

	function setItem(block: Extract<EmailBlock, { items: string[] }>, i: number, value: string) {
		block.items[i] = value;
	}

	function addItem(block: Extract<EmailBlock, { items: string[] }>) {
		block.items = [...block.items, ''];
	}

	function removeItem(block: Extract<EmailBlock, { items: string[] }>, i: number) {
		block.items = block.items.length > 1 ? block.items.filter((_, n) => n !== i) : [''];
	}

	function setSrc(index: number, value: string) {
		const next = [...blocks];
		const block = { ...next[index] } as EmailBlock;
		if (block.type === 'image' || block.type === 'file') block.src = value;
		next[index] = block;
		blocks = next;
	}

	// --- uploads -------------------------------------------------------------

	let uploading = $state<number | null>(null);

	async function upload(index: number, input: HTMLInputElement) {
		const file = input.files?.[0];
		if (!file) return;

		uploading = index;
		const result = await adminUploadEmailAsset(file);
		uploading = null;
		input.value = '';

		if (!result.ok) {
			showToast(result.error, 'err');
			return;
		}

		const next = [...blocks];
		const block = { ...next[index] } as EmailBlock;
		if (block.type === 'image') {
			block.src = result.asset.url;
			if (!block.alt.trim()) block.alt = result.asset.name.replace(/\.[^.]*$/, '');
		} else if (block.type === 'file') {
			block.src = result.asset.url;
			if (!block.name.trim()) block.name = result.asset.name;
			block.size = result.asset.size;
		}
		next[index] = block;
		blocks = next;
	}

	function moveBlock(index: number, by: -1 | 1) {
		const to = index + by;
		if (to < 0 || to >= blocks.length) return;
		const next = [...blocks];
		[next[index], next[to]] = [next[to], next[index]];
		blocks = next;
	}

	// One control for both gates: "always", "… is filled in" (showIf) and
	// "… is empty" (hideIf). Encoded as a single select value so the admin sees
	// one question rather than two checkboxes that can contradict each other.
	function gateValue(block: EmailBlock): string {
		if (block.showIf) return `show:${block.showIf}`;
		if (block.hideIf) return `hide:${block.hideIf}`;
		return '';
	}

	function setGate(index: number, value: string) {
		const [kind, name] = value.split(':');
		const next = [...blocks];
		const block = { ...next[index] };
		delete block.showIf;
		delete block.hideIf;
		if (kind === 'show' && name) block.showIf = name;
		if (kind === 'hide' && name) block.hideIf = name;
		next[index] = block;
		blocks = next;
	}

	// --- variable insertion --------------------------------------------------

	// Clicking a variable drops it into whichever field was last focused, rather
	// than making the editor retype a name they can only see in a list.
	let lastField = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);

	function trackFocus(event: FocusEvent) {
		const el = event.target;
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
			if (el.dataset.insertable === 'true') lastField = el;
		}
	}

	function insert(name: string) {
		const token = name === 'content' && isLayout ? `{{{${name}}}}` : `{{${name}}}`;
		const el = lastField;
		if (!el) return;

		const start = el.selectionStart ?? el.value.length;
		const end = el.selectionEnd ?? start;

		// Written through the native setter and announced with an input event so
		// Svelte's binding picks it up — assigning `.value` alone would be
		// overwritten on the next render.
		const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
		setter?.call(el, el.value.slice(0, start) + token + el.value.slice(end));
		el.dispatchEvent(new Event('input', { bubbles: true }));

		el.focus();
		const at = start + token.length;
		queueMicrotask(() => el.setSelectionRange(at, at));
	}

	// --- actions -------------------------------------------------------------

	async function save() {
		if (problems.length > 0) {
			showToast(problems[0], 'err');
			return;
		}
		if (mode === 'html' && composable) {
			const ok = await askConfirm({
				title: 'Save as HTML?',
				body: 'This replaces the composed version of the message. Reset brings it back.',
				confirmLabel: 'Save as HTML'
			});
			if (!ok) return;
		}

		saving = true;
		const result = await adminSaveEmailTemplate(
			mode === 'compose'
				? { key: template.key, subject, enabled, blocks }
				: { key: template.key, subject, enabled, body: htmlBody }
		);
		saving = false;

		if (!result.ok) {
			showToast(result.error, 'err');
			return;
		}
		showToast('Saved. New sends use this copy straight away.');
		await invalidateAll();
	}

	async function reset() {
		const ok = await askConfirm({
			title: 'Restore the bundled copy?',
			body: 'Your edits to this template are discarded.',
			confirmLabel: 'Restore',
			tone: 'danger'
		});
		if (!ok) return;

		resetting = true;
		const result = await adminResetEmailTemplate(template.key);
		resetting = false;

		if (!result.ok) {
			showToast(result.error, 'err');
			return;
		}
		showToast('Restored the bundled copy.');
		await invalidateAll();
	}

	async function sendTest() {
		if (dirty) {
			const ok = await askConfirm({
				title: 'Send the saved copy?',
				body: 'A test sends what is saved, not your unsaved edits.',
				confirmLabel: 'Send test'
			});
			if (!ok) return;
		}

		testing = true;
		const result = await adminSendTestEmail(template.key, testTo.trim() || undefined);
		testing = false;

		if (result.ok) showToast(`Test sent to ${result.to}.`);
		else showToast(result.error, 'err');
	}

	async function handleLogout() {
		await logoutTicAdmin();
		goto(resolve('/tic-admin/login'));
	}
</script>

{#snippet inserter(at: number)}
	<div class="insert" class:insert--open={paletteAt === at}>
		<button
			class="insert__btn"
			aria-expanded={paletteAt === at}
			aria-label="Add a component here"
			onclick={() => (paletteAt = paletteAt === at ? null : at)}
		>
			+
		</button>
		{#if paletteAt === at}
			<div class="palette">
				{#each PALETTE as section (section.group)}
					<div class="palette__group">
						<p class="palette__title">{section.group}</p>
						<div class="palette__items">
							{#each section.types as type (type)}
								<button class="palette__item" onclick={() => addBlock(type, at)}>
									<span class="palette__icon">{BLOCK_LABELS[type].icon}</span>
									<span class="palette__body">
										<strong>{BLOCK_LABELS[type].name}</strong>
										<em>{BLOCK_LABELS[type].hint}</em>
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet picker(index: number, accept: string, src: string, label: string)}
	<div class="picker">
		<label class="picker__pick">
			{uploading === index ? 'Uploading…' : label}
			<input
				type="file"
				{accept}
				disabled={uploading !== null}
				onchange={(e) => upload(index, e.currentTarget)}
			/>
		</label>
		<input
			class="input picker__url"
			type="text"
			value={src}
			placeholder="…or paste a web address"
			oninput={(e) => setSrc(index, e.currentTarget.value)}
		/>
	</div>
	{#if src}
		<p class="picker__at">{src}</p>
	{/if}
{/snippet}

<svelte:head>
	<title>TIC Admin · {template.name}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} onpointerdown={dismissPalette} />

<AdminShell
	brand="TIC Team Admin"
	navItems={TIC_ADMIN_NAV}
	title={template.name}
	eyebrow="Email template"
	user={adminName}
	onLogout={handleLogout}
>
	{#snippet actions()}
		<a class="head-btn" href={resolve('/tic-admin/email/templates')}>All templates</a>
	{/snippet}

	<p class="lede">{template.description}</p>

	<div class="meta">
		<span class="meta__chip meta__chip--{enabled ? 'on' : 'off'}">
			{#if enabled}
				<CircleCheck size={13} strokeWidth={2.1} />
			{:else}
				<CircleSlash size={13} strokeWidth={2.1} />
			{/if}
			{enabled ? 'Sending' : 'Switched off'}
		</span>
		{#if template.customised}
			<span class="meta__chip meta__chip--edited">
				<FilePenLine size={13} strokeWidth={2.1} />
				Edited
			</span>
		{/if}
		<span class="meta__trigger"><span>Sent when</span> {template.trigger}</span>
	</div>

	<!-- Save used to sit in the middle card's footer, which on a long template
	     meant scrolling away from your edit to find it. It rides the bottom of
	     the viewport instead, and says what state the draft is in. -->
	<div class="savebar" class:savebar--dirty={dirty}>
		<span class="savebar__state">
			{#if problems.length > 0}
				<span class="savebar__dot savebar__dot--bad"></span>
				{problems.length} thing{problems.length === 1 ? '' : 's'} to fix
			{:else if dirty}
				<span class="savebar__dot savebar__dot--warn"></span>
				Unsaved changes
			{:else}
				<span class="savebar__dot savebar__dot--good"></span>
				All changes saved
			{/if}
		</span>

		{#if template.customised}
			<button class="btn" onclick={reset} disabled={resetting}>
				{resetting ? 'Restoring…' : 'Reset to bundled copy'}
			</button>
		{/if}
		<button
			class="btn btn--primary"
			onclick={save}
			disabled={saving || !dirty || problems.length > 0}
		>
			{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
		</button>
	</div>

	<div class="grid">
		<!-- focusin rather than a listener per field: which field was last focused is
		     what the variable buttons insert into, and there are dozens of them. -->
		<div class="col" onfocusin={trackFocus}>
			<section class="card">
				<div class="card__head">
					<h2 class="card__title">Message</h2>
					{#if !isLayout}
						<div class="switch">
							<button
								class="switch__btn"
								class:switch__btn--on={mode === 'compose'}
								disabled={!composable}
								title={composable
									? 'Write the message as ordinary text'
									: 'This template was saved as HTML — reset it to compose again'}
								onclick={() => (mode = 'compose')}
							>
								Write
							</button>
							<button
								class="switch__btn"
								class:switch__btn--on={mode === 'html'}
								onclick={() => {
									if (mode === 'compose') htmlBody = renderBlocks(blocks);
									mode = 'html';
								}}
							>
								HTML
							</button>
						</div>
					{/if}
				</div>

				{#if !isLayout}
					<label class="field">
						<span class="field__label">Subject line</span>
						<input
							class="input"
							type="text"
							bind:value={subject}
							spellcheck="true"
							data-insertable="true"
						/>
					</label>
				{/if}

				{#if isLayout}
					<p class="card__note">
						The layout is the frame every message is placed inside — the header, the footer and the
						table scaffolding email clients need. It is markup rather than copy, so there is no
						plain-text version of it. Keep <code
							>&lbrace;&lbrace;&lbrace;content&rbrace;&rbrace;&rbrace;</code
						>
						where it is; that is where each message lands.
					</p>
				{/if}

				{#if mode === 'compose' && !isLayout}
					<div class="blocks">
						{@render inserter(0)}

						{#each blocks as block, i (block)}
							<article class="block">
								<header class="block__head">
									<span class="block__type">
										<span class="block__icon">{BLOCK_LABELS[block.type].icon}</span>
										{BLOCK_LABELS[block.type].name}
									</span>
									<div class="block__tools">
										<button
											class="icon"
											title="Move up"
											aria-label="Move up"
											disabled={i === 0}
											onclick={() => moveBlock(i, -1)}>↑</button
										>
										<button
											class="icon"
											title="Move down"
											aria-label="Move down"
											disabled={i === blocks.length - 1}
											onclick={() => moveBlock(i, 1)}>↓</button
										>
										<button
											class="icon"
											title="Duplicate"
											aria-label="Duplicate block"
											onclick={() => duplicateBlock(i)}>⧉</button
										>
										<button
											class="icon icon--danger"
											title="Remove"
											aria-label="Remove block"
											onclick={() => removeBlock(i)}>✕</button
										>
									</div>
								</header>

								{#if block.type === 'heading' || block.type === 'subheading'}
									<input
										class="input"
										type="text"
										bind:value={block.text}
										placeholder={block.type === 'heading'
											? 'You are verified'
											: 'What happens next'}
										data-insertable="true"
									/>
								{:else if block.type === 'text' || block.type === 'note'}
									<textarea
										class="input textarea textarea--copy"
										bind:value={block.text}
										rows={block.type === 'note' ? 2 : 3}
										placeholder="Write the sentence as you would say it."
										data-insertable="true"
									></textarea>
								{:else if block.type === 'bullets' || block.type === 'numbers'}
									<ul class="items">
										{#each block.items as item, n (n)}
											<li class="item">
												<span class="item__marker">
													{block.type === 'numbers' ? `${n + 1}.` : '•'}
												</span>
												<input
													class="input"
													type="text"
													value={item}
													oninput={(e) => setItem(block, n, e.currentTarget.value)}
													placeholder="One point"
													data-insertable="true"
												/>
												<button
													class="icon icon--danger"
													title="Remove item"
													aria-label="Remove item"
													onclick={() => removeItem(block, n)}>✕</button
												>
											</li>
										{/each}
									</ul>
									<button class="add__btn add__btn--inline" onclick={() => addItem(block)}>
										+ Add item
									</button>
								{:else if block.type === 'quote'}
									<textarea
										class="input textarea textarea--copy"
										bind:value={block.text}
										rows="2"
										placeholder="The words being quoted"
										data-insertable="true"
									></textarea>
									<label class="field">
										<span class="field__label">Who said it <em>optional</em></span>
										<input
											class="input"
											type="text"
											bind:value={block.attribution}
											placeholder="Prof. A. Sharma, Director"
											data-insertable="true"
										/>
									</label>
								{:else if block.type === 'callout'}
									<div class="row">
										<label class="field field--grow">
											<span class="field__label">Label <em>optional</em></span>
											<input
												class="input"
												type="text"
												bind:value={block.label}
												placeholder="Reason"
												data-insertable="true"
											/>
										</label>
										<label class="field">
											<span class="field__label">Tone</span>
											<select class="input" bind:value={block.tone}>
												{#each TONES as tone (tone)}
													<option value={tone}>{TONE_LABELS[tone]}</option>
												{/each}
											</select>
										</label>
									</div>
									<textarea
										class="input textarea textarea--copy"
										bind:value={block.text}
										rows="2"
										placeholder="The line to draw attention to"
										data-insertable="true"
									></textarea>
								{:else if block.type === 'button' || block.type === 'link'}
									<div class="row">
										<label class="field field--grow">
											<span class="field__label">
												{block.type === 'button' ? 'Button text' : 'Link text'}
											</span>
											<input
												class="input"
												type="text"
												bind:value={block.label}
												placeholder="Open your dashboard"
												data-insertable="true"
											/>
										</label>
										<label class="field field--grow">
											<span class="field__label">Links to</span>
											<input
												class="input"
												type="text"
												bind:value={block.href}
												placeholder="{'{{siteUrl}}'}/opportunities"
												data-insertable="true"
											/>
										</label>
									</div>
								{:else if block.type === 'image'}
									{@render picker(i, 'image/*', block.src, 'Choose a picture')}
									<div class="row">
										<label class="field field--grow">
											<span class="field__label">Describe it <em>for screen readers</em></span>
											<input
												class="input"
												type="text"
												bind:value={block.alt}
												placeholder="The TIC building at dusk"
											/>
										</label>
										<label class="field">
											<span class="field__label">Size</span>
											<select class="input" bind:value={block.width}>
												{#each WIDTHS as width (width)}
													<option value={width}>{IMAGE_WIDTH_LABELS[width]}</option>
												{/each}
											</select>
										</label>
									</div>
									<label class="field">
										<span class="field__label">Clicking it opens <em>optional</em></span>
										<input
											class="input"
											type="text"
											bind:value={block.href}
											placeholder={'{{siteUrl}}'}
											data-insertable="true"
										/>
									</label>
								{:else if block.type === 'file'}
									{@render picker(i, '.pdf,.doc,.docx,.txt,.csv', block.src, 'Choose a file')}
									<div class="row">
										<label class="field field--grow">
											<span class="field__label">Shown as</span>
											<input
												class="input"
												type="text"
												bind:value={block.name}
												placeholder="Incubation handbook.pdf"
											/>
										</label>
										<label class="field">
											<span class="field__label">Size <em>optional</em></span>
											<input
												class="input"
												type="text"
												bind:value={block.size}
												placeholder="1.2 MB"
											/>
										</label>
									</div>
									<label class="check check--tight">
										<input type="checkbox" bind:checked={block.attach} />
										<span>
											<strong>Attach it to the email as well</strong>
											<em>
												Otherwise it is only a download link. Attachments make the message bigger
												and some mail servers strip them, so the link is the more reliable half.
											</em>
										</span>
									</label>
								{:else if block.type === 'signature'}
									<div class="row">
										<label class="field field--grow">
											<span class="field__label">Name</span>
											<input
												class="input"
												type="text"
												bind:value={block.name}
												placeholder="The TIC team"
												data-insertable="true"
											/>
										</label>
										<label class="field field--grow">
											<span class="field__label">Role <em>optional</em></span>
											<input
												class="input"
												type="text"
												bind:value={block.role}
												placeholder="IIT Guwahati Technology Incubation Centre"
												data-insertable="true"
											/>
										</label>
									</div>
								{:else if block.type === 'spacer'}
									<label class="field">
										<span class="field__label">How much room</span>
										<select class="input input--small" bind:value={block.size}>
											{#each SPACERS as size (size)}
												<option value={size}>{SPACER_LABELS[size]}</option>
											{/each}
										</select>
									</label>
								{/if}

								<label class="gate">
									<span class="gate__label">Only show</span>
									<select
										class="input input--small"
										value={gateValue(block)}
										onchange={(e) => setGate(i, e.currentTarget.value)}
									>
										<option value="">always</option>
										{#each variableNames as name (name)}
											<option value="show:{name}">when {name} is filled in</option>
										{/each}
										{#each variableNames as name (name)}
											<option value="hide:{name}">when {name} is empty</option>
										{/each}
									</select>
								</label>
							</article>

							{@render inserter(i + 1)}
						{/each}

						{#if blocks.length === 0}
							<p class="blocks__empty">
								Nothing in this message yet — build it from the components above.
							</p>
						{/if}
					</div>

					<p class="card__note">
						<strong>*Bold*</strong> makes a word bold, and
						<code>[text](https://…)</code> makes a link. Everything else is written exactly as it will
						be read.
					</p>
				{:else}
					<div class="field">
						<div class="field__row">
							<span class="field__label">{isLayout ? 'Layout HTML' : 'Body (HTML)'}</span>
							<span class="field__hint">
								{htmlBody.length.toLocaleString('en-GB')} characters
							</span>
						</div>
						<textarea
							class="input textarea"
							bind:value={htmlBody}
							spellcheck="false"
							rows="18"
							data-insertable="true"
						></textarea>
					</div>
					{#if !isLayout && composable}
						<p class="card__warn">
							Saving here replaces the written version of this message with your markup. Reset puts
							the written version back.
						</p>
					{/if}
				{/if}

				{#if !isLayout}
					<label class="check">
						<input type="checkbox" bind:checked={enabled} />
						<span>
							<strong>Send this message</strong>
							<em>Switched off, the app skips the send and records it in the log as blocked.</em>
						</span>
					</label>
				{/if}

				{#if problems.length > 0}
					<ul class="problems">
						{#each problems as problem (problem)}
							<li>{problem}</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="card">
				<h2 class="card__title">Variables</h2>
				<p class="card__note">
					These are filled in for each recipient when the email goes out. Click a field above, then
					click one of these to drop it in.
				</p>
				<ul class="vars">
					{#each [...template.variables, ...data.commonVariables] as variable (variable.name)}
						<li>
							<button class="var" disabled={!lastField} onclick={() => insert(variable.name)}>
								&lbrace;&lbrace;{variable.name}&rbrace;&rbrace;
							</button>
							<span class="var__desc">{variable.description}</span>
						</li>
					{/each}
				</ul>
				{#if !lastField}
					<p class="card__warn">Click into a field above first, so there is somewhere to put it.</p>
				{/if}
			</section>

			{#if !isLayout}
				<section class="card">
					<h2 class="card__title">Send a test</h2>
					<p class="card__note">
						Delivers the saved copy with the sample values above. It is tagged as a test, so it is
						hidden from the log by default and still counts against the plan allowance.
					</p>
					<div class="test">
						<input
							class="input"
							type="email"
							bind:value={testTo}
							placeholder={data.admin?.email ?? 'you@example.com'}
						/>
						<button class="btn" onclick={sendTest} disabled={testing || !data.config.configured}>
							{testing ? 'Sending…' : 'Send test'}
						</button>
					</div>
					{#if !data.config.configured}
						<p class="card__warn">
							<code>RESEND_API_KEY</code> is not set, so nothing can be delivered yet.
						</p>
					{:else if data.config.usingTestSender}
						<p class="card__warn">
							Sending from <code>{data.config.from}</code>, which Resend only delivers to the
							address that owns the API key.
						</p>
					{/if}
				</section>
			{/if}
		</div>

		<div class="col col--preview">
			<section class="card card--preview">
				<div class="preview__head">
					<h2 class="card__title">Preview</h2>
					<div class="switch">
						<button
							class="switch__btn"
							class:switch__btn--on={tab === 'preview'}
							onclick={() => (tab = 'preview')}
						>
							HTML
						</button>
						<button
							class="switch__btn"
							class:switch__btn--on={tab === 'text'}
							onclick={() => (tab = 'text')}
						>
							Plain text
						</button>
					</div>
				</div>

				<div class="envelope">
					<p class="envelope__row"><span>From</span>{data.config.from}</p>
					{#if !isLayout}
						<p class="envelope__row"><span>Subject</span>{renderedSubject || '—'}</p>
					{/if}
				</div>

				{#if tab === 'preview'}
					<!-- Sandboxed with no allow-* flags: the body is stored markup, and it is
					     rendered here only to be looked at. -->
					<iframe class="frame" title="Rendered email" sandbox="" srcdoc={renderedHtml}></iframe>
				{:else}
					<pre class="plain">{renderedText}</pre>
				{/if}
			</section>
		</div>
	</div>
</AdminShell>

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;
	@use '$styles/mixins' as *;

	.head-btn {
		padding: 7px 14px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: $admin-ink;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-pill;
		text-decoration: none;
		white-space: nowrap;
		@include admin-focus-ring;
	}

	.lede {
		margin: 0 0 6px;
		font-size: 13px;
		line-height: 1.6;
		color: #555;
		max-width: 68ch;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin: 12px 0 20px;
	}

	.meta__chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		border-radius: $admin-radius-pill;

		&--on {
			color: admin-tone-fg('good');
			background: admin-tone-bg('good');
		}

		&--off {
			color: admin-tone-fg('bad');
			background: admin-tone-bg('bad');
		}

		&--edited {
			color: admin-tone-fg('info');
			background: admin-tone-bg('info');
		}
	}

	.meta__trigger {
		font-size: 12px;
		color: $admin-ink-3;

		span {
			font-weight: $font-weight-semibold;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			font-size: 10px;
			color: $admin-ink-3;
			margin-right: 6px;
		}
	}

	// Sticky to the bottom of the viewport so the save control is reachable from
	// anywhere in a long template, and the draft's state is always on screen.
	.savebar {
		position: sticky;
		bottom: 14px;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 18px;
		padding: 10px 10px 10px 16px;
		background: rgba(255, 255, 255, 0.86);
		backdrop-filter: blur(10px);
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-pill;
		box-shadow: $admin-shadow-raised;

		&--dirty {
			border-color: rgba(122, 84, 5, 0.28);
		}
	}

	.savebar__state {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-right: auto;
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: $admin-ink-2;
	}

	.savebar__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex: none;

		&--good {
			background: admin-tone-fg('good');
		}

		&--warn {
			background: admin-tone-fg('warn');
		}

		&--bad {
			background: admin-tone-fg('bad');
		}
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 16px;
		align-items: start;

		@include breakpoint-down($bp-lg) {
			grid-template-columns: 1fr;
		}
	}

	.col {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.col--preview {
		position: sticky;
		top: 88px;

		@include breakpoint-down($bp-lg) {
			position: static;
		}
	}

	.card {
		@include admin-card;
		gap: 12px;
	}

	.card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.card__title {
		@include admin-section-title;
	}

	.card__note {
		margin: 0;
		font-size: 12px;
		line-height: 1.6;
		color: $admin-ink-3;
	}

	.card__warn {
		margin: 0;
		font-size: 11px;
		line-height: 1.6;
		color: #8a6100;
	}

	.card__note code,
	.card__warn code {
		font-size: 11px;
		background: $admin-line-soft;
		padding: 1px 5px;
		border-radius: 3px;
		color: #333;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.field--grow {
		flex: 1 1 160px;
	}

	.field__row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.field__label {
		@include admin-field-label;

		em {
			font-style: normal;
			font-weight: $font-weight-regular;
			text-transform: none;
			letter-spacing: 0;
			color: $admin-ink-3;
		}
	}

	.field__hint {
		font-size: 11px;
		color: $admin-ink-3;
	}

	.row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.input {
		@include admin-input;
		width: 100%;
	}

	.input--small {
		padding: 5px 8px;
		font-size: 12px;
		width: auto;
		max-width: 100%;
	}

	.textarea {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
		line-height: 1.6;
		resize: vertical;
		min-height: 260px;
		tab-size: 2;
	}

	// The composed fields hold sentences, not markup, so they get the reading
	// face rather than the monospace one.
	.textarea--copy {
		font-family: $font-family-base;
		font-size: 13px;
		line-height: 1.6;
		min-height: 0;
	}

	// --- blocks ---------------------------------------------------------------

	.blocks {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.blocks__empty {
		margin: 0;
		padding: 24px 16px;
		text-align: center;
		font-size: 12px;
		color: #999;
		background: $admin-sunken;
		border: 1px dashed #dfe3e8;
		border-radius: $admin-radius-md;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-md;
	}

	.block__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.block__type {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 10px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #999;
	}

	.block__tools {
		display: flex;
		gap: 3px;
	}

	.icon {
		width: 26px;
		height: 26px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		color: $admin-ink-2;
		background: #fff;
		border: 1px solid #e0e3e8;
		border-radius: 5px;
		cursor: pointer;
		line-height: 1;
		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}
	}

	.gate {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.gate__label {
		font-size: 11px;
		color: #999;
	}

	.add__btn {
		padding: 6px 11px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-medium;
		color: #333;
		background: #fff;
		border: 1px solid #dfe3e8;
		border-radius: 999px;
		cursor: pointer;
	}

	.block__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		font-size: 10px;
		color: $admin-ink-2;
		background: $admin-line-soft;
		border-radius: 4px;
		letter-spacing: 0;
	}

	.add__btn--inline {
		align-self: flex-start;
		font-size: 11px;
		padding: 4px 10px;
	}

	// --- list items -----------------------------------------------------------

	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.item__marker {
		flex-shrink: 0;
		width: 16px;
		text-align: right;
		font-size: 12px;
		color: $admin-ink-3;
	}

	// --- insert palette -------------------------------------------------------

	// A hairline that only shows its "+" on hover, so fourteen insertion points
	// do not read as fourteen buttons stacked down the page.
	.insert {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 14px;

		&::before {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			height: 1px;
			background: $admin-line-soft;
			opacity: 0;
			transition: opacity 0.12s ease;
		}

		&:focus-within::before,
		&--open::before {
			opacity: 1;
		}
	}

	.insert__btn {
		position: relative;
		z-index: 1;
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		line-height: 1;
		color: #999;
		background: #fff;
		border: 1px solid #e0e3e8;
		border-radius: 50%;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.12s ease,
			color 0.12s ease,
			border-color 0.12s ease;

		.insert:focus-within &,
		.insert--open & {
			opacity: 1;
		} // Touch has no hover to reveal it, so it simply stays visible there.
		@media (hover: none) {
			opacity: 1;
		}
	}

	.palette {
		position: absolute;
		top: 26px;
		left: 50%;
		transform: translateX(-50%);
		z-index: $z-dropdown;
		width: min(420px, calc(100vw - 48px));
		max-height: 330px;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: #fff;
		border: 1px solid #e0e3e8;
		border-radius: $admin-radius-lg;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
	}

	.palette__title {
		margin: 0 0 6px;
		font-size: 10px;
		font-weight: $font-weight-bold;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: $admin-ink-3;
	}

	.palette__items {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;

		@include breakpoint-down($bp-xs) {
			grid-template-columns: 1fr;
		}
	}

	.palette__item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 7px 8px;
		text-align: left;
		background: transparent;
		border: 1px solid transparent;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		font: inherit;
		font-family: $font-family-base;
	}

	.palette__icon {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		color: #555;
		background: $admin-line-soft;
		border-radius: 5px;
	}

	.palette__body {
		min-width: 0;

		strong {
			display: block;
			font-size: 12px;
			font-weight: $font-weight-semibold;
			color: #111;
		}

		em {
			display: block;
			margin-top: 1px;
			font-size: 11px;
			font-style: normal;
			line-height: 1.4;
			color: #999;
		}
	}

	// --- upload picker --------------------------------------------------------

	.picker {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.picker__pick {
		display: inline-flex;
		align-items: center;
		padding: 9px 14px;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px solid $admin-line;
		border-radius: $admin-radius-sm;
		cursor: pointer;
		white-space: nowrap;
		input {
			display: none;
		}
	}

	.picker__url {
		flex: 1 1 180px;
		width: auto;
		min-width: 0;
	}

	.picker__at {
		margin: 0;
		font-size: 11px;
		color: $admin-ink-3;
		word-break: break-all;
	}

	.check--tight {
		padding: 9px 10px;

		em {
			line-height: 1.45;
		}
	}

	.problems {
		margin: 0;
		padding: 10px 12px 10px 28px;
		list-style: disc;
		font-size: 12px;
		line-height: 1.6;
		color: #8a6100;
		background: #fffdf6;
		border: 1px solid #f0e2bb;
		border-radius: $admin-radius-sm;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 11px 12px;
		background: $admin-sunken;
		border: 1px solid $admin-line-soft;
		border-radius: $admin-radius-sm;
		cursor: pointer;

		input {
			margin-top: 2px;
			width: 15px;
			height: 15px;
			accent-color: #111;
			flex-shrink: 0;
		}

		strong {
			display: block;
			font-size: 13px;
			font-weight: $font-weight-semibold;
			color: #111;
		}

		em {
			display: block;
			margin-top: 2px;
			font-size: 11px;
			font-style: normal;
			color: $admin-ink-3;
			line-height: 1.5;
		}
	}

	.btn {
		@include admin-btn-base;

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&--primary {
			@include admin-btn-primary;

			&:disabled {
				opacity: 0.45;
				cursor: not-allowed;
			}
		}
	}

	.vars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;

		li {
			display: flex;
			align-items: baseline;
			gap: 10px;
			flex-wrap: wrap;
		}
	}

	.var {
		flex-shrink: 0;
		padding: 3px 8px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 11px;
		color: #24427e;
		background: #eef2fb;
		border: 1px solid #dbe3f5;
		border-radius: 4px;
		cursor: pointer;
		&:disabled {
			opacity: 0.55;
			cursor: not-allowed;
		}
	}

	.var__desc {
		font-size: 11px;
		color: $admin-ink-3;
		line-height: 1.5;
	}

	.test {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;

		.input {
			flex: 1 1 180px;
			min-width: 0;
			width: auto;
		}
	}

	// --- preview --------------------------------------------------------------

	.switch {
		display: inline-flex;
		background: $admin-line-soft;
		border-radius: $admin-radius-sm;
		padding: 2px;
	}

	.switch__btn {
		padding: 5px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		color: $admin-ink-2;
		background: transparent;
		border: 0;
		border-radius: 4px;
		cursor: pointer;

		&--on {
			color: #111;
			background: #fff;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
		}

		&:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
	}

	.card--preview {
		padding: 0;
		gap: 0;
		overflow: hidden;
	}

	.preview__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 18px;
		flex-wrap: wrap;
	}

	.envelope {
		padding: 0 18px 14px;
		border-bottom: 1px solid $admin-line-soft;
	}

	.envelope__row {
		display: flex;
		gap: 10px;
		margin: 0 0 4px;
		font-size: 12px;
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		span {
			flex-shrink: 0;
			width: 52px;
			color: $admin-ink-3;
			font-size: 11px;
		}
	}

	.frame {
		width: 100%;
		height: 620px;
		border: 0;
		background: $admin-sunken;
		display: block;

		@include breakpoint-down($bp-lg) {
			height: 70svh;
		}
	}

	.plain {
		margin: 0;
		padding: 18px;
		height: 620px;
		overflow: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
		line-height: 1.7;
		color: #333;
		white-space: pre-wrap;
		word-break: break-word;
		background: $admin-sunken;

		@include breakpoint-down($bp-lg) {
			height: 70svh;
		}
	}
</style>
