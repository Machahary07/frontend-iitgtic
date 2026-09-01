import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import {
	COMMON_VARIABLES,
	EMAIL_LAYOUT_KEY,
	EMAIL_TEMPLATES,
	htmlToText,
	renderTemplate,
	templateDef,
	type EmailTemplateDef
} from '$lib/utils/emailTemplates';
import { attachmentsFor, type EmailBlock } from '$lib/utils/emailBlocks';
import {
	allowance,
	dayStart,
	monthStart,
	nextDayStart,
	nextMonthStart,
	resolvePlan,
	type Allowance,
	type Plan
} from '$lib/utils/emailPlan';

// Outbound mail. One entry point — sendTemplateEmail() — which resolves the
// template, renders it inside the shared layout, checks the plan allowance,
// hands the message to Resend and writes a row to public.email_log either way.
//
// It never throws. A signup or an application submit must not fail because mail
// is down, so every failure comes back as a logged result the caller can ignore.
//
// Resend is called over its REST API with fetch rather than through the `resend`
// package: one POST, no dependency, and it works unchanged on the edge.

// $env/dynamic/private, not static: these are optional. With static, a build on
// a host that has not set RESEND_API_KEY yet would fail rather than degrade to
// "email not configured", which is the state the console is built to show.
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'IIT Guwahati TIC <onboarding@resend.dev>';

export type EmailConfig = {
	configured: boolean;
	from: string;
	replyTo: string;
	siteUrl: string;
	siteName: string;
	plan: Plan;
	monthlyLimit: number | null;
	dailyLimit: number | null;
	// True while the sandbox sender is in use — Resend only delivers those to the
	// address that owns the API key, which is the first thing to check when a
	// test lands but a real message does not.
	usingTestSender: boolean;
};

export function emailConfig(): EmailConfig {
	const plan = resolvePlan(env.RESEND_PLAN);
	const from = env.RESEND_FROM?.trim() || DEFAULT_FROM;
	const monthlyOverride = Number(env.RESEND_MONTHLY_LIMIT);
	const dailyOverride = Number(env.RESEND_DAILY_LIMIT);

	return {
		configured: Boolean(env.RESEND_API_KEY?.trim()),
		from,
		replyTo: env.RESEND_REPLY_TO?.trim() || '',
		// PUBLIC_-prefixed, so it comes from the public env module — links inside an
		// email have no request to infer an origin from.
		siteUrl: (publicEnv.PUBLIC_SITE_URL?.trim() || 'https://iitgtic.in').replace(/\/$/, ''),
		siteName: env.EMAIL_SITE_NAME?.trim() || 'IIT Guwahati TIC',
		plan,
		monthlyLimit:
			Number.isFinite(monthlyOverride) && monthlyOverride > 0 ? monthlyOverride : plan.monthly,
		dailyLimit: Number.isFinite(dailyOverride) && dailyOverride > 0 ? dailyOverride : plan.daily,
		usingTestSender: from.includes('resend.dev')
	};
}

// --- templates --------------------------------------------------------------

export type ResolvedTemplate = Omit<EmailTemplateDef, 'blocks'> & {
	// True when a row in email_templates is overriding the bundled copy.
	customised: boolean;
	enabled: boolean;
	updatedAt: string | null;
	// null means the body was written as HTML rather than composed from blocks,
	// which is what puts the editor in its HTML tab.
	blocks: EmailBlock[] | null;
};

type TemplateRow = {
	key: string;
	subject: string;
	body: string;
	blocks: EmailBlock[] | null;
	enabled: boolean;
	updated_at: string;
};

// Sends read the same two rows every time, so they are cached in-process the way
// site content is. Saving from the console clears it, so an edit is live on the
// next send rather than after the TTL.
const TTL_MS = 60_000;
let cache: Map<string, TemplateRow> | null = null;
let cachedAt = 0;

export function invalidateEmailTemplates(): void {
	cache = null;
	cachedAt = 0;
}

