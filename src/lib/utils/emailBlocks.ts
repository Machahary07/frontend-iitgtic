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
	| ({ type: 'lede'; text: string } & Common)
	| ({ type: 'sticker'; tone: BlockTone; text: string } & Common)
	| ({ type: 'progress'; stage: string } & Common)
	| ({ type: 'details'; title?: string; items: string[] } & Common)
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
	lede: {
		name: 'Intro',
		hint: 'The opening line under the heading, centred and a size up',
		group: 'Text',
		icon: 'Ⅰ'
	},
	sticker: {
		name: 'Status sticker',
		hint: 'A small pill above the heading, like “Submitted” or “Accepted”',
		group: 'Emphasis',
		icon: '◉'
	},
	progress: {
		name: 'Review progress',
		hint: 'The six review dots, with the current step glowing',
		group: 'Emphasis',
		icon: '⋯'
	},
	details: {
		name: 'Details card',
		hint: '“Label: value” rows on a black card, like startup, founder, stage',
		group: 'Emphasis',
		icon: '▤'
	},
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
		case 'lede':
		case 'note':
			return { type, text: '' };
		case 'sticker':
			return { type, tone: 'info', text: '' };
		case 'progress':
			return { type, stage: '1' };
		case 'details':
			return { type, title: '', items: ['Startup: {{startupName}}'] };
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
// _words_ in italics, the emphasis the headlines use. Only at word edges, so an
// underscore inside a link or a name is left alone.
const ITALIC = /(^|[\s(“"'])_([^_\n]+)_(?=$|[\s.,!?;:)”"'])/g;

export function renderInline(text: string): string {
	// Escaped first, so anything the author types is content rather than markup —
	// then the three markers below are the only tags that get through.
	return escapeHtml(text)
		.replace(
			LINK,
			(_m, label: string, href: string) =>
				`<a href="${href}" style="color:#004EBC;text-decoration:underline;">${label}</a>`
		)
		.replace(BOLD, '<strong>$1</strong>')
		.replace(ITALIC, '$1<em>$2</em>')
		.replace(/\n/g, '<br />');
}

// The same markers, flattened for anywhere the words are wanted without markup.
export function inlineToText(text: string): string {
	return text.replace(LINK, '$1 ($2)').replace(BOLD, '$1').replace(ITALIC, '$1$2');
}

// --- compiling --------------------------------------------------------------

// The house style (see .agents/emails-template.html): Anek Latin headlines with
// italic emphasis centred like the home page, Open Sans copy, black pill
// buttons, details on an inverted black card, and the six review dots. Gmail
// drops web fonts, so each stack falls back to something with the same shape.
const SANS = `'Open Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const SERIF = `'Anek Latin','Mukta',Georgia,'Times New Roman',serif`;
const INK = '#111111';
const COPY = '#2E3036';
const GREY = '#686A74';
const RULE = '#EDEDEA';

const HEADING = `margin:0 0 18px;font:800 36px/1.1 ${SERIF};color:${INK};letter-spacing:-0.025em;text-align:center;`;
const SUBHEADING = `margin:30px 0 12px;font:700 11px/1.4 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${INK};`;
const TEXT = `margin:0 0 18px;font:400 16px/1.7 ${SANS};color:${COPY};`;
const LEDE = `margin:0 auto 30px;max-width:440px;font:400 17px/1.6 ${SANS};color:${COPY};text-align:center;`;
const NOTE = `margin:26px 0 0;font:400 13px/1.6 ${SANS};color:${GREY};text-align:center;`;

const TONES: Record<BlockTone, { bar: string; bg: string; label: string }> = {
	info: { bar: '#004EBC', bg: '#EEF3FC', label: '#0B3A8C' },
	good: { bar: '#00B451', bg: '#E8F8EF', label: '#0B6B36' },
	bad: { bar: '#D93636', bg: '#FDEEEE', label: '#9A201F' }
};

// The six steps of the incubation review, in the colours the console uses.
export const REVIEW_STEP_COLORS = [
	'#E5484D',
	'#F76B15',
	'#F5A524',
	'#D6C31F',
	'#8BC34A',
	'#30A46C'
];
export const REVIEW_STEP_NAMES = [
	'Admin check',
	'CEO review',
	'Coordinator review',
	'CEO recheck',
	'TIC head review',
	'Live'
];

const SPACER_PX: Record<SpacerSize, number> = { small: 12, medium: 24, large: 40 };
const IMAGE_PX: Record<ImageWidth, string> = { small: '160', half: '260', full: '512' };

function dot(size: number, color: string, extra = ''): string {
	return `<div style="width:${size}px;height:${size}px;border-radius:${size}px;background:${color};${extra}font-size:0;line-height:0;">&nbsp;</div>`;
}

function list(items: string[], ordered: boolean): string {
	const rows = items
		.filter((item) => item.trim())
		.map((item, i) => {
			const mark = ordered
				? `<span style="font:italic 800 22px/1 ${SERIF};color:${i % 2 ? '#00B451' : '#004EBC'};">${String(i + 1).padStart(2, '0')}</span>`
				: dot(8, '#00B451', 'margin-top:8px;');
			return `<tr><td width="${ordered ? 44 : 22}" valign="top" style="padding:12px 0;border-bottom:1px solid ${RULE};">${mark}</td><td style="padding:12px 0;border-bottom:1px solid ${RULE};font:400 15px/1.6 ${SANS};color:${COPY};">${renderInline(item)}</td></tr>`;
		})
		.join('');
	return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border-top:1px solid ${RULE};">${rows}</table>`;
}

/** The dots for one fixed step: done filled, the current one glowing, later faint. */
export function progressDots(stage: number): string {
	const cells = REVIEW_STEP_COLORS.map((color, i) => {
		const style =
			i < stage - 1 || (stage === 6 && i === 5)
				? ''
				: i === stage - 1
					? `box-shadow:0 0 0 4px ${color}33,0 0 10px 2px ${color}88;`
					: 'opacity:0.2;';
		return `<td style="padding:0 6px;">${dot(12, color, style)}</td>`;
	}).join('');
	const caption = stage
		? `Step ${stage} of 6 &middot; ${REVIEW_STEP_NAMES[stage - 1]}`
		: 'Waiting for the admin check';
	return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${cells}</tr></table><p style="margin:10px 0 0;font:600 11px/1.4 ${SANS};letter-spacing:0.12em;text-transform:uppercase;color:${GREY};text-align:center;">${caption}</p></td></tr></table>`;
}

// A "Label: value" row. A value that is a single {{variable}} is dropped when
// that variable arrives empty, so an optional phone number leaves no blank row.
function detailRow(item: string): string {
	const at = item.indexOf(':');
	const label = at > 0 ? item.slice(0, at).trim() : '';
	const value = at > 0 ? item.slice(at + 1).trim() : item.trim();
	const row = `<tr><td style="padding:11px 0;border-top:1px solid #2A2A2A;font:600 10px/1.5 ${SANS};letter-spacing:0.14em;text-transform:uppercase;color:#9EA1A8;width:120px;" valign="top">${renderInline(label)}</td><td style="padding:11px 0;border-top:1px solid #2A2A2A;font:500 15px/1.5 ${SANS};color:#FFFFFF;">${renderInline(value)}</td></tr>`;
	const only = value.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
	return only ? `{{#if ${only[1]}}}${row}{{/if}}` : row;
}

function compile(block: EmailBlock): string {
	switch (block.type) {
		case 'heading':
			return `<h1 style="${HEADING}">${renderInline(block.text)}</h1>`;

		case 'subheading':
			return `<h2 style="${SUBHEADING}">${renderInline(block.text)}</h2>`;

		case 'lede':
			return `<p style="${LEDE}">${renderInline(block.text)}</p>`;

		case 'text':
			return `<p style="${TEXT}">${renderInline(block.text)}</p>`;

		case 'note':
			return `<p style="${NOTE}">${renderInline(block.text)}</p>`;

		case 'bullets':
			return list(block.items, false);

		case 'numbers':
			return list(block.items, true);

		case 'sticker': {
			const tone = TONES[block.tone] ?? TONES.info;
			return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px;"><tr><td style="border:1px solid ${tone.bar};border-radius:999px;padding:7px 14px;font:700 10px/1 ${SANS};letter-spacing:0.18em;text-transform:uppercase;color:${tone.label};"><span style="display:inline-block;width:7px;height:7px;border-radius:7px;background:${tone.bar};vertical-align:1px;margin-right:8px;"></span>${renderInline(block.text)}</td></tr></table>`;
		}

		case 'progress': {
			// A fixed step compiles to its dots. A {{variable}} compiles to all seven
			// and the sender picks one: sendTemplateEmail sets <name>_<n> from it.
			const variable = block.stage.trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/)?.[1];
			if (variable) {
				return [0, 1, 2, 3, 4, 5, 6]
					.map((n) => `{{#if ${variable}_${n}}}${progressDots(n)}{{/if}}`)
					.join('');
			}
			const fixed = Number(block.stage);
			return progressDots(Number.isInteger(fixed) && fixed >= 0 && fixed <= 6 ? fixed : 0);
		}

		case 'details': {
			const title = block.title?.trim()
				? `<tr><td colspan="2" style="padding:0 0 14px;font:700 10px/1 ${SANS};letter-spacing:0.18em;text-transform:uppercase;color:#00B451;">${renderInline(block.title)}</td></tr>`
				: '';
			const rows = block.items
				.filter((item) => item.trim())
				.map(detailRow)
				.join('');
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 24px;"><tr><td style="background:#0B0B0B;border-radius:18px;padding:22px 24px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${title}${rows}</table></td></tr></table>`;
		}

		case 'quote': {
			const from = block.attribution?.trim()
				? `<p style="margin:12px 0 0;font:700 10px/1.4 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${GREY};">${renderInline(block.attribution)}</p>`
				: '';
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 24px;"><tr><td style="padding:6px 8px;text-align:center;"><p style="margin:0;font:800 44px/0.6 ${SERIF};color:#00B451;">&ldquo;</p><p style="margin:8px 0 0;font:italic 500 22px/1.4 ${SERIF};color:${INK};">${renderInline(block.text)}</p>${from}</td></tr></table>`;
		}

		case 'divider':
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:26px 0;"><tr><td style="border-top:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

		case 'spacer':
			// A sized table cell rather than a margin: Outlook drops margins on empty
			// elements, and this is the shape that keeps the gap.
			return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${SPACER_PX[block.size] ?? 24}px;line-height:${SPACER_PX[block.size] ?? 24}px;font-size:0;">&nbsp;</td></tr></table>`;

		case 'signature':
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:30px 0 0;"><tr><td style="border-top:1px solid ${RULE};padding-top:22px;"><p style="margin:0;font:italic 700 20px/1.2 ${SERIF};color:${INK};">${renderInline(block.name)}</p>${
				block.role?.trim()
					? `<p style="margin:4px 0 0;font:400 13px/1.4 ${SANS};color:${GREY};">${renderInline(block.role)}</p>`
					: ''
			}</td></tr></table>`;

		case 'callout': {
			const tone = TONES[block.tone] ?? TONES.info;
			const label = block.label?.trim()
				? `<p style="margin:0 0 6px;font:700 10px/1.4 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${tone.label};">${renderInline(block.label)}</p>`
				: '';
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;"><tr><td style="background:${tone.bg};border-radius:16px;padding:20px 22px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td width="18" valign="top">${dot(10, tone.bar, 'margin-top:3px;')}</td><td>${label}<p style="margin:0;font:italic 500 18px/1.45 ${SERIF};color:${INK};">${renderInline(block.text)}</p></td></tr></table></td></tr></table>`;
		}

		case 'link':
			return `<p style="margin:0 0 18px;text-align:center;"><a href="${escapeHtml(block.href)}" style="font:italic 600 15px/1.5 ${SERIF};color:${INK};text-decoration:underline;">${renderInline(block.label)} &rarr;</a></p>`;

		case 'button':
			// A table rather than a styled <a>: Outlook ignores padding on inline
			// elements, and this is the shape that survives it.
			return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:10px auto 28px;">
	<tr><td style="background:#000000;border-radius:999px;">
		<a href="${escapeHtml(block.href)}" style="display:inline-block;padding:15px 38px;font:italic 600 16px/1 ${SERIF};color:#ffffff;text-decoration:none;border-radius:999px;">${renderInline(block.label)}</a>
	</td></tr>
</table>`;

		case 'image': {
			// width as an attribute as well as a style: Outlook reads the attribute.
			const px = IMAGE_PX[block.width] ?? IMAGE_PX.full;
			const img = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="${px}" style="width:100%;max-width:${px}px;height:auto;display:block;border:0;border-radius:14px;margin:0 auto;" />`;
			const wrapped = block.href?.trim() ? `<a href="${escapeHtml(block.href)}">${img}</a>` : img;
			return `<div style="margin:0 0 20px;text-align:center;">${wrapped}</div>`;
		}

		case 'file':
			return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
	<tr><td style="padding:14px 18px;background:#F6F6F3;border-radius:14px;">
		<a href="${escapeHtml(block.src)}" style="font:600 14px ${SANS};color:#004EBC;text-decoration:none;">${escapeHtml(block.name || 'Download')}</a>
		${block.size?.trim() ? `<span style="font:400 12px ${SANS};color:${GREY};"> · ${escapeHtml(block.size)}</span>` : ''}
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
			case 'lede':
			case 'note':
				out.push({ type, text, ...gate });
				break;
			case 'sticker':
				out.push({
					type,
					tone: TONE_VALUES.includes(item.tone as BlockTone) ? (item.tone as BlockTone) : 'info',
					text,
					...gate
				});
				break;
			case 'progress':
				out.push({ type, stage: str(item.stage).trim() || '0', ...gate });
				break;
			case 'details':
				out.push({ type, title: str(item.title), items, ...gate });
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
			case 'details':
				if (block.items.every((item) => !item.trim())) problems.push(`${at}: the list is empty.`);
				break;
			case 'progress':
				if (!/^([0-6]|\{\{\s*[\w.]+\s*\}\})$/.test(block.stage.trim()))
					problems.push(`${at}: use a step from 0 to 6, or a variable like {{stage}}.`);
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
