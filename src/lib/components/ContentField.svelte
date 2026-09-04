<script lang="ts">
	// Renders an editor for one value of arbitrary shape, recursing into objects
	// and arrays. Content sections differ wildly — a two-field hero, a list of FAQ
	// entries, categories of startups each holding their own list — so the editor
	// is driven by the data rather than by a hand-written form per section.
	import Self from './ContentField.svelte';
	import { resolveMedia } from '$lib/media';
	import { askConfirm } from '$lib/utils/dialog.svelte';

	interface Props {
		node: Record<string, unknown> | unknown[];
		field: string | number;
		label: string;
		depth?: number;
		/** Render an object's fields directly, without wrapping them in another
		 *  titled box — a list item already has its own header. */
		bare?: boolean;
	}

	let { node, field, label, depth = 0, bare = false }: Props = $props();

	const value = $derived((node as Record<string | number, unknown>)[field]);

	const kind = $derived.by(() => {
		if (Array.isArray(value)) return 'array';
		if (value === null) return 'text';
		if (typeof value === 'object') return 'object';
		if (typeof value === 'boolean') return 'boolean';
		if (typeof value === 'number') return 'number';
		return typeof (value as string) === 'string' && (value as string).length > 90
			? 'longtext'
			: 'text';
	});

	// Long-form copy deserves a textarea even when it is currently short.
	const LONG_FIELDS =
		/^(body|bio|answer|excerpt|lede|citation|description|summary|intro|text|content|blurb|note)$/i;
	const isLong = $derived(kind === 'longtext' || LONG_FIELDS.test(String(field)));

	// A string field whose name reads as an image gets an uploader with a preview
	// instead of a bare text box. Takes priority over the long-text branch, since
	// an uploaded URL can run past the length threshold.
	const MEDIA_FIELDS = /^(image|logo|photo|avatar|icon|poster|cover|coverImage|thumbnail|background)$/i;
	const isMedia = $derived(
		(kind === 'text' || kind === 'longtext') && MEDIA_FIELDS.test(String(field))
	);
	const preview = $derived(resolveMedia(value as string | null));

	let uploading = $state(false);
	let mediaError = $state<string | null>(null);

	async function upload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		mediaError = null;
		try {
			const body = new FormData();
			body.append('file', file);
			const res = await fetch('/api/tic-admin/content/assets', { method: 'POST', body });
			const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
			if (!res.ok || !data.url) {
				mediaError = data.message ?? 'Upload failed.';
				return;
			}
			set(data.url);
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	function humanise(key: string | number): string {
		if (typeof key === 'number') return `Item ${key + 1}`;
		return key
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/[_-]/g, ' ')
			.replace(/^./, (c) => c.toUpperCase());
	}

	function set(next: unknown) {
		(node as Record<string | number, unknown>)[field] = next;
	}

	// A new list item copies the shape of the existing ones with the values
	// cleared, so the editor never has to know the schema in advance.
	function blankLike(sample: unknown): unknown {
		if (Array.isArray(sample)) return [];
		if (sample && typeof sample === 'object') {
			return Object.fromEntries(
				Object.entries(sample as Record<string, unknown>).map(([k, v]) => [k, blankLike(v)])
			);
		}
		if (typeof sample === 'number') return 0;
		if (typeof sample === 'boolean') return false;
		return '';
	}

	function addItem() {
		const list = value as unknown[];
		list.push(list.length > 0 ? blankLike(list[0]) : '');
	}

	async function removeItem(index: number) {
		const list = value as unknown[];
		const what = itemLabel(list[index], index);
		const ok = await askConfirm({
			title: `Remove ${what}?`,
			body: 'It leaves this section when you save.',
			confirmLabel: 'Remove',
			tone: 'danger'
		});
		if (!ok) return;
		list.splice(index, 1);
	}

	function move(index: number, by: number) {
		const list = value as unknown[];
		const target = index + by;
		if (target < 0 || target >= list.length) return;
		[list[index], list[target]] = [list[target], list[index]];
	}

	// Prefer a human-recognisable field for the collapsed heading of a list item.
	function itemLabel(item: unknown, index: number): string {
		if (item && typeof item === 'object' && !Array.isArray(item)) {
			const row = item as Record<string, unknown>;
			for (const key of ['title', 'name', 'question', 'role', 'label', 'headline', 'slug']) {
				if (typeof row[key] === 'string' && row[key]) return row[key] as string;
			}
		}
		if (typeof item === 'string' && item) return item;
		return `Item ${index + 1}`;
	}
