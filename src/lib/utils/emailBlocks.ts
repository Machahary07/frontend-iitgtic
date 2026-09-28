// The plain-language shape of an email body.
//
// Editing a transactional email should not mean editing HTML. A message is a
// list of blocks — a heading, some paragraphs, a list, a highlight, a button —
// and the console edits those as ordinary form fields. renderBlocks() compiles
// them to the table-and-inline-style markup email clients need, which is the
// only place that markup is written.
//
// The bundled templates in emailTemplates.ts are authored as blocks and their
// HTML is derived, so the two can never drift. Every bundled block can be
// reordered, edited or deleted, and a template can be rebuilt from nothing.
// An admin who wants the markup can still switch the editor to HTML mode; that
// saves a body with no blocks and the template stays hand-edited until reset.

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

export type BlockTone = 'info' | 'good' | 'bad';
export type SpacerSize = 'small' | 'medium' | 'large';
export type ImageWidth = 'small' | 'half' | 'full';

// `showIf` / `hideIf` name a variable: the block is kept only when that variable
// arrives set, or only when it arrives empty. Together they are what replaces
// {{#if reason}}…{{else}}…{{/if}} in the editor — an optional reviewer note
// disappears rather than leaving a blank panel, and a greeting can have a
// fallback for the case where no name was given. Only one applies; `showIf`
// wins if both are somehow set.
type Common = { showIf?: string; hideIf?: string };

export type EmailBlock =
	| ({ type: 'heading'; text: string } & Common)
	| ({ type: 'subheading'; text: string } & Common)
	| ({ type: 'text'; text: string } & Common)
	| ({ type: 'bullets'; items: string[] } & Common)
	| ({ type: 'numbers'; items: string[] } & Common)
	| ({ type: 'quote'; text: string; attribution?: string } & Common)
	| ({ type: 'callout'; tone: BlockTone; label?: string; text: string } & Common)
	| ({ type: 'button'; label: string; href: string } & Common)
	| ({ type: 'link'; label: string; href: string } & Common)
	| ({ type: 'image'; src: string; alt: string; width: ImageWidth; href?: string } & Common)
	| ({ type: 'file'; src: string; name: string; size?: string; attach?: boolean } & Common)
	| ({ type: 'note'; text: string } & Common)
	| ({ type: 'signature'; name: string; role?: string } & Common)
	| ({ type: 'divider' } & Common)
	| ({ type: 'spacer'; size: SpacerSize } & Common);

export type BlockType = EmailBlock['type'];

export type BlockMeta = {
	name: string;
	hint: string;
	// Grouping for the insert palette, so fifteen components stay findable.
	group: 'Text' | 'Emphasis' | 'Media' | 'Spacing';
	icon: string;
};

export const BLOCK_LABELS: Record<BlockType, BlockMeta> = {
	heading: {
		name: 'Heading',
		hint: 'The one line that says what the email is about',
		group: 'Text',
		icon: 'H'
	},
	subheading: {
		name: 'Subheading',
		hint: 'A smaller title that opens a section',
		group: 'Text',
		icon: 'h'
	},
	text: { name: 'Paragraph', hint: 'A normal paragraph of the message', group: 'Text', icon: '¶' },
	bullets: {
		name: 'Bullet list',
		hint: 'Points that have no particular order',
		group: 'Text',
		icon: '•'
	},
	numbers: { name: 'Numbered list', hint: 'Steps that happen in order', group: 'Text', icon: '1.' },
	quote: { name: 'Quote', hint: 'Someone else’s words, set apart', group: 'Text', icon: '❝' },
	callout: {
		name: 'Highlight',
		hint: 'A boxed line that stands out — good news, or a reason',
		group: 'Emphasis',
		icon: '▮'
	},
	button: {
		name: 'Button',
		hint: 'A link the reader is meant to click',
		group: 'Emphasis',
		icon: '▭'
	},
	link: { name: 'Link', hint: 'A plain text link on its own line', group: 'Emphasis', icon: '↗' },
	image: {
		name: 'Image',
		hint: 'A picture — upload one or paste a link',
		group: 'Media',
		icon: '▣'
	},
	file: {
		name: 'File',
		hint: 'A document to download, and optionally attach',
		group: 'Media',
		icon: '📎'
	},
	note: { name: 'Small print', hint: 'A quieter line at the end', group: 'Text', icon: 'ⁿ' },
	signature: { name: 'Signature', hint: 'Who the message is from', group: 'Text', icon: '✎' },
	divider: {
		name: 'Divider',
		hint: 'A horizontal rule between sections',
		group: 'Spacing',
		icon: '—'
	},
	spacer: { name: 'Spacer', hint: 'Empty vertical room', group: 'Spacing', icon: '↕' }
};

