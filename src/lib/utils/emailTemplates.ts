// Transactional email templates: the bundled copy, the variables each one is
// given, and the renderer they share.
//
// Same arrangement as site content — what is here is the fallback, a row in
// public.email_templates overrides it, and resetting a template deletes the row.
// The definitions live in $lib/utils rather than $lib/server because the console
// editor needs them too: it lists the variables a template may use and renders
// the live preview in the browser with the sample values below.

import { escapeHtml, renderBlocks, type EmailBlock } from '$lib/utils/emailBlocks';
import { SCORED_STEPS } from '$lib/utils/applicationScores';

export type TemplateVariable = {
	name: string;
	description: string;
	sample: string;
};

export type EmailTemplateDef = {
	key: string;
	name: string;
	description: string;
	// Where the send is made from, shown in the editor so it is clear what
	// actually triggers the message.
	trigger: string;
	group:
		| 'Layout'
		| 'Founder accounts'
		| 'Startups'
		| 'Incubation applications'
		| 'Internal review'
		| 'Founder console'
		| 'Admin'
		| 'Role applicants'
		| 'Newsletter'
		| 'Direct';
	variables: TemplateVariable[];
	subject: string;
	// The body as an admin edits it. Every template except the layout is authored
	// this way and its HTML is compiled from it, so the plain-language version is
	// the source and the markup is derived.
	blocks?: EmailBlock[];
	body: string;
};

// Every template is given these on top of its own variables.
export const COMMON_VARIABLES: TemplateVariable[] = [
	{ name: 'siteName', description: 'Name of the centre', sample: 'IIT Guwahati TIC' },
	{
		name: 'siteUrl',
		description: 'Public site origin',
		sample: 'https://iitgtic.itsjeu.com'
	},
	{ name: 'year', description: 'Current year', sample: String(new Date().getFullYear()) }
];

export const EMAIL_LAYOUT_KEY = 'layout';

// --- rendering --------------------------------------------------------------

// A variable is truthy when it is present and not an empty string — which is how
// `{{#if rejectionReason}}` decides whether to show the reason block.
function truthy(value: unknown): boolean {
	return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * Renders `{{name}}` (HTML-escaped), `{{{name}}}` (raw — used for the layout's
 * content slot and anywhere copy is already markup) and `{{#if name}}…{{else}}…{{/if}}`.
 *
 * Deliberately not a general template language: admins edit these from a browser
 * form, so the only things a template can do are substitute a value the call site
 * passed and switch a block on whether that value is set.
 */
export function renderTemplate(source: string, variables: Record<string, string>): string {
	// Conditionals first, so a variable inside a dropped branch is never
	// substituted. Innermost first — a branch may not itself contain an {{#if}} —
	// and repeated until none are left, so a block nested in another (an optional
	// row inside a conditional card) closes on its own {{/if}}, not its parent's.
	const inner = '((?:(?!\\{\\{#if)[\\s\\S])*?)';
	const block = new RegExp(
		`\\{\\{#if\\s+([\\w.]+)\\s*\\}\\}${inner}(?:\\{\\{else\\}\\}${inner})?\\{\\{\\/if\\}\\}`,
		'g'
	);
	let out = source;
	for (let pass = 0; pass < 20 && block.test(out); pass += 1) {
		block.lastIndex = 0;
		out = out.replace(block, (_match, name: string, yes: string, no = '') =>
			truthy(variables[name]) ? yes : no
		);
		block.lastIndex = 0;
	}

	out = out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_match, name: string) => variables[name] ?? '');
	return out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, name: string) =>
		escapeHtml(variables[name] ?? '')
	);
}

// Entities the bundled copy actually uses. A full table is not worth carrying —
// anything unlisted is left as written rather than guessed at.
const NAMED_ENTITIES: Record<string, string> = {
	copy: '\u00a9',
	reg: '\u00ae',
	hellip: '\u2026',
	mdash: '\u2014',
	ndash: '\u2013',
	lsquo: '\u2018',
	rsquo: '\u2019',
	ldquo: '\u201c',
	rdquo: '\u201d',
	middot: '\u00b7',
	rarr: '\u2192',
	lbrace: '{',
	rbrace: '}'
};