async function overrides(): Promise<Map<string, TemplateRow>> {
	if (cache && Date.now() - cachedAt < TTL_MS) return cache;

	const { data, error } = await supabaseAdmin
		.from('email_templates')
		.select('key, subject, body, blocks, enabled, updated_at');

	// A database problem must not stop mail going out — the bundled copy is a
	// complete template on its own.
	const map = new Map<string, TemplateRow>();
	if (!error && data) for (const row of data as TemplateRow[]) map.set(row.key, row);

	cache = map;
	cachedAt = Date.now();
	return map;
}

function merge(def: EmailTemplateDef, row: TemplateRow | undefined): ResolvedTemplate {
	return {
		...def,
		subject: row?.subject ?? def.subject,
		body: row?.body ?? def.body,
		// An override replaces the bundled blocks outright rather than merging with
		// them: a row saved from the HTML tab carries none, and falling back to the
		// bundled list there would show the editor a composition its body no longer
		// matches.
		blocks: row ? (row.blocks ?? null) : (def.blocks ?? null),
		customised: Boolean(row),
		enabled: row ? row.enabled : true,
		updatedAt: row?.updated_at ?? null
	};
}

export async function resolveTemplate(key: string): Promise<ResolvedTemplate | null> {
	const def = templateDef(key);
	if (!def) return null;
	return merge(def, (await overrides()).get(key));
}

export async function resolveAllTemplates(): Promise<ResolvedTemplate[]> {
	const rows = await overrides();
	return EMAIL_TEMPLATES.map((def) => merge(def, rows.get(def.key)));
}

// --- rendering --------------------------------------------------------------

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Renders a template and wraps it in the layout. Exported so the console can
 * preview exactly what a send would produce without sending anything.
 */
export function renderEmail(
	template: Pick<EmailTemplateDef, 'subject' | 'body'>,
	layout: Pick<EmailTemplateDef, 'body'>,
	variables: Record<string, string>
): RenderedEmail {
	const subject = renderTemplate(template.subject, variables).trim();
	const content = renderTemplate(template.body, variables);

	// The preheader is the grey line the inbox shows next to the subject. Taking
	// it from the body's own first sentence beats leaving it to pick up whatever
	// markup comes first.
	const preheader = variables.preheader ?? htmlToText(content).split('\n')[0]?.slice(0, 140) ?? '';

	const html = renderTemplate(layout.body, { ...variables, content, subject, preheader });
	return { subject, html, text: htmlToText(html) };
}

function commonVariables(config: EmailConfig): Record<string, string> {
	return {
		siteName: config.siteName,
		siteUrl: config.siteUrl,
		year: String(new Date().getUTCFullYear())
	};
}

// Every default sample is filled in so an unpassed variable renders as its
// placeholder text rather than as a blank in someone's inbox.
export function defaultVariables(config: EmailConfig): Record<string, string> {
	const out = commonVariables(config);
	for (const v of COMMON_VARIABLES) if (!(v.name in out)) out[v.name] = v.sample;
	return out;
}

// --- usage ------------------------------------------------------------------

export type EmailUsage = {
	month: Allowance;
	day: Allowance;
	totals: { sent: number; failed: number; blocked: number };
};

async function countSent(since: Date): Promise<number> {
	const { count } = await supabaseAdmin
		.from('email_log')
		.select('id', { count: 'exact', head: true })
		.eq('status', 'sent')
		.gte('created_at', since.toISOString());
	return count ?? 0;
}

async function countByStatus(status: string): Promise<number> {
	const { count } = await supabaseAdmin
		.from('email_log')
		.select('id', { count: 'exact', head: true })
		.eq('status', status);
	return count ?? 0;
}