export const BLOCK_GROUPS: BlockMeta['group'][] = ['Text', 'Emphasis', 'Media', 'Spacing'];

export const TONE_LABELS: Record<BlockTone, string> = {
	info: 'Neutral',
	good: 'Positive',
	bad: 'Negative'
};

export const SPACER_LABELS: Record<SpacerSize, string> = {
	small: 'Small',
	medium: 'Medium',
	large: 'Large'
};

export const IMAGE_WIDTH_LABELS: Record<ImageWidth, string> = {
	small: 'Small (160px)',
	half: 'Half width',
	full: 'Full width'
};

export function blankBlock(type: BlockType): EmailBlock {
	switch (type) {
		case 'heading':
		case 'subheading':
		case 'text':
		case 'note':
			return { type, text: '' };
		case 'bullets':
		case 'numbers':
			return { type, items: [''] };
		case 'quote':
			return { type, text: '', attribution: '' };
		case 'callout':
			return { type, tone: 'info', label: '', text: '' };
		case 'button':
		case 'link':
			return { type, label: '', href: '{{siteUrl}}' };
		case 'image':
			return { type, src: '', alt: '', width: 'full' };
		case 'file':
			return { type, src: '', name: '', size: '', attach: false };
		case 'signature':
			return { type, name: '', role: '' };
		case 'divider':
			return { type };
		case 'spacer':
			return { type, size: 'medium' };
	}
}

// --- inline formatting ------------------------------------------------------

// Deliberately tiny: bold, links and line breaks. Anything more and the field
// stops being plain text, which is the whole point of writing here rather than
// in the HTML tab.
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BOLD = /\*\*?([^*\n]+)\*\*?/g;

export function renderInline(text: string): string {
	// Escaped first, so anything the author types is content rather than markup —
	// then the three markers below are the only tags that get through.
	return escapeHtml(text)
		.replace(
			LINK,
			(_m, label: string, href: string) =>
				`<a href="${href}" style="color:#004EBB;text-decoration:underline;">${label}</a>`
		)
		.replace(BOLD, '<strong>$1</strong>')
		.replace(/\n/g, '<br />');
}

// The same markers, flattened for anywhere the words are wanted without markup.
export function inlineToText(text: string): string {
	return text.replace(LINK, '$1 ($2)').replace(BOLD, '$1');
}

// --- compiling --------------------------------------------------------------

const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const HEADING = `margin:0 0 16px;font:600 20px/1.3 ${SANS};color:#111111;letter-spacing:-0.01em;`;
const SUBHEADING = `margin:24px 0 10px;font:600 15px/1.4 ${SANS};color:#111111;`;
const TEXT = `margin:0 0 14px;`;
const NOTE = `margin:18px 0 0;font-size:13px;color:#777777;`;
const LIST = `margin:0 0 14px;padding-left:22px;`;
const LIST_ITEM = `margin:0 0 6px;`;

const TONES: Record<BlockTone, { bar: string; bg: string; label: string }> = {
	info: { bar: '#004EBB', bg: '#f6f8fd', label: '#24427e' },
	good: { bar: '#0EB05B', bg: '#f2fbf6', label: '#0e6b2c' },
	bad: { bar: '#a01515', bg: '#fdf4f4', label: '#9a1515' }
};

const SPACER_PX: Record<SpacerSize, number> = { small: 12, medium: 24, large: 40 };
const IMAGE_PX: Record<ImageWidth, string> = { small: '160', half: '260', full: '496' };

function list(items: string[], ordered: boolean): string {
	const tag = ordered ? 'ol' : 'ul';
	const rows = items
		.filter((item) => item.trim())
		.map((item) => `<li style="${LIST_ITEM}">${renderInline(item)}</li>`)
		.join('');
	return `<${tag} style="${LIST}">${rows}</${tag}>`;
}

