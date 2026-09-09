// Transactional email templates: the bundled copy, the variables each one is
// given, and the renderer they share.
//
// Same arrangement as site content — what is here is the fallback, a row in
// public.email_templates overrides it, and resetting a template deletes the row.
// The definitions live in $lib/utils rather than $lib/server because the console
// editor needs them too: it lists the variables a template may use and renders
// the live preview in the browser with the sample values below.

import { escapeHtml, renderBlocks, type EmailBlock } from '$lib/utils/emailBlocks';

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
		| 'Companies'
		| 'Incubation applications'
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
	// substituted — and run to a fixed point so nested blocks resolve.
	const block = /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/;
	let out = source;
	for (let pass = 0; pass < 10 && block.test(out); pass += 1) {
		out = out.replace(block, (_match, name: string, yes: string, no = '') =>
			truthy(variables[name]) ? yes : no
		);
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
			.replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(
				/&(copy|reg|hellip|mdash|ndash|lsquo|rsquo|ldquo|rdquo|lbrace|rbrace);/g,
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

// The shared chrome. Every other template renders into `{{{content}}}`, so the
// header, the footer and the table scaffolding email clients still need are
// written once. Inline styles throughout — Gmail strips <style> blocks.
const LAYOUT_BODY = `<!doctype html>
<html lang="en">
	<body style="margin:0;padding:0;background:#f6f7f9;">
		<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{preheader}}</div>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8ec;border-radius:12px;overflow:hidden;">
						<tr>
							<td style="padding:24px 32px;border-bottom:1px solid #eef0f3;">
								<a href="{{siteUrl}}" style="font:700 18px Georgia,'Times New Roman',serif;color:#111111;text-decoration:none;letter-spacing:-0.01em;">{{siteName}}</a>
							</td>
						</tr>
						<tr>
							<td style="padding:32px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333333;">
								{{{content}}}
							</td>
						</tr>
						<tr>
							<td style="padding:20px 32px;background:#fafbfc;border-top:1px solid #eef0f3;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#888888;">
								<p style="margin:0;">Technology Incubation Centre, IIT Guwahati, Assam 781039</p>
								<p style="margin:6px 0 0;">You are receiving this because you contacted or applied to {{siteName}}. &copy; {{year}}</p>
								{{#if unsubscribeUrl}}<p style="margin:10px 0 0;"><a href="{{unsubscribeUrl}}" style="color:#888888;text-decoration:underline;">Unsubscribe from the newsletter</a></p>{{/if}}
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

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
	{
		key: EMAIL_LAYOUT_KEY,
		name: 'Shared layout',
		description:
			'Header, footer and table scaffolding wrapped around every other template. Edit it to change the branding on all mail at once.',
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
			{ type: 'heading', text: 'News from {{siteName}}' },
			{ type: 'text', text: 'Write your update here.' }
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
			{ type: 'heading', text: 'Hello' },
			{ type: 'text', text: 'Your message here.' }
		])
	},

	// --- companies ----------------------------------------------------------
	{
		key: 'company-signup',
		name: 'Company signup received',
		description: 'Confirms a job-portal signup and sets the expectation that TIC verifies it.',
		trigger: 'A company creates an account at /opportunities/job-posting-admin/signup',
		group: 'Companies',
		variables: [
			{ name: 'companyName', description: 'Company name', sample: 'Northeast Robotics' },
			{ name: 'contactName', description: 'Contact person', sample: 'Ananya Sharma' },
			{ name: 'email', description: 'Account email', sample: 'hiring@northeastrobotics.in' }
		],
		subject: 'We have your {{siteName}} hiring account request',
		...fromBlocks([
			{ type: 'heading', text: 'Thanks, {{contactName}}', showIf: 'contactName' },
			{ type: 'heading', text: 'Thanks for signing up', hideIf: 'contactName' },
			{
				type: 'text',
				text: 'We have created a hiring account for *{{companyName}}* and it is now with the TIC team for verification.'
			},
			{
				type: 'text',
				text: 'Verification is a manual check that you are who you say you are — it usually takes a working day or two. You will get another email the moment it is decided, and you can post roles as soon as it clears.'
			},
			{
				type: 'button',
				label: 'Open your dashboard',
				href: '{{siteUrl}}/opportunities/job-posting-admin'
			},
			{
				type: 'note',
				text: 'Signed up as {{email}}. If this was not you, ignore this message and the account will stay unverified.'
			}
		])
	},
	{
		key: 'company-verified',
		name: 'Company verified',
		description: 'Tells a company its account is live and it can post roles.',
		trigger: 'An admin sets a company to Verified in Companies',
		group: 'Companies',
		variables: [
			{ name: 'companyName', description: 'Company name', sample: 'Northeast Robotics' },
			{ name: 'contactName', description: 'Contact person', sample: 'Ananya Sharma' }
		],
		subject: '{{companyName}} is verified — you can post roles now',
		...fromBlocks([
			{ type: 'heading', text: 'You are verified' },
			{
				type: 'callout',
				tone: 'good',
				text: '*{{companyName}}* has been verified by the TIC team.'
			},
			{
				type: 'text',
				text: 'Roles you post now appear on the public Opportunities board straight away, and applications come to you through the dashboard.'
			},
			{ type: 'button', label: 'Post a role', href: '{{siteUrl}}/opportunities/job-posting-admin' },
			{
				type: 'note',
				text: 'Keep the role description and the closing date current — stale posts are the main reason applicants drop off.'
			}
		])
	},
	{
		key: 'company-rejected',
		name: 'Company not verified',
		description: 'Declines a hiring account, with the reason the admin gave.',
		trigger: 'An admin sets a company to Rejected in Companies',
		group: 'Companies',
		variables: [
			{ name: 'companyName', description: 'Company name', sample: 'Northeast Robotics' },
			{ name: 'contactName', description: 'Contact person', sample: 'Ananya Sharma' },
			{
				name: 'reason',
				description: 'Rejection reason — the block is dropped if empty',
				sample: 'We could not match the website to a registered entity.'
			}
		],
		subject: 'About your {{siteName}} hiring account',
		...fromBlocks([
			{ type: 'heading', text: 'We could not verify {{companyName}}' },
			{
				type: 'text',
				text: 'Thanks for your interest in hiring through {{siteName}}. We were not able to verify the account this time.'
			},
			{ type: 'callout', tone: 'bad', label: 'Reason', text: '{{reason}}', showIf: 'reason' },
			{
				type: 'text',
				text: 'If you think this is a mistake, or you can send us something that settles it, reply to this email and we will look again.'
			}
		])
	},

	// --- incubation applications --------------------------------------------
	{
		key: 'application-under-review',
		name: 'Application under review',
		description: 'Lets a founder know their incubation application has been picked up.',
		trigger: 'An admin moves an application to Under review',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'Your {{siteName}} application is under review',
		...fromBlocks([
			{ type: 'heading', text: 'We are reading it now' },
			{
				type: 'text',
				text: 'Hi {{fullName}}, your application for *{{startupName}}* has moved to review.'
			},
			{
				type: 'text',
				text: 'The committee looks at the problem, the team and how far you have already got. We will come back to you with a decision, and we may ask for a short call before then.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'From the reviewer',
				text: '{{note}}',
				showIf: 'note'
			},
			{ type: 'button', label: 'View your application', href: '{{siteUrl}}/application' }
		])
	},
	{
		key: 'application-accepted',
		name: 'Application accepted',
		description: 'The offer of a place, with the next step spelled out.',
		trigger: 'An admin moves an application to Accepted',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'Congratulations — {{startupName}} is in',
		...fromBlocks([
			{ type: 'heading', text: 'Welcome to {{siteName}}' },
			{
				type: 'callout',
				tone: 'good',
				text: '*{{startupName}}* has been accepted into the incubation programme.'
			},
			{
				type: 'text',
				text: 'Hi {{fullName}} — the committee has approved your application. Someone from the team will be in touch within a few days about onboarding, workspace and the support you can draw on.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'From the reviewer',
				text: '{{note}}',
				showIf: 'note'
			},
			{ type: 'button', label: 'See what happens next', href: '{{siteUrl}}/about/what-happens' }
		])
	},
	{
		key: 'application-rejected',
		name: 'Application declined',
		description: 'Declines an incubation application without closing the door.',
		trigger: 'An admin moves an application to Rejected',
		group: 'Incubation applications',
		variables: [
			{ name: 'fullName', description: 'Applicant name', sample: 'Rahul Bora' },
			{ name: 'startupName', description: 'Startup name', sample: 'Brahmaputra Bio' },
			{ name: 'note', description: 'Reviewer note — dropped if empty', sample: '' }
		],
		subject: 'Your {{siteName}} application',
		...fromBlocks([
			{ type: 'heading', text: 'Not this time' },
			{
				type: 'text',
				text: 'Hi {{fullName}}, thank you for applying with *{{startupName}}*. We are not taking it forward in this cycle.'
			},
			{
				type: 'callout',
				tone: 'bad',
				label: 'From the reviewer',
				text: '{{note}}',
				showIf: 'note'
			},
			{
				type: 'text',
				text: 'This is a decision about fit and timing, not about whether the idea is worth building. Applications reopen each cycle and we would genuinely like to see where you have taken it.'
			}
		])
	},

	// --- role applicants ----------------------------------------------------
	{
		key: 'job-application-received',
		name: 'Role application received',
		description: 'Receipt for someone who has applied to a role on the Opportunities board.',
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
			{ type: 'heading', text: 'Got it, {{fullName}}' },
			{
				type: 'text',
				text: 'Your application for *{{role}}* at *{{company}}* is in, resume and all.'
			},
			{
				type: 'text',
				text: 'The TIC team screens applications before passing them to the company, so give it a few days. We will email you when the status changes — you do not need to follow up.'
			},
			{ type: 'button', label: 'View the role', href: '{{jobUrl}}' }
		])
	},
	{
		key: 'job-applicant-shortlisted',
		name: 'Applicant shortlisted',
		description: 'Tells an applicant they have made the shortlist.',
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
			{ type: 'heading', text: 'You are on the shortlist' },
			{
				type: 'callout',
				tone: 'good',
				text: 'Shortlisted for *{{role}}* at *{{company}}*.'
			},
			{
				type: 'text',
				text: 'Hi {{fullName}} — your application stood out and it is going to {{company}} for the next round. Expect to hear from them directly about a conversation.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'Note from the team',
				text: '{{note}}',
				showIf: 'note'
			}
		])
	},
	{
		key: 'job-applicant-forwarded',
		name: 'Application sent to the company',
		description: 'Confirms an application has been passed on to the hiring company.',
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
			{ type: 'heading', text: 'Passed on to {{company}}' },
			{
				type: 'text',
				text: 'Hi {{fullName}}, we have sent your application for *{{role}}* to {{company}}, together with your resume.'
			},
			{
				type: 'text',
				text: 'They take it from here, so any interview or follow-up will come from them rather than from us.'
			},
			{
				type: 'callout',
				tone: 'info',
				label: 'Note from the team',
				text: '{{note}}',
				showIf: 'note'
			}
		])
	},
	{
		key: 'job-applicant-rejected',
		name: 'Applicant not taken forward',
		description: 'Closes the loop with an applicant who did not get through.',
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
			{ type: 'heading', text: 'Not moving forward this time' },
			{
				type: 'text',
				text: 'Hi {{fullName}}, thank you for applying for *{{role}}* at *{{company}}*. On this occasion they are going ahead with other candidates.'
			},
			{
				type: 'callout',
				tone: 'bad',
				label: 'Note from the team',
				text: '{{note}}',
				showIf: 'note'
			},
			{
				type: 'text',
				text: 'New roles at our startups go up regularly, and applying again is welcome.'
			},
			{ type: 'button', label: 'See open roles', href: '{{siteUrl}}/opportunities' }
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
	return out;
}