// The send path only needs the two window counts, not the all-time totals, so
// it takes this rather than emailUsage() — five count queries per message would
// cost more than the send.
export async function remainingAllowance(
	config = emailConfig()
): Promise<{ month: Allowance; day: Allowance }> {
	const now = new Date();
	const [inMonth, inDay] = await Promise.all([
		countSent(monthStart(now)),
		countSent(dayStart(now))
	]);
	return {
		month: allowance('This month', inMonth, config.monthlyLimit, nextMonthStart(now)),
		day: allowance('Today', inDay, config.dailyLimit, nextDayStart(now))
	};
}

export async function emailUsage(config = emailConfig()): Promise<EmailUsage> {
	const now = new Date();
	const [inMonth, inDay, sent, failed, blocked] = await Promise.all([
		countSent(monthStart(now)),
		countSent(dayStart(now)),
		countByStatus('sent'),
		countByStatus('failed'),
		countByStatus('blocked')
	]);

	return {
		month: allowance('This month', inMonth, config.monthlyLimit, nextMonthStart(now)),
		day: allowance('Today', inDay, config.dailyLimit, nextDayStart(now)),
		totals: { sent, failed, blocked }
	};
}

// --- suppression ------------------------------------------------------------

export type Suppression = {
	email: string;
	reason: string;
	detail: string | null;
	createdAt: string;
};

/**
 * Whether this address has hard-bounced or reported us as spam. Recorded by
 * /api/resend-webhook; checked here so a suppressed address is refused before
 * the send rather than counted against the plan and rejected by the provider.
 *
 * A lookup that fails returns null — a database problem must not stop mail.
 */
export async function findSuppression(email: string): Promise<Suppression | null> {
	const address = email.trim().toLowerCase();
	if (!address) return null;

	const { data, error } = await supabaseAdmin
		.from('email_suppressions')
		.select('email, reason, detail, created_at')
		.eq('email', address)
		.maybeSingle();

	if (error || !data) return null;
	return {
		email: data.email as string,
		reason: data.reason as string,
		detail: (data.detail as string | null) ?? null,
		createdAt: data.created_at as string
	};
}

export async function listSuppressions(limit = 200): Promise<Suppression[]> {
	const { data } = await supabaseAdmin
		.from('email_suppressions')
		.select('email, reason, detail, created_at')
		.order('created_at', { ascending: false })
		.limit(limit);

	return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
		email: row.email as string,
		reason: row.reason as string,
		detail: (row.detail as string | null) ?? null,
		createdAt: row.created_at as string
	}));
}

// --- sending ----------------------------------------------------------------

export type SendResult = {
	ok: boolean;
	status: 'sent' | 'failed' | 'blocked';
	id: string | null;
	error: string | null;
};

export type SendOptions = {
	templateKey: string;
	to: string;
	toName?: string;
	variables?: Record<string, string>;
	// Copied into email_log.context so a logged message can be traced back to the
	// application or company it was about.
	context?: Record<string, unknown>;
	sentBy?: string | null;
	isTest?: boolean;
	// Test sends deliberately ignore the template's enabled switch — the point of
	// a test is to see a template that is not live yet.
	ignoreEnabled?: boolean;
};

async function logEmail(fields: {
	templateKey: string;
	to: string;
	toName: string;
	subject: string;
	body: string;
	status: SendResult['status'];
	providerId: string | null;
	error: string | null;
	isTest: boolean;
	context: Record<string, unknown>;
	sentBy: string | null;
}): Promise<void> {
	const { error } = await supabaseAdmin.from('email_log').insert({
		template_key: fields.templateKey,
		to_email: fields.to,
		to_name: fields.toName,
		subject: fields.subject,
		body: fields.body,
		status: fields.status,
		provider_id: fields.providerId,
		error: fields.error,
		is_test: fields.isTest,
		context: fields.context,
		sent_by: fields.sentBy
	});
	if (error) console.error('[email] could not write log row:', error.message);
}