function compile(block: EmailBlock): string {
	switch (block.type) {
		case 'heading':
			return `<h1 style="${HEADING}">${renderInline(block.text)}</h1>`;

		case 'subheading':
			return `<h2 style="${SUBHEADING}">${renderInline(block.text)}</h2>`;

		case 'text':
			return `<p style="${TEXT}">${renderInline(block.text)}</p>`;

		case 'note':
			return `<p style="${NOTE}">${renderInline(block.text)}</p>`;

		case 'bullets':
			return list(block.items, false);

		case 'numbers':
			return list(block.items, true);

		case 'quote': {
			const from = block.attribution?.trim()
				? `<p style="margin:8px 0 0;font-size:12px;color:#888888;">— ${renderInline(block.attribution)}</p>`
				: '';
			return `<blockquote style="margin:0 0 18px;padding:2px 0 2px 16px;border-left:3px solid #e0e3e8;"><p style="margin:0;font-size:15px;font-style:italic;color:#444444;">${renderInline(block.text)}</p>${from}</blockquote>`;
		}

		case 'divider':
			return `<hr style="margin:24px 0;border:0;border-top:1px solid #eef0f3;" />`;

		case 'spacer':
			// A sized table cell rather than a margin: Outlook drops margins on empty
			// elements, and this is the shape that keeps the gap.
			return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${SPACER_PX[block.size] ?? 24}px;line-height:${SPACER_PX[block.size] ?? 24}px;font-size:0;">&nbsp;</td></tr></table>`;

		case 'signature':
			return `<p style="margin:22px 0 0;font-size:14px;color:#333333;">${renderInline(block.name)}${
				block.role?.trim()
					? `<br /><span style="font-size:13px;color:#888888;">${renderInline(block.role)}</span>`
					: ''
			}</p>`;

		case 'callout': {
			const tone = TONES[block.tone] ?? TONES.info;
			const label = block.label?.trim()
				? `<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${tone.label};">${renderInline(block.label)}</p>`
				: '';
			return `<div style="margin:0 0 18px;padding:14px 16px;background:${tone.bg};border-left:3px solid ${tone.bar};border-radius:0 6px 6px 0;">${label}<p style="margin:0;font-size:14px;color:#333333;">${renderInline(block.text)}</p></div>`;
		}

		case 'link':
			return `<p style="${TEXT}"><a href="${escapeHtml(block.href)}" style="color:#004EBB;text-decoration:underline;">${renderInline(block.label)}</a></p>`;

		case 'button':
			// A table rather than a styled <a>: Outlook ignores padding on inline
			// elements, and this is the shape that survives it.
			return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
	<tr><td style="background:#111111;border-radius:6px;">
		<a href="${escapeHtml(block.href)}" style="display:inline-block;padding:11px 22px;font:600 14px ${SANS};color:#ffffff;text-decoration:none;">${renderInline(block.label)}</a>
	</td></tr>
</table>`;

		case 'image': { // width as an attribute as well as a style: Outlook reads the attribute.
			const px = IMAGE_PX[block.width] ?? IMAGE_PX.full;
			const img = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="${px}" style="width:100%;max-width:${px}px;height:auto;display:block;border:0;border-radius:8px;" />`;
			const wrapped = block.href?.trim() ? `<a href="${escapeHtml(block.href)}">${img}</a>` : img;
			return `<div style="margin:0 0 18px;">${wrapped}</div>`;
		}

		case 'file':
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">
	<tr><td style="padding:12px 14px;background:#fafbfc;border:1px solid #eef0f3;border-radius:8px;">
		<a href="${escapeHtml(block.src)}" style="font:600 14px ${SANS};color:#004EBB;text-decoration:none;">${escapeHtml(block.name || 'Download')}</a>
		${block.size?.trim() ? `<span style="font-size:12px;color:#888888;"> · ${escapeHtml(block.size)}</span>` : ''}
	</td></tr>
</table>`;
	}
}

/**
 * Compiles a block list to the body HTML that gets stored and sent. A block with
 * `showIf` / `hideIf` is wrapped in the same conditional the template renderer
 * already understands, so nothing downstream needs to know blocks exist.
 */
export function renderBlocks(blocks: EmailBlock[]): string {
	return blocks
		.map((block) => {
			const html = compile(block);
			const show = block.showIf?.trim();
			if (show) return `{{#if ${show}}}${html}{{/if}}`;

			// The empty "then" branch is how "only when this is blank" is said in the
			// conditional syntax the template renderer already understands.
			const hide = block.hideIf?.trim();
			return hide ? `{{#if ${hide}}}{{else}}${html}{{/if}}` : html;
		})
		.join('\n');
}

/**
 * Files a message wants delivered as real attachments rather than only linked.
 * The send path passes these to the provider; a file block without the flag is
 * just a download card in the body.
 */
export function attachmentsFor(blocks: EmailBlock[]): { filename: string; path: string }[] {
	return blocks
		.filter(
			(b): b is Extract<EmailBlock, { type: 'file' }> =>
				b.type === 'file' && Boolean(b.attach) && Boolean(b.src?.trim())
		)
		.map((b) => ({ filename: b.name?.trim() || 'attachment', path: b.src.trim() }));
}

// --- validation -------------------------------------------------------------