</script>

{#if kind === 'object' && bare}
	<div class="group__body">
		{#each Object.keys(value as Record<string, unknown>) as childKey (childKey)}
			<Self
				node={value as Record<string, unknown>}
				field={childKey}
				label={humanise(childKey)}
				{depth}
			/>
		{/each}
	</div>
{:else if kind === 'object'}
	<fieldset class="group" class:group--nested={depth > 0}>
		<legend class="group__legend">{label}</legend>
		<div class="group__body">
			{#each Object.keys(value as Record<string, unknown>) as childKey (childKey)}
				<Self
					node={value as Record<string, unknown>}
					field={childKey}
					label={humanise(childKey)}
					depth={depth + 1}
				/>
			{/each}
		</div>
	</fieldset>
{:else if kind === 'array'}
	<fieldset class="group group--list" class:group--nested={depth > 0}>
		<legend class="group__legend">
			{label}
			<span class="group__count">{(value as unknown[]).length}</span>
		</legend>

		<div class="items">
			{#each value as unknown[] as item, index (index)}
				<div class="item">
					<div class="item__bar">
						<span class="item__title">{itemLabel(item, index)}</span>
						<div class="item__tools">
							<button
								type="button"
								class="icon"
								title="Move up"
								disabled={index === 0}
								onclick={() => move(index, -1)}>↑</button
							>
							<button
								type="button"
								class="icon"
								title="Move down"
								disabled={index === (value as unknown[]).length - 1}
								onclick={() => move(index, 1)}>↓</button
							>
							<button
								type="button"
								class="icon icon--danger"
								title="Remove"
								onclick={() => removeItem(index)}>✕</button
							>
						</div>
					</div>
					<div class="item__body">
						<Self
							node={value as unknown[]}
							field={index}
							label={itemLabel(item, index)}
							depth={depth + 1}
							bare
						/>
					</div>
				</div>
			{/each}
		</div>

		<button type="button" class="add" onclick={addItem}>+ Add {label.toLowerCase()}</button>
	</fieldset>
{:else if kind === 'boolean'}
	<label class="check">
		<input
			type="checkbox"
			checked={value as boolean}
			onchange={(e) => set((e.currentTarget as HTMLInputElement).checked)}
		/>
		<span>{label}</span>
	</label>
{:else if kind === 'number'}
	<label class="field">
		<span class="field__label">{label}</span>
		<input
			class="field__input"
			type="number"
			value={value as number}
			oninput={(e) => set(Number((e.currentTarget as HTMLInputElement).value))}
		/>
	</label>
{:else if isMedia}
	<div class="field field--wide">
		<span class="field__label">{label}</span>
		<div class="media">
			<div class="media__preview">
				{#if preview}
					<img src={preview} alt="" />
				{:else}
					<span class="media__empty">No image</span>
				{/if}
			</div>
			<div class="media__controls">
				<input
					class="field__input"
					type="text"
					value={String(value ?? '')}
					placeholder="Upload a file or paste an image URL"
					oninput={(e) => set((e.currentTarget as HTMLInputElement).value)}
				/>
				<div class="media__actions">
					<label class="media__btn" class:media__btn--busy={uploading}>
						{uploading ? 'Uploading…' : 'Upload image'}
						<input type="file" accept="image/*" hidden disabled={uploading} onchange={upload} />
					</label>
					{#if value}
						<button type="button" class="media__btn media__btn--ghost" onclick={() => set('')}>
							Clear
						</button>
					{/if}
				</div>
				{#if mediaError}<span class="media__error">{mediaError}</span>{/if}
			</div>
		</div>
	</div>
{:else if isLong}
	<label class="field field--wide">
		<span class="field__label">{label}</span>
		<textarea
			class="field__input field__input--area"
			rows={Math.min(12, Math.max(3, Math.ceil(String(value ?? '').length / 90)))}
			value={String(value ?? '')}
			oninput={(e) => set((e.currentTarget as HTMLTextAreaElement).value)}
		></textarea>
	</label>
{:else}
	<label class="field">
		<span class="field__label">{label}</span>
		<input
			class="field__input"
			type="text"
			value={String(value ?? '')}
			oninput={(e) => set((e.currentTarget as HTMLInputElement).value)}
		/>
	</label>
{/if}

<style lang="scss">
	@use '$styles/variables' as *;
	@use '$styles/admin' as *;

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;

		&--wide {
			grid-column: 1 / -1;
		}
	}

	.field__label {
		@include admin-field-label;
	}

	.field__input {
		@include admin-input;
		font-size: 13px;
		width: 100%;

		&--area {
			resize: vertical;
			line-height: 1.55;
		}
	}

	.media {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}

	.media__preview {
		flex: none;
		width: 96px;
		height: 72px;
		display: grid;
		place-items: center;
		padding: 6px;
		border: 1px solid #e6e8ec;
		border-radius: 8px;
		background: #f6f7f9;
		overflow: hidden;

		img {
			max-width: 100%;
			max-height: 100%;
			width: auto;
			height: auto;
			object-fit: contain;
		}
	}

	.media__empty {
		font-size: 11px;
		color: #9aa0aa;
	}

	.media__controls {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.media__actions {
		display: inline-flex;
		gap: 6px;
	}

	.media__btn {
		display: inline-flex;
		align-items: center;
		padding: 6px 12px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #fff;
		background: #111;
		border: 1px solid #111;
		border-radius: 6px;
		cursor: pointer;

		&:hover {
			background: #000;
		}

		&--busy {
			opacity: 0.6;
			cursor: default;
		}

		&--ghost {
			color: #444;
			background: #fff;
			border-color: #d8dbe0;

			&:hover {
				background: #eef0f3;
			}
		}
	}

	.media__error {
		font-size: 12px;
		color: #a01515;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #111;
		font-family: $font-family-base;

		input {
			width: 16px;
			height: 16px;
			accent-color: #111;
		}
	}

	.group {
		grid-column: 1 / -1;
		margin: 0;
		padding: 16px;
		border: 1px solid #e6e8ec;
		border-radius: 8px;
		background: #fff;
		min-width: 0;

		&--nested {
			background: #fafbfc;
		}
	}

	.group__legend {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 6px;
		font-size: 11px;
		font-weight: $font-weight-semibold;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: #555;
	}

	.group__count {
		padding: 1px 7px;
		font-size: 10px;
		letter-spacing: 0;
		color: #555;
		background: #eef0f3;
		border-radius: 999px;
	}

	.group__body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.item {
		border: 1px solid #e6e8ec;
		border-radius: 8px;
		overflow: hidden;
		background: #fff;
	}

	.item__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 10px 8px 14px;
		background: #f6f7f9;
		border-bottom: 1px solid #eef0f3;
	}

	.item__title {
		font-size: 12.5px;
		font-weight: $font-weight-semibold;
		color: #111;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item__tools {
		display: inline-flex;
		gap: 4px;
		flex: none;
	}

	.item__body {
		padding: 14px;
	}

	.icon {
		width: 26px;
		height: 26px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font: inherit;
		font-size: 12px;
		color: #444;
		background: #fff;
		border: 1px solid #d8dbe0;
		border-radius: 6px;
		cursor: pointer;

		&:hover:not(:disabled) {
			background: #eef0f3;
		}

		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}

		&--danger {
			color: #a01515;
			border-color: #f5c2c2;

			&:hover:not(:disabled) {
				background: #fdecec;
			}
		}
	}

	.add {
		margin-top: 10px;
		padding: 7px 13px;
		font: inherit;
		font-family: $font-family-base;
		font-size: 12px;
		font-weight: $font-weight-semibold;
		color: #111;
		background: #fff;
		border: 1px dashed #c8ccd3;
		border-radius: 6px;
		cursor: pointer;

		&:hover {
			background: #f3f4f6;
			border-color: #111;
		}
	}
</style>