// Plain-text alternative. Every provider wants one, and a message with only an
// HTML part scores worse with spam filters than one carrying both.
export function htmlToText(html: string): string {
	return (
		html
			.replace(/<style[\s\S]*?<\/style>/gi, '')
			.replace(/<head[\s\S]*?<\/head>/gi, '')
			// Hidden containers are chrome for the inbox, not content: the layout's
			// preheader is one, and leaving it in repeats the opening line at the top
			// of the text part.
			.replace(/<(div|span|td)\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/\1>/gi, '')
			.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
			// Side-by-side cells (a details row's label and value) keep a gap.
			.replace(/<\/td>\s*<td/gi, '</td> <td')
			.replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(
				/&(copy|reg|hellip|mdash|ndash|lsquo|rsquo|ldquo|rdquo|middot|rarr|lbrace|rbrace);/g,
				(_m, name: string) => NAMED_ENTITIES[name] ?? _m
			)
			.replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			// Last, so an escaped &amp;copy; does not decode twice into ©.
			.replace(/&amp;/g, '&')
			.split('\n')
			.map((line) => line.trim())
			.join('\n')
			// After trimming, not before: a line of pure whitespace only becomes an
			// empty one here, and collapsing first would leave those runs behind.
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

// --- bundled copy -----------------------------------------------------------

// The TIC symbol's dot grid, blue melting into green: the strip under the logo.
// Built once here so the layout stays a plain string an admin can edit.
function dotStrip(): string {
	const rows = 3;
	const cols = 26;
	const mix = (f: number) => {
		const a = [0x00, 0x4e, 0xbc];
		const b = [0x00, 0xb4, 0x51];
		return (
			'#' +
			a
				.map((x, i) =>
					Math.round(x + (b[i] - x) * f)
						.toString(16)
						.padStart(2, '0')
				)
				.join('')
		);
	};
	let out = '';
	for (let r = 0; r < rows; r++) {
		let cells = '';
		for (let c = 0; c < cols; c++) {
			const reach = cols * (0.32 - 0.12 * (Math.abs(r - 1) - 1));
			const show = r === 1 || (Math.abs(c - (cols - 1) / 2) <= reach && c % 2 === 1);
			cells += `<td style="padding:0 2px;"><div style="width:6px;height:6px;border-radius:6px;background:${show ? mix(c / (cols - 1)) : 'transparent'};font-size:0;line-height:0;">&nbsp;</div></td>`;
		}
		out += `<tr><td style="padding:2px 0;"><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${cells}</tr></table></td></tr>`;
	}
	return `<table role="presentation" cellpadding="0" cellspacing="0" align="center">${out}</table>`;
}

const FONT_SANS = `'Open Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const FONT_SERIF = `'Anek Latin','Mukta',Georgia,'Times New Roman',serif`;

// The shared chrome. Every other template renders into `{{{content}}}`, so the
// logo, the dot strip, the black footer band and the table scaffolding email
// clients still need are written once. Inline styles throughout — Gmail strips
// <style> blocks. The logo is a PNG: no major inbox renders SVG.
const LAYOUT_BODY = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="color-scheme" content="light" />
		<link href="https://fonts.googleapis.com/css2?family=Anek+Latin:wght@400..800&family=Open+Sans:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet" />
	</head>
	<body style="margin:0;padding:0;background:#EDEDE8;">
		<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preheader}}</div>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEDE8;padding:40px 12px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:24px;overflow:hidden;">
						<tr>
							<td align="center" style="padding:34px 40px 8px;">
								<a href="{{siteUrl}}"><img src="{{siteUrl}}/brand/tic-iitg-horizontal-color.png" width="200" alt="TIC IITG — Technology Incubation Centre, IIT Guwahati" style="display:block;border:0;width:200px;height:auto;" /></a>
							</td>
						</tr>
						<tr>
							<td align="center" style="padding:18px 40px 30px;">${dotStrip()}</td>
						</tr>
						<tr>
							<td style="padding:0 44px 40px;font:400 16px/1.7 ${FONT_SANS};color:#2E3036;">
								{{{content}}}
							</td>
						</tr>
						<tr>
							<td style="background:#000000;padding:34px 44px 30px;">
								<p style="margin:0 0 18px;font:italic 700 24px/1.2 ${FONT_SERIF};color:#FFFFFF;letter-spacing:-0.01em;">Building deep tech<br />from the North East.</p>
								<p style="margin:0 0 22px;"><a href="{{siteUrl}}" style="color:#FFFFFF;text-decoration:none;font:italic 600 14px/1 ${FONT_SERIF};">Website</a> &nbsp;&nbsp; <a href="{{siteUrl}}/programs" style="color:#FFFFFF;text-decoration:none;font:italic 600 14px/1 ${FONT_SERIF};">Programs</a> &nbsp;&nbsp; <a href="{{siteUrl}}/events" style="color:#FFFFFF;text-decoration:none;font:italic 600 14px/1 ${FONT_SERIF};">Events</a> &nbsp;&nbsp; <a href="{{siteUrl}}/contact" style="color:#FFFFFF;text-decoration:none;font:italic 600 14px/1 ${FONT_SERIF};">Contact</a></p>
								<div style="height:1px;background:#262626;line-height:1px;font-size:0;margin:0 0 16px;">&nbsp;</div>
								<p style="margin:0;font:400 12px/1.7 ${FONT_SANS};color:#9EA1A8;">Technology Incubation Centre, IIT Guwahati, Assam 781039<br />You are receiving this because you contacted or applied to {{siteName}}. &copy; {{year}}</p>
								{{#if unsubscribeUrl}}<p style="margin:14px 0 0;font:400 12px/1.6 ${FONT_SANS};"><a href="{{unsubscribeUrl}}" style="color:#9EA1A8;text-decoration:underline;">Unsubscribe from the newsletter</a></p>{{/if}}
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

// A template is authored as blocks and its HTML follows from them, so the
// console's plain-language editor and the markup it sends can never disagree.
// Only the layout is written as HTML: it is the scaffolding the blocks land in,
// not a message anyone composes.
function fromBlocks(blocks: EmailBlock[]): { blocks: EmailBlock[]; body: string } {
	return { blocks, body: renderBlocks(blocks) };
}

// The panel's average mark per step. A step nobody marked passes an empty
// variable and its row is dropped; the whole card goes if nothing was marked.
const SCORE_VARIABLES: TemplateVariable[] = [
	...SCORED_STEPS.map((s) => ({
		name: `score_${s.step}`,
		description: `Average score for ${s.title} — row dropped if empty`,
		sample: '72/100'
	})),
	{ name: 'scoreOverall', description: 'Average across the steps', sample: '70/100' }
];

function scoreCard(extra: string[] = []): EmailBlock {
	return {
		type: 'details',
		title: 'Your scores',
		items: [
			...extra,
			...SCORED_STEPS.map((s) => `${s.title}: {{score_${s.step}}}`),
			'Overall: {{scoreOverall}}'
		],
		showIf: 'scoreOverall'
	};
}

const SIGN_OFF: EmailBlock = {
	type: 'signature',
	name: 'Team TIC IITG',
	role: 'Technology Incubation Centre, IIT Guwahati'
};

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
	{
		key: EMAIL_LAYOUT_KEY,
		name: 'Shared layout',
		description:
			'Logo, dot strip, black footer band and table scaffolding wrapped around every other template. Edit it to change the branding on all mail at once.',
		trigger: 'Wraps every outgoing message',
		group: 'Layout',
		variables: [
			{ name: 'content', description: 'The template body — use {{{content}}}', sample: '' },
			{
				name: 'preheader',
				description: 'Inbox preview line, hidden in the message itself',
				sample: 'A short summary shown next to the subject'
			}
		],
		subject: '{{subject}}',
		body: LAYOUT_BODY
	},

	// --- founder accounts ---------------------------------------------------
	{
		key: 'founder-welcome',
		name: 'Founder welcome & confirm email',
		description:
			'Sent when a founder signs up. Welcomes them and carries the link that confirms their email — until they follow it, the final step of the application cannot be submitted.',
		trigger: 'A founder signs up at /apply (and on "resend" from the application)',
		group: 'Founder accounts',
		variables: [
			{ name: 'fullName', description: 'Founder name', sample: 'Rahul Bora' },
			{
				name: 'verifyUrl',
				description: 'Signed one-off link that confirms the address',
				sample: 'https://iitgtic.itsjeu.com/verify-email?u=…&e=…&t=…'
			}
		],
		subject: 'Welcome to {{siteName}} — confirm your email',
		...fromBlocks([
			{ type: 'sticker', tone: 'good', text: 'Account created' },
			{ type: 'heading', text: 'Welcome, _{{fullName}}_', showIf: 'fullName' },
			{ type: 'heading', text: 'Welcome to _TIC IITG_', hideIf: 'fullName' },
			{
				type: 'lede',
				text: 'Your founder console is ready. Register your startup, then start the incubation application whenever you like — it saves as you go.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'One thing first',
				text: 'Confirm your email so we can reach you about your application. The final step cannot be submitted until you do.'
			},
			{ type: 'button', label: 'Confirm your email', href: '{{verifyUrl}}' },
			{ type: 'subheading', text: 'What happens next' },
			{
				type: 'numbers',
				items: [
					'Register your startup in the console.',
					'Fill in the incubation application.',
					'Our team reviews it and keeps you posted by email.'
				]
			},
			{
				type: 'note',
				text: 'Did not create this account? You can safely ignore this email — nothing happens until the link is used.'
			},
			SIGN_OFF
		])
	},

	{
		key: 'founder-login',
		name: 'Founder sign-in notice',
		description:
			'A "welcome back" heads-up sent when a founder signs in, throttled to at most once a day so it stays a security signal rather than noise.',
		trigger: 'A founder signs in at /login (at most once per 24h)',
		group: 'Founder accounts',
		variables: [
			{ name: 'fullName', description: 'Founder name', sample: 'Rahul Bora' },
			{ name: 'email', description: 'Their account email (dropped if empty)', sample: '' },
			{ name: 'loginTime', description: 'When they signed in (dropped if empty)', sample: '' }
		],
		subject: 'New sign-in to your {{siteName}} account',
		...fromBlocks([
			{ type: 'sticker', tone: 'info', text: 'Security' },
			{ type: 'heading', text: 'Welcome back, _{{fullName}}_', showIf: 'fullName' },
			{ type: 'heading', text: 'New _sign-in_', hideIf: 'fullName' },
			{ type: 'lede', text: 'You just signed in to your founder console.' },
			{
				type: 'details',
				title: 'Sign-in',
				items: ['When: {{loginTime}}', 'Account: {{email}}'],
				showIf: 'loginTime'
			},
			{
				type: 'text',
				text: 'If this was you, there is nothing to do. If it was not, reset your password from the sign-in page right away and let us know.'
			},
			{ type: 'button', label: 'Go to your console', href: '{{siteUrl}}/founder' },
			SIGN_OFF
		])
	},

	{
		key: 'account-deleted',
		name: 'Account deleted by TIC',
		description:
			'Tells the person their account has been removed by the TIC team, so a login that stops working is never a mystery.',
		trigger: 'An admin deletes the account from /tic-admin/users',
		group: 'Founder accounts',
		variables: [
			{ name: 'fullName', description: 'Account holder name', sample: 'Rahul Bora' },
			{ name: 'email', description: 'The deleted account email', sample: 'rahul@example.com' }
		],
		subject: 'Your {{siteName}} account has been deleted',
		...fromBlocks([
			{ type: 'sticker', tone: 'bad', text: 'Account deleted' },
			{ type: 'heading', text: 'Goodbye, _{{fullName}}_', showIf: 'fullName' },
			{ type: 'heading', text: 'Your account was _deleted_', hideIf: 'fullName' },
			{
				type: 'lede',
				text: 'The TIC team has deleted your account ({{email}}). You can no longer sign in with it, and the startups registered under it have been removed from the console.'
			},
			{
				type: 'text',
				text: 'If you think this was a mistake, reply to this email or reach us through the contact page and we will look into it.'
			},
			{ type: 'button', label: 'Contact TIC', href: '{{siteUrl}}/contact' },
			SIGN_OFF
		])
	},

	{
		key: 'account-self-deleted',
		name: 'Account deleted by its owner',
		description:
			'Confirms to a founder that the account they deleted from Settings is gone, and flags it if they did not do it.',
		trigger: 'A founder deletes their own account from /founder/account',
		group: 'Founder accounts',
		variables: [
			{ name: 'fullName', description: 'Account holder name', sample: 'Rahul Bora' },
			{ name: 'email', description: 'The deleted account email', sample: 'rahul@example.com' }
		],
		subject: 'Your {{siteName}} account has been deleted',
		...fromBlocks([
			{ type: 'sticker', tone: 'bad', text: 'Account deleted' },
			{ type: 'heading', text: 'Goodbye, _{{fullName}}_', showIf: 'fullName' },
			{ type: 'heading', text: 'Your account is _deleted_', hideIf: 'fullName' },
			{
				type: 'lede',
				text: 'As you asked, your account ({{email}}) has been deleted, along with the startups registered under it. You can no longer sign in with it.'
			},
			{
				type: 'text',
				text: 'Thank you for being part of TIC IITG. You are always welcome to sign up again and apply in a future cycle.'
			},
			{
				type: 'note',
				text: 'Did not do this yourself? Reply to this email right away and we will look into it.'
			},
			SIGN_OFF
		])
	},

	// --- startups -----------------------------------------------------------
	{
		key: 'startup-registered',
		name: 'Startup registered',
		description:
			'Confirms a founder has registered a startup and points them at its incubation application, which is what TIC reviews.',
		trigger: 'A founder registers a startup in the console',
		group: 'Startups',
		variables: [
			{ name: 'companyName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'contactName', description: 'Contact person', sample: 'Rahul Bora' },
			{ name: 'email', description: 'Account email', sample: 'rahul@brahmaputra.bio' }
		],
		subject: '{{companyName}} is registered — next, the application',
		...fromBlocks([
			{ type: 'sticker', tone: 'good', text: 'Registered' },
			{ type: 'heading', text: '_{{companyName}}_ is registered' },
			{
				type: 'lede',
				text: 'Thanks, {{contactName}}. Your startup now has its own space in the founder console. To be considered for incubation, fill in its application — that is what our team reviews.'
			},
			{
				type: 'bullets',
				items: [
					'It takes about 20 minutes and saves as you go.',
					'Keep your pitch deck handy as a PDF.',
					'Posting roles and reading applicants unlock once you are accepted.'
				]
			},
			{
				type: 'button',
				label: 'Fill the application form',
				href: '{{siteUrl}}/founder/application'
			},
			{
				type: 'note',
				text: 'Registered from {{email}}. If this was not you, reply to this email and we will look into it.'
			},
			SIGN_OFF
		])
	},

	// --- incubation applications --------------------------------------------
	{
		key: 'application-received',
		name: 'Application received',
		description: 'Confirms a submitted incubation application and explains how the review works.',
		trigger: 'A founder submits the application at /founder/application',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{
				name: 'applicationId',
				description: 'The application id',
				sample: '00000000-0000-0000-0000-000000000000'
			}
		],
		subject: 'We have received your {{siteName}} application',
		...fromBlocks([
			{ type: 'progress', stage: '0' },
			{ type: 'sticker', tone: 'info', text: 'Submitted' },
			{ type: 'heading', text: 'Got it, _{{fullName}}_', showIf: 'fullName' },
			{ type: 'heading', text: 'Application _received_', hideIf: 'fullName' },
			{
				type: 'lede',
				text: 'Your incubation application for **{{startupName}}** has reached us. Our team checks every application by hand, so please give us a little time.'
			},
			{ type: 'subheading', text: 'How the review works' },
			{
				type: 'numbers',
				items: [
					'Our admin team checks it is complete.',
					'The CEO and a panel of coordinators and TIC heads review it.',
					'We email you the decision — and at every step in between.'
				]
			},
			{ type: 'button', label: 'View your application', href: '{{siteUrl}}/founder/application' },
			{
				type: 'note',
				text: 'The application cannot be edited once submitted. If something important changes, reply to this email.'
			},
			SIGN_OFF
		])
	},
	{
		key: 'application-under-review',
		name: 'Application under review',
		description:
			'Tells the applicant their application passed the first check and is with the panel.',
		trigger: 'Admin passes the application to the CEO',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'Your {{siteName}} application is under review',
		...fromBlocks([
			{ type: 'progress', stage: '1' },
			{ type: 'sticker', tone: 'info', text: 'Under review' },
			{ type: 'heading', text: 'We are reading it _now_' },
			{
				type: 'lede',
				text: 'Hi {{fullName}}, your application for **{{startupName}}** passed our first check and is now with the review panel.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'Note from the team',
				text: '{{note}}',
				showIf: 'note'
			},
			{
				type: 'text',
				text: 'There is nothing you need to do right now. We will email you as soon as there is news.'
			},
			{ type: 'button', label: 'Track your application', href: '{{siteUrl}}/founder/companies' },
			SIGN_OFF
		])
	},
	{
		key: 'application-accepted',
		name: 'Application accepted',
		description:
			'The final email: the startup is accepted for incubation, and its company is verified so roles and team access unlock.',
		trigger: 'Admin accepts after every TIC head signs off',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' },
			...SCORE_VARIABLES
		],
		subject: 'Congratulations — {{startupName}} is in',
		...fromBlocks([
			{ type: 'progress', stage: '5' },
			{ type: 'sticker', tone: 'good', text: 'Accepted' },
			{ type: 'heading', text: 'Welcome to _TIC IITG_' },
			{
				type: 'callout',
				tone: 'good',
				label: 'Accepted for incubation',
				text: '{{startupName}} has been accepted into the Technology Incubation Centre, IIT Guwahati.'
			},
			{
				type: 'text',
				text: 'Congratulations, {{fullName}}. This is the start of something good, and we are glad to build it with you.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'Note from the panel',
				text: '{{note}}',
				showIf: 'note'
			},
			scoreCard(),
			{ type: 'subheading', text: 'Your first steps' },
			{
				type: 'numbers',
				items: [
					'Our team will contact you within a week to schedule onboarding.',
					'Posting roles and team access are now unlocked in your console.',
					'Your startup will appear among our incubated startups shortly.'
				]
			},
			{ type: 'button', label: 'Open your founder console', href: '{{siteUrl}}/founder' },
			SIGN_OFF
		])
	},
	{
		key: 'application-rejected',
		name: 'Application declined',
		description: 'Tells the applicant they were not accepted this time, with the panel’s feedback.',
		trigger: 'Admin or the CEO rejects the application',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' },
			{ name: 'decidedAt', description: 'Review step it was declined at', sample: 'CEO review' },
			{ name: 'decidedBy', description: 'Role that declined it', sample: 'TIC CEO' },
			...SCORE_VARIABLES
		],
		subject: 'About your {{siteName}} application',
		...fromBlocks([
			{ type: 'sticker', tone: 'bad', text: 'Decision' },
			{ type: 'heading', text: 'Not _this_ time' },
			{
				type: 'lede',
				text: 'Hi {{fullName}}, thank you for applying with **{{startupName}}**. After careful review, we are not able to offer incubation in this cycle.'
			},
			{
				type: 'callout',
				tone: 'bad',
				label: 'Feedback from the panel',
				text: '{{note}}',
				showIf: 'note'
			},
			scoreCard(['Review step: {{decidedAt}}', 'Decided by: {{decidedBy}}']),
			{
				type: 'text',
				text: 'This is not a judgement on you or the idea’s future. Many of our incubated founders applied more than once — we would genuinely like to hear from you again.'
			},
			{ type: 'button', label: 'Explore our programs', href: '{{siteUrl}}/programs' },
			SIGN_OFF
		])
	},
	{
		key: 'startup-live',
		name: 'Startup is live',
		description:
			'Closes the loop: the startup now shows among the incubated startups on the website.',
		trigger: 'Admin marks the startup live (the sixth dot)',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Founder name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' }
		],
		subject: '{{startupName}} is now live on {{siteName}}',
		...fromBlocks([
			{ type: 'progress', stage: '6' },
			{ type: 'sticker', tone: 'good', text: 'Live' },
			{ type: 'heading', text: '_{{startupName}}_ is live' },
			{
				type: 'lede',
				text: 'Your startup now appears on our incubated startups page — share it with your investors, customers and team.'
			},
			{ type: 'button', label: 'See your listing', href: '{{siteUrl}}/incubated-startups' },
			{ type: 'link', label: 'Update your startup details', href: '{{siteUrl}}/founder/settings' },
			SIGN_OFF
		])
	},

	// --- internal review ----------------------------------------------------
	{
		key: 'review-your-turn',
		name: 'An application needs your review',
		description:
			'Tells the next person in the review chain that an application is waiting on them: the CEO when admin passes it on, each assigned coordinator or TIC head, the CEO again for the recheck, and admin for the final email.',
		trigger: 'An application reaches a new step of the review chain',
		group: 'Internal review',
		variables: [
			{ name: 'recipientName', description: 'Who is being asked', sample: 'Priya' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'founderName', description: 'Founder name', sample: 'Rahul Bora' },
			{ name: 'stage', description: 'The step it is at, 1–6', sample: '3' },
			{ name: 'stageName', description: 'That step in words', sample: 'Coordinator review' },
			{
				name: 'ask',
				description: 'What they are asked to do',
				sample: 'the CEO has assigned you to review this incubation application.'
			},
			{ name: 'assignedBy', description: 'Who handed it over (dropped if empty)', sample: '' },
			{
				name: 'applicationUrl',
				description: 'Link to the application in the console',
				sample: 'https://iitgtic.itsjeu.com/tic-admin/applications/…'
			}
		],
		subject: 'Your review: {{startupName}}',
		...fromBlocks([
			{ type: 'progress', stage: '{{stage}}' },
			{ type: 'sticker', tone: 'info', text: 'Your turn · {{stageName}}' },
			{ type: 'heading', text: 'An application is _waiting on you_' },
			{ type: 'lede', text: 'Hi {{recipientName}}, {{ask}} Only the people assigned can see it.' },
			{
				type: 'details',
				title: 'The application',
				items: [
					'Startup: {{startupName}}',
					'Founder: {{founderName}}',
					'Step: {{stage}} / 6 · {{stageName}}',
					'Handed over by: {{assignedBy}}'
				]
			},
			{ type: 'button', label: 'Open the application', href: '{{applicationUrl}}' },
			{ type: 'note', text: 'You are getting this because of your role in the TIC review chain.' }
		])
	},

	// --- founder console ----------------------------------------------------
	{
		key: 'role-decision',
		name: 'Job posting approved / sent back',
		description:
			'Tells a founder whether TIC approved a role they posted, or sent it back with a reason.',
		trigger: 'Admin approves or refuses a job posting in Approvals',
		group: 'Founder console',
		variables: [
			{ name: 'contactName', description: 'Founder or contact name', sample: 'Rahul Bora' },
			{ name: 'role', description: 'Role title', sample: 'Lab Research Intern' },
			{ name: 'companyName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'approved', description: 'Set when approved, empty when sent back', sample: 'yes' },
			{ name: 'reason', description: 'Why it was sent back (dropped if empty)', sample: '' }
		],
		subject:
			'{{#if approved}}Your role “{{role}}” is live{{else}}Your role “{{role}}” needs a change{{/if}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'good', text: 'Approved', showIf: 'approved' },
			{ type: 'sticker', tone: 'bad', text: 'Sent back', hideIf: 'approved' },
			{ type: 'heading', text: 'Your role is _on the board_', showIf: 'approved' },
			{ type: 'heading', text: 'Your role _needs a change_', hideIf: 'approved' },
			{
				type: 'lede',
				text: '“{{role}}” at {{companyName}} is now live on the opportunities page.',
				showIf: 'approved'
			},
			{
				type: 'lede',
				text: 'TIC looked at “{{role}}” at {{companyName}} and sent it back before it goes public.',
				hideIf: 'approved'
			},
			{
				type: 'callout',
				tone: 'bad',
				label: 'What to change',
				text: '{{reason}}',
				showIf: 'reason'
			},
			{ type: 'button', label: 'Manage your roles', href: '{{siteUrl}}/founder/jobs' },
			SIGN_OFF
		])
	},
	{
		key: 'new-role-applicant',
		name: 'New applicant for your role',
		description: 'Tells a startup that someone has applied to one of its posted roles.',
		trigger: 'Someone applies to a role a startup posted',
		group: 'Founder console',
		variables: [
			{ name: 'contactName', description: 'Founder or contact name', sample: 'Rahul Bora' },
			{ name: 'role', description: 'Role title', sample: 'Lab Research Intern' },
			{ name: 'applicantName', description: 'Applicant name', sample: 'Meera Das' },
			{ name: 'applicantEmail', description: 'Applicant email', sample: 'meera@example.com' },
			{ name: 'applicantRole', description: 'Applying as (dropped if empty)', sample: 'Intern' }
		],
		subject: 'New applicant for {{role}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'info', text: 'New applicant' },
			{ type: 'heading', text: 'Someone applied to _{{role}}_' },
			{
				type: 'details',
				title: 'Applicant',
				items: [
					'Name: {{applicantName}}',
					'Email: {{applicantEmail}}',
					'Applying as: {{applicantRole}}'
				]
			},
			{ type: 'button', label: 'See the applicant', href: '{{siteUrl}}/founder/applicants' },
			SIGN_OFF
		])
	},

	// --- admin --------------------------------------------------------------
	{
		key: 'admin-signin-alert',
		name: 'Admin sign-in alert',
		description:
			'A security heads-up to the operating inbox whenever someone signs in to the TIC admin console.',
		trigger: 'Any staff account signs in at /login',
		group: 'Admin',
		variables: [
			{ name: 'adminName', description: 'Who signed in', sample: 'Ananya Sharma' },
			{ name: 'adminEmail', description: 'Their account email', sample: 'ananya@iitg.ac.in' },
			{ name: 'loginTime', description: 'When they signed in (dropped if empty)', sample: '' }
		],
		subject: 'New sign-in to the {{siteName}} console',
		...fromBlocks([
			{ type: 'sticker', tone: 'info', text: 'Security' },
			{ type: 'heading', text: 'Console _sign-in_' },
			{ type: 'lede', text: 'Someone just signed in to the TIC admin console.' },
			{
				type: 'details',
				title: 'Console sign-in',
				items: ['Account: {{adminName}} — {{adminEmail}}', 'When: {{loginTime}}']
			},
			{
				type: 'text',
				text: 'If you do not recognise this sign-in, reset that account’s password and review it in Users.'
			},
			{ type: 'button', label: 'Open Users', href: '{{siteUrl}}/tic-admin/users' }
		])
	},
	{
		key: 'new-applicant-alert',
		name: 'New founder signed up',
		description:
			'A heads-up to the operating inbox whenever a new founder creates an account. One per founder, sent at signup.',
		trigger: 'A founder signs up at /apply',
		group: 'Admin',
		variables: [
			{ name: 'fullName', description: 'Founder name', sample: 'Rahul Bora' },
			{ name: 'email', description: 'Founder email', sample: 'rahul@brahmaputra.bio' },
			{ name: 'phone', description: 'Founder phone (dropped if empty)', sample: '9876543210' },
			{ name: 'signupTime', description: 'When they signed up (dropped if empty)', sample: '' }
		],
		subject: 'New founder signed up — {{fullName}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'good', text: 'New founder' },
			{ type: 'heading', text: 'A new founder _just joined_' },
			{
				type: 'details',
				title: 'New founder',
				items: [
					'Name: {{fullName}}',
					'Email: {{email}}',
					'Phone: {{phone}}',
					'Signed up: {{signupTime}}'
				]
			},
			{ type: 'button', label: 'Open the console', href: '{{siteUrl}}/tic-admin/users' }
		])
	},

	// --- role applicants ----------------------------------------------------
	{
		key: 'job-application-received',
		name: 'Role application received',
		description: 'A receipt for someone who applied to a role on the opportunities board.',
		trigger: 'Someone submits the apply form at /opportunities/[id]',
		group: 'Role applicants',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Priya Das' },
			{ name: 'role', description: 'Role applied for', sample: 'Embedded Systems Engineer' },
			{ name: 'company', description: 'Hiring company', sample: 'Northeast Robotics' },
			{ name: 'jobUrl', description: 'Link back to the posting', sample: '/opportunities/abc' }
		],
		subject: 'Application received — {{role}} at {{company}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'info', text: 'Received' },
			{ type: 'heading', text: 'Thanks, _{{fullName}}_' },
			{
				type: 'lede',
				text: 'Your application for **{{role}}** at **{{company}}** has reached us. We will be in touch if you are shortlisted.'
			},
			{ type: 'button', label: 'View the role', href: '{{jobUrl}}' },
			{ type: 'link', label: 'Browse more roles', href: '{{siteUrl}}/opportunities' },
			SIGN_OFF
		])
	},
	{
		key: 'job-applicant-shortlisted',
		name: 'Applicant shortlisted',
		description: 'Tells a role applicant they are on the shortlist.',
		trigger: 'An admin moves a role applicant to Shortlisted',
		group: 'Role applicants',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Priya Das' },
			{ name: 'role', description: 'Role applied for', sample: 'Embedded Systems Engineer' },
			{ name: 'company', description: 'Hiring company', sample: 'Northeast Robotics' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'You have been shortlisted for {{role}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'good', text: 'Shortlisted' },
			{ type: 'heading', text: 'You are on the _shortlist_' },
			{
				type: 'lede',
				text: 'Hi {{fullName}}, you have been shortlisted for **{{role}}** at {{company}}. The next step is a conversation with the team.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'Next step',
				text: 'Expect an email or a call from the startup within a few days.'
			},
			{ type: 'callout', tone: 'info', label: 'Note', text: '{{note}}', showIf: 'note' },
			SIGN_OFF
		])
	},
	{
		key: 'job-applicant-forwarded',
		name: 'Application sent to the company',
		description: 'Tells a role applicant their application has gone directly to the startup.',
		trigger: 'An admin moves a role applicant to Forwarded',
		group: 'Role applicants',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Priya Das' },
			{ name: 'role', description: 'Role applied for', sample: 'Embedded Systems Engineer' },
			{ name: 'company', description: 'Hiring company', sample: 'Northeast Robotics' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'Your application has gone to {{company}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'info', text: 'With the startup' },
			{ type: 'heading', text: 'Your application is _with the team_' },
			{
				type: 'lede',
				text: 'We have passed your application for **{{role}}** directly to {{company}}. They will contact you if they would like to take it further.'
			},
			{ type: 'callout', tone: 'info', label: 'Note', text: '{{note}}', showIf: 'note' },
			SIGN_OFF
		])
	},
	{
		key: 'job-applicant-rejected',
		name: 'Applicant not taken forward',
		description: 'Tells a role applicant the startup is not taking their application forward.',
		trigger: 'An admin moves a role applicant to Rejected',
		group: 'Role applicants',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Priya Das' },
			{ name: 'role', description: 'Role applied for', sample: 'Embedded Systems Engineer' },
			{ name: 'company', description: 'Hiring company', sample: 'Northeast Robotics' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'Update on your {{role}} application',
		...fromBlocks([
			{ type: 'sticker', tone: 'bad', text: 'Update' },
			{ type: 'heading', text: 'Thank you for _applying_' },
			{
				type: 'lede',
				text: 'Hi {{fullName}}, the team has decided not to take your application for **{{role}}** forward this time.'
			},
			{ type: 'callout', tone: 'bad', label: 'Feedback', text: '{{note}}', showIf: 'note' },
			{
				type: 'text',
				text: 'New roles open at our startups every month — we would love to see you apply again.'
			},
			{ type: 'button', label: 'See open roles', href: '{{siteUrl}}/opportunities' },
			SIGN_OFF
		])
	},

	// --- newsletter ---------------------------------------------------------
	{
		key: 'newsletter',
		name: 'Newsletter',
		description:
			'The message sent to everyone on the newsletter list. Compose it here (or ask the assistant to), then send the blast — every recipient gets a one-click unsubscribe link.',
		trigger: 'Sent to every active subscriber when the newsletter is blasted',
		group: 'Newsletter',
		variables: [],
		subject: 'News from {{siteName}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'info', text: 'Newsletter' },
			{ type: 'heading', text: 'This month at _TIC_' },
			{ type: 'lede', text: 'A quick round-up of what is happening across the incubator.' },
			{ type: 'subheading', text: 'First story' },
			{ type: 'text', text: 'Write your update here.' },
			SIGN_OFF
		])
	},
	{
		key: 'newsletter-welcome',
		name: 'Newsletter subscription confirmed',
		description: 'Thanks someone for subscribing, so a sign-up is never met with silence.',
		trigger: 'Someone subscribes from the site footer',
		group: 'Newsletter',
		variables: [],
		subject: 'You are subscribed to {{siteName}}',
		...fromBlocks([
			{ type: 'sticker', tone: 'good', text: 'Subscribed' },
			{ type: 'heading', text: 'You are _on the list_' },
			{
				type: 'lede',
				text: 'Thanks for subscribing. You will hear from us about events, new cohorts, open roles and founder stories. No spam, ever.'
			},
			{ type: 'button', label: 'Visit the website', href: '{{siteUrl}}' },
			SIGN_OFF
		])
	},

	// --- direct -------------------------------------------------------------
	{
		key: 'direct-message',
		name: 'Direct message',
		description:
			'A one-off email the assistant composes and sends to specific people — an applicant, a company, an individual. It is restaged each time it is sent; the exact message that went out is kept in the delivery log.',
		trigger: 'Sent by the assistant to a chosen recipient',
		group: 'Direct',
		variables: [],
		subject: 'A message from {{siteName}}',
		...fromBlocks([
			{ type: 'heading', text: '_Hello_' },
			{ type: 'text', text: 'Your message here.' },
			SIGN_OFF
		])
	}
];

export function templateDef(key: string): EmailTemplateDef | undefined {
	return EMAIL_TEMPLATES.find((t) => t.key === key);
}

// Sample values for the editor preview: the template's own variables plus the
// common set, so a preview never renders a blank where a name should be.
export function sampleVariables(def: Pick<EmailTemplateDef, 'variables'>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const v of [...COMMON_VARIABLES, ...def.variables]) out[v.name] = v.sample;
	// A {{stage}} progress block shows the dots for the sample step, as a send would.
	if (/^[0-6]$/.test(out.stage ?? '')) out[`stage_${out.stage}`] = '1';
	return out;
}