const TYPES = Object.keys(BLOCK_LABELS) as BlockType[];
const TONE_VALUES: BlockTone[] = ['info', 'good', 'bad'];
const SPACER_VALUES: SpacerSize[] = ['small', 'medium', 'large'];
const WIDTH_VALUES: ImageWidth[] = ['small', 'half', 'full'];

function str(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function trimmedOrUndefined(value: unknown): string | undefined {
	const s = str(value).trim();
	return s ? s : undefined;
}

/**
 * Normalises whatever the browser posted into blocks the compiler can trust.
 * The save route runs this and compiles the body itself rather than storing the
 * HTML the client sent — the body is derived data, and letting a client supply
 * it directly would be a way to put arbitrary markup in an outgoing email.
 *
 * An empty list is valid: clearing a template out and rebuilding it is a normal
 * thing to do, and the save route decides separately whether an empty message is
 * worth refusing.
 */
export function parseBlocks(input: unknown): EmailBlock[] | null {
	if (!Array.isArray(input)) return null;

	const out: EmailBlock[] = [];
	for (const raw of input) {
		if (!raw || typeof raw !== 'object') return null;
		const item = raw as Record<string, unknown>;
		const type = item.type as BlockType;
		if (!TYPES.includes(type)) return null;

		const showIf = trimmedOrUndefined(item.showIf);
		const hideIf = showIf ? undefined : trimmedOrUndefined(item.hideIf);
		const gate = { ...(showIf ? { showIf } : {}), ...(hideIf ? { hideIf } : {}) };
		const text = str(item.text);
		const items = Array.isArray(item.items) ? item.items.map(str) : [];

		switch (type) {
			case 'heading':
			case 'subheading':
			case 'text':
			case 'note':
				out.push({ type, text, ...gate });
				break;
			case 'bullets':
			case 'numbers':
				out.push({ type, items, ...gate });
				break;
			case 'quote':
				out.push({ type, text, attribution: str(item.attribution), ...gate });
				break;
			case 'divider':
				out.push({ type, ...gate });
				break;
			case 'spacer':
				out.push({
					type,
					size: SPACER_VALUES.includes(item.size as SpacerSize)
						? (item.size as SpacerSize)
						: 'medium',
					...gate
				});
				break;
			case 'signature':
				out.push({ type, name: str(item.name), role: str(item.role), ...gate });
				break;
			case 'callout':
				out.push({
					type,
					tone: TONE_VALUES.includes(item.tone as BlockTone) ? (item.tone as BlockTone) : 'info',
					label: str(item.label),
					text,
					...gate
				});
				break;
			case 'button':
			case 'link':
				out.push({ type, label: str(item.label), href: str(item.href), ...gate });
				break;
			case 'image':
				out.push({
					type,
					src: str(item.src),
					alt: str(item.alt),
					width: WIDTH_VALUES.includes(item.width as ImageWidth)
						? (item.width as ImageWidth)
						: 'full',
					href: str(item.href),
					...gate
				});
				break;
			case 'file':
				out.push({
					type,
					src: str(item.src),
					name: str(item.name),
					size: str(item.size),
					attach: item.attach === true,
					...gate
				});
				break;
		}
	}
	return out;
}

// Blocks that are broken rather than merely empty — a button that goes nowhere,
// an image with no source. Worth stopping on save; anything else is the author's
// business.
export function blockProblems(blocks: EmailBlock[]): string[] {
	const problems: string[] = [];
	blocks.forEach((block, i) => {
		const at = `Block ${i + 1} (${BLOCK_LABELS[block.type].name})`;
		switch (block.type) {
			case 'button':
			case 'link':
				if (!block.label.trim()) problems.push(`${at}: give it a label.`);
				if (!block.href.trim()) problems.push(`${at}: give it a link.`);
				break;
			case 'image':
				if (!block.src.trim()) problems.push(`${at}: upload a picture or paste its address.`);
				if (!block.alt.trim())
					problems.push(`${at}: describe the picture, for readers who cannot see it.`);
				break;
			case 'file':
				if (!block.src.trim()) problems.push(`${at}: upload a file or paste its address.`);
				if (!block.name.trim()) problems.push(`${at}: give the file a name.`);
				break;
			case 'bullets':
			case 'numbers':
				if (block.items.every((item) => !item.trim())) problems.push(`${at}: the list is empty.`);
				break;
			case 'signature':
				if (!block.name.trim()) problems.push(`${at}: who is it from?`);
				break;
			case 'divider':
			case 'spacer':
				break;
			default:
				if (!block.text.trim()) problems.push(`${at}: the text is empty.`);
		}
	});
	return problems;
}