async function postToResend(
	apiKey: string,
	payload: Record<string, unknown>
): Promise<{ id: string | null; error: string | null }> {
	try {
		const res = await fetch(RESEND_ENDPOINT, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		const data = (await res.json().catch(() => ({}))) as {
			id?: string;
			message?: string;
			name?: string;
		};

		if (!res.ok) {
			return { id: null, error: data.message || `Resend returned ${res.status}.` };
		}
		return { id: data.id ?? null, error: null };
	} catch (err) {
		return { id: null, error: err instanceof Error ? err.message : String(err) };
	}
}

/**
 * Renders and sends one template. Always resolves — check `result.ok` if the
 * caller cares, ignore it if the send is a courtesy.
 */
export async function sendTemplateEmail(options: SendOptions): Promise<SendResult> {
	const config = emailConfig();
	const context = options.context ?? {};
	const toName = options.toName ?? '';
	const isTest = options.isTest ?? false;

	const blocked = async (reason: string, subject = '', body = ''): Promise<SendResult> => {
		await logEmail({
			templateKey: options.templateKey,
			to: options.to,
			toName,
			subject,
			body,
			status: 'blocked',
			providerId: null,
			error: reason,
			isTest,
			context,
			sentBy: options.sentBy ?? null
		});
		return { ok: false, status: 'blocked', id: null, error: reason };
	};

	if (!options.to?.trim()) {
		// Logged like every other block: a caller that passed no address is a bug
		// worth seeing in the console, not something to swallow.
		return blocked('No recipient address.');
	}

	const [template, layout] = await Promise.all([
		resolveTemplate(options.templateKey),
		resolveTemplate(EMAIL_LAYOUT_KEY)
	]);
	if (!template || !layout) return blocked(`Unknown template "${options.templateKey}".`);
	if (!template.enabled && !options.ignoreEnabled) {
		return blocked('This template is switched off in the console.');
	}

	const { subject, html, text } = renderEmail(template, layout, {
		...defaultVariables(config),
		...(options.variables ?? {})
	});

	if (!config.configured) {
		return blocked('RESEND_API_KEY is not set, so nothing was sent.', subject, html);
	}

	// Mailing an address that hard-bounced or filed a spam complaint is what gets
	// a sending domain blocked. A test send from the console is allowed through:
	// checking whether an address now accepts mail again is a reason to send one.
	if (!isTest) {
		const suppressed = await findSuppression(options.to);
		if (suppressed) {
			return blocked(
				`Address suppressed (${suppressed.reason}): ${suppressed.detail ?? 'no detail'}.`,
				subject,
				html
			);
		}
	}

	// Checked before the API call so a message that would bounce off the plan
	// limit is recorded as blocked here rather than as a 429 from Resend.
	const quota = await remainingAllowance(config);
	if (quota.month.remaining === 0) {
		return blocked(`Monthly allowance spent (${quota.month.limit}).`, subject, html);
	}
	if (quota.day.remaining === 0) {
		return blocked(`Daily allowance spent (${quota.day.limit}).`, subject, html);
	}

	// A file block can ask to be delivered as a real attachment as well as a
	// download link. Resend fetches each `path` itself at send time, which is why
	// the asset bucket has to be publicly readable.
	const attachments = template.blocks ? attachmentsFor(template.blocks) : [];

	const { id, error } = await postToResend(env.RESEND_API_KEY!.trim(), {
		from: config.from,
		to: [options.to],
		subject,
		html,
		text,
		...(config.replyTo ? { reply_to: config.replyTo } : {}),
		...(attachments.length > 0 ? { attachments } : {}),
		...(isTest ? { tags: [{ name: 'kind', value: 'test' }] } : {})
	});

	await logEmail({
		templateKey: options.templateKey,
		to: options.to,
		toName,
		subject,
		body: html,
		status: error ? 'failed' : 'sent',
		providerId: id,
		error,
		isTest,
		context,
		sentBy: options.sentBy ?? null
	});

	if (error) console.error(`[email] ${options.templateKey} to ${options.to} failed:`, error);
	return { ok: !error, status: error ? 'failed' : 'sent', id, error };
}
