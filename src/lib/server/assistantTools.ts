import type { SupabaseClient } from '@supabase/supabase-js';
import { getSection, getSiteContent, invalidateSiteContent } from '$lib/server/siteContent';
import { logAdminAction, type AdminContext } from '$lib/server/adminGuard';
import { CONTENT_SECTIONS, readPath, writePath } from '$lib/content';
import { EMAIL_TEMPLATES } from '$lib/utils/emailTemplates';
import fallback from '$lib/data/content.json';

// What the assistant is allowed to do.
//
// Almost every tool here is a read. The two exceptions — update_site_section and
// reset_site_section — let the model edit the public website's copy, the same
// change an admin makes on the Content screen. Everything else stays read-only:
// the model cannot verify a company, change a status or send a mail — those stay
// behind the existing /api/tic-admin/* routes where they are attributed and
// audited. A content write takes the same site_content path those routes use, so
// it is audited before/after and reversible from Activity too.
//
// The client passed in is the guard's service-role client, so these queries see
// past RLS. That is the whole point — most of these tables have RLS on with no
// policies and are invisible any other way — but it also means the tool list is
// the security boundary, so nothing here takes a raw table name or a raw filter
// from the model, and the write tools accept only a known section key.

/** What a write tool would change, shown to the admin before it is applied. */
export type ToolPreview = { summary: string; before: unknown; after: unknown } | { error: string };

export type ToolDef = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	/** Short present-tense label shown in the transcript while it runs. */
	label: (args: Record<string, unknown>) => string;
	// ctx is the acting admin, needed by the write tools to stamp updated_by and
	// log the action. Read tools ignore it and use only db.
	run: (
		db: SupabaseClient,
		args: Record<string, unknown>,
		ctx: AdminContext
	) => Promise<unknown>;
	/** True for tools that change data. In manual-approval mode these are not run
	 *  in the loop — they are previewed and applied only once the admin approves. */
	write?: boolean;
	/** Computes the before/after for the approval card without changing anything. */
	preview?: (db: SupabaseClient, args: Record<string, unknown>) => Promise<ToolPreview>;
};

// Rows are fed back to the model as JSON, so a runaway limit costs context
// rather than time. Everything is clamped.
const MAX_ROWS = 200;

function limitOf(args: Record<string, unknown>, fallback = 25): number {
	const raw = Number(args.limit);
	if (!Number.isFinite(raw) || raw <= 0) return fallback;
	return Math.min(Math.trunc(raw), MAX_ROWS);
}

function textOf(args: Record<string, unknown>, key: string): string {
	const value = args[key];
	return typeof value === 'string' ? value.trim() : '';
}

// Long-form columns are summarised rather than sent whole: a job description or
// an email body would otherwise crowd out the rest of the answer.
function clip(value: unknown, max = 400): unknown {
	if (typeof value !== 'string') return value;
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

function clipRows<T extends Record<string, unknown>>(rows: T[], fields: string[], max = 400): T[] {
	return rows.map((row) => {
		const copy = { ...row };
		for (const field of fields) {
			if (field in copy) (copy as Record<string, unknown>)[field] = clip(copy[field], max);
		}
		return copy;
	});
}

// Postgres treats a comma as the separator between .or() branches, so a search
// term containing one would silently become two filters.
function searchTerm(value: string): string {
	return value.replace(/[,()]/g, ' ').trim();
}

async function countOf(db: SupabaseClient, table: string, column = 'id'): Promise<number> {
	const { count } = await db.from(table).select(column, { count: 'exact', head: true });
	return count ?? 0;
}

async function countWhere(
	db: SupabaseClient,
	table: string,
	column: string,
	value: string
): Promise<number> {
	const { count } = await db
		.from(table)
		.select('id', { count: 'exact', head: true })
		.eq(column, value);
	return count ?? 0;
}

export const ASSISTANT_TOOLS: ToolDef[] = [
	{
		name: 'console_overview',
		description:
			'Counts across the whole console in one call: companies by status, incubation applications by status, posted jobs, role applicants, user accounts by role, newsletter subscribers and emails sent. Start here for any "how are we doing", "what is the state of X" or summary question.',
		parameters: { type: 'object', properties: {} },
		label: () => 'Counting everything in the console',
		run: async (db) => {
			const [
				companies,
				companiesPending,
				companiesVerified,
				companiesRejected,
				applications,
				applicationsSubmitted,
				applicationsUnderReview,
				applicationsAccepted,
				applicationsRejected,
				jobs,
				jobApplicants,
				profiles,
				admins,
				founders,
				companyUsers,
				subscribers,
				emails
			] = await Promise.all([
				countOf(db, 'companies'),
				countWhere(db, 'companies', 'status', 'pending'),
				countWhere(db, 'companies', 'status', 'verified'),
				countWhere(db, 'companies', 'status', 'rejected'),
				countOf(db, 'applications'),
				countWhere(db, 'applications', 'status', 'submitted'),
				countWhere(db, 'applications', 'status', 'under-review'),
				countWhere(db, 'applications', 'status', 'accepted'),
				countWhere(db, 'applications', 'status', 'rejected'),
				countOf(db, 'jobs'),
				countOf(db, 'job_applications'),
				countOf(db, 'profiles'),
				countWhere(db, 'profiles', 'role', 'admin'),
				countWhere(db, 'profiles', 'role', 'founder'),
				countWhere(db, 'profiles', 'role', 'company'),
				countOf(db, 'newsletter_subscribers'),
				countOf(db, 'email_log')
			]);

			return {
				companies: {
					total: companies,
					pending: companiesPending,
					verified: companiesVerified,
					rejected: companiesRejected
				},
				incubation_applications: {
					total: applications,
					submitted: applicationsSubmitted,
					under_review: applicationsUnderReview,
					accepted: applicationsAccepted,
					rejected: applicationsRejected
				},
				posted_jobs: jobs,
				role_applicants: jobApplicants,
				users: { total: profiles, admin: admins, founder: founders, company: companyUsers },
				newsletter_subscribers: subscribers,
				emails_logged: emails
			};
		}
	},

	{
		name: 'list_companies',
		description:
			'Company accounts that registered to post roles. Each has a status of pending, verified or rejected — only verified companies can post. Filter by status, or search by company name, contact name or email.',
		parameters: {
			type: 'object',
			properties: {
				status: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
				search: { type: 'string', description: 'Matches company name, contact name or email.' },
				limit: { type: 'integer', description: 'Default 25, maximum 200.' }
			}
		},
		label: (args) =>
			args.status ? `Reading ${String(args.status)} companies` : 'Reading company accounts',
		run: async (db, args) => {
			let query = db
				.from('companies')
				.select(
					'id, company_name, company_slug, email, contact_name, website, status, rejection_reason, created_at'
				)
				.order('created_at', { ascending: false })
				.limit(limitOf(args));

			const status = textOf(args, 'status');
			if (status) query = query.eq('status', status);

			const search = searchTerm(textOf(args, 'search'));
			if (search) {
				query = query.or(
					`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`
				);
			}

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { companies: data ?? [] };
		}
	},

	{
		name: 'list_incubation_applications',
		description:
			'Applications from founders asking to be incubated — the "Applications" section of the console. Status is submitted, under-review, accepted or rejected. Use this for questions about who applied to the incubator and which ones are still waiting on a decision.',
		parameters: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['submitted', 'under-review', 'accepted', 'rejected']
				},
				search: { type: 'string', description: 'Matches applicant name, email or startup name.' },
				limit: { type: 'integer', description: 'Default 25, maximum 200.' }
			}
		},
		label: (args) =>
			args.status
				? `Reading ${String(args.status)} applications`
				: 'Reading incubation applications',
		run: async (db, args) => {
			let query = db
				.from('applications')
				.select(
					'id, status, full_name, email, startup_name, review_note, reviewed_at, created_at, updated_at'
				)
				.order('created_at', { ascending: false })
				.limit(limitOf(args));

			const status = textOf(args, 'status');
			if (status) query = query.eq('status', status);

			const search = searchTerm(textOf(args, 'search'));
			if (search) {
				query = query.or(
					`full_name.ilike.%${search}%,email.ilike.%${search}%,startup_name.ilike.%${search}%`
				);
			}

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { applications: data ?? [] };
		}
	},

	{
		name: 'get_incubation_application',
		description:
			'One incubation application in full, including the answers the founder gave and which supporting documents they uploaded. Use it after list_incubation_applications when asked about a specific applicant.',
		parameters: {
			type: 'object',
			properties: { id: { type: 'string', description: 'The application id (a UUID).' } },
			required: ['id']
		},
		label: () => 'Opening an application',
		run: async (db, args) => {
			const id = textOf(args, 'id');
			if (!id) return { error: 'An application id is required.' };

			const { data, error } = await db
				.from('applications')
				.select(
					'id, status, full_name, email, startup_name, answers, documents, review_note, reviewed_at, created_at, updated_at'
				)
				.eq('id', id)
				.maybeSingle();

			if (error) return { error: error.message };
			if (!data) return { error: 'No application with that id.' };

			// The document map holds storage paths, which are of no use to the model
			// and are a needless thing to hand a third party. Names are enough.
			return { ...data, documents: Object.keys(data.documents ?? {}) };
		}
	},

	{
		name: 'list_jobs',
		description:
			'Roles posted by companies and shown on the public opportunities page. Search matches the role title, company name, location or sector.',
		parameters: {
			type: 'object',
			properties: {
				search: { type: 'string' },
				limit: { type: 'integer', description: 'Default 25, maximum 200.' }
			}
		},
		label: () => 'Reading posted jobs',
		run: async (db, args) => {
			let query = db
				.from('jobs')
				.select(
					'id, slug, role, company, company_slug, location, type, sector, posted, description, created_at'
				)
				.order('posted', { ascending: false })
				.limit(limitOf(args));

			const search = searchTerm(textOf(args, 'search'));
			if (search) {
				query = query.or(
					`role.ilike.%${search}%,company.ilike.%${search}%,location.ilike.%${search}%,sector.ilike.%${search}%`
				);
			}

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { jobs: clipRows(data ?? [], ['description'], 300) };
		}
	},

	{
		name: 'list_role_applicants',
		description:
			'People who applied to a posted job — the "Role applicants" section. Distinct from incubation applications: these are job seekers, not founders. Status is new, shortlisted, forwarded (passed to the company) or rejected.',
		parameters: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['new', 'shortlisted', 'forwarded', 'rejected']
				},
				job_slug: { type: 'string', description: 'Restrict to one posted job, by its slug.' },
				search: {
					type: 'string',
					description: 'Matches applicant name, email or role applied for.'
				},
				limit: { type: 'integer', description: 'Default 25, maximum 200.' }
			}
		},
		label: () => 'Reading role applicants',
		run: async (db, args) => {
			let query = db
				.from('job_applications')
				.select(
					'id, job_slug, job_role, job_company, full_name, email, applicant_role, status, review_note, reviewed_at, created_at'
				)
				.order('created_at', { ascending: false })
				.limit(limitOf(args));

			const status = textOf(args, 'status');
			if (status) query = query.eq('status', status);

			const slug = textOf(args, 'job_slug');
			if (slug) query = query.eq('job_slug', slug);

			const search = searchTerm(textOf(args, 'search'));
			if (search) {
				query = query.or(
					`full_name.ilike.%${search}%,email.ilike.%${search}%,job_role.ilike.%${search}%`
				);
			}

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { applicants: data ?? [] };
		}
	},

	{
		name: 'list_users',
		description:
			'Account profiles. Role is founder, company or admin. Use it for questions about who has access to what.',
		parameters: {
			type: 'object',
			properties: {
				role: { type: 'string', enum: ['founder', 'company', 'admin'] },
				search: { type: 'string', description: 'Matches name or email.' },
				limit: { type: 'integer', description: 'Default 25, maximum 200.' }
			}
		},
		label: () => 'Reading user accounts',
		run: async (db, args) => {
			let query = db
				.from('profiles')
				.select('id, role, full_name, email, created_at')
				.order('created_at', { ascending: false })
				.limit(limitOf(args));

			const role = textOf(args, 'role');
			if (role) query = query.eq('role', role);

			const search = searchTerm(textOf(args, 'search'));
			if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { users: data ?? [] };
		}
	},

	{
		name: 'recent_activity',
		description:
			'The audit trail: who changed what and when, across every table. This is the only way to answer "what changed recently", "what happened this week" or "who edited X".',
		parameters: {
			type: 'object',
			properties: {
				table: {
					type: 'string',
					description:
						'Restrict to one table, e.g. companies, applications, jobs, job_applications, profiles, site_content, email_templates.'
				},
				days: { type: 'integer', description: 'Only entries from the last N days.' },
				limit: { type: 'integer', description: 'Default 40, maximum 200.' }
			}
		},
		label: (args) =>
			args.table ? `Reading activity on ${String(args.table)}` : 'Reading the activity log',
		run: async (db, args) => {
			let query = db
				.from('audit_log')
				.select('id, occurred_at, source, actor_label, action, table_name, record_id')
				.order('id', { ascending: false })
				.limit(limitOf(args, 40));

			const table = textOf(args, 'table');
			if (table) query = query.eq('table_name', table);

			const days = Number(args.days);
			if (Number.isFinite(days) && days > 0) {
				query = query.gte('occurred_at', new Date(Date.now() - days * 86400000).toISOString());
			}

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { entries: data ?? [] };
		}
	},

	{
		name: 'traffic_summary',
		description:
			'Page impressions for the public site: which paths were visited, how many visitors and when each was last seen. Use it for questions about traffic or which pages people actually read.',
		parameters: {
			type: 'object',
			properties: {
				days: { type: 'integer', description: 'Window in days. Omit for all time.' },
				limit: { type: 'integer', description: 'Top N paths. Default 25, maximum 200.' }
			}
		},
		label: () => 'Reading site traffic',
		run: async (db, args) => {
			const days = Number(args.days);
			const since =
				Number.isFinite(days) && days > 0
					? new Date(Date.now() - days * 86400000).toISOString()
					: null;

			const { data, error } = await db.rpc('page_impressions', { since });
			if (error) return { error: error.message };

			const rows = (data ?? []) as { total: number; is_admin: boolean }[];
			return {
				window: since ? `last ${Math.trunc(days)} days` : 'all time',
				// Admin's own page views are logged too; they are not audience.
				paths: rows.filter((row) => !row.is_admin).slice(0, limitOf(args))
			};
		}
	},

	{
		name: 'list_email_templates',
		description:
			'Every transactional email the site can send — its key, what triggers it, the subject line and whether it is switched on. Use this before get_email_template to find the right key.',
		parameters: { type: 'object', properties: {} },
		label: () => 'Reading the email templates',
		run: async (db) => {
			const { data } = await db.from('email_templates').select('key, subject, enabled, updated_at');
			const saved = new Map((data ?? []).map((row) => [row.key as string, row]));

			// The bundled definitions are the source of truth for what exists; the
			// table only holds the ones an admin has edited.
			return {
				templates: EMAIL_TEMPLATES.map((def) => {
					const row = saved.get(def.key);
					return {
						key: def.key,
						name: def.name,
						group: def.group,
						sent_when: def.trigger,
						subject: row?.subject ?? def.subject,
						enabled: row?.enabled ?? true,
						edited: Boolean(row),
						last_edited: row?.updated_at ?? null
					};
				})
			};
		}
	},

	{
		name: 'get_email_template',
		description:
			'The full body and subject of one email template, plus the variables it can interpolate. Use it when asked to review, explain or rewrite a specific email.',
		parameters: {
			type: 'object',
			properties: {
				key: { type: 'string', description: 'Template key from list_email_templates.' }
			},
			required: ['key']
		},
		label: (args) => `Reading the ${String(args.key ?? '')} email`,
		run: async (db, args) => {
			const key = textOf(args, 'key');
			const def = EMAIL_TEMPLATES.find((template) => template.key === key);
			if (!def) return { error: `No template with key "${key}". Call list_email_templates first.` };

			const { data } = await db
				.from('email_templates')
				.select('subject, body, enabled, updated_at')
				.eq('key', key)
				.maybeSingle();

			return {
				key: def.key,
				name: def.name,
				group: def.group,
				sent_when: def.trigger,
				purpose: def.description,
				subject: data?.subject ?? def.subject,
				body: data?.body ?? def.body,
				enabled: data?.enabled ?? true,
				variables: def.variables.map((variable) => `{{${variable.name}}}`)
			};
		}
	},

	{
		name: 'recent_emails',
		description:
			'The delivery log: which messages went out, to whom, and whether they were sent, blocked, bounced or failed. Use it for questions about whether someone was actually emailed.',
		parameters: {
			type: 'object',
			properties: {
				status: { type: 'string', description: 'e.g. sent, blocked, failed, bounced.' },
				limit: { type: 'integer', description: 'Default 25, maximum 200.' }
			}
		},
		label: () => 'Reading the email log',
		run: async (db, args) => {
			let query = db
				.from('email_log')
				.select('id, template_key, to_email, subject, status, error, is_test, created_at')
				.order('created_at', { ascending: false })
				.limit(limitOf(args));

			const status = textOf(args, 'status');
			if (status) query = query.eq('status', status);

			const { data, error } = await query;
			if (error) return { error: error.message };
			return { emails: data ?? [] };
		}
	},

	{
		name: 'newsletter_subscribers',
		description:
			'Who signed up to the newsletter from the footer, and how many have since unsubscribed.',
		parameters: {
			type: 'object',
			properties: { limit: { type: 'integer', description: 'Default 25, maximum 200.' } }
		},
		label: () => 'Reading newsletter sign-ups',
		run: async (db, args) => {
			const { data, error } = await db
				.from('newsletter_subscribers')
				.select('email, source, unsubscribed_at, created_at')
				.order('created_at', { ascending: false })
				.limit(limitOf(args));

			if (error) return { error: error.message };

			const rows = data ?? [];
			return {
				active: rows.filter((row) => !row.unsubscribed_at).length,
				unsubscribed: rows.filter((row) => row.unsubscribed_at).length,
				subscribers: rows
			};
		}
	},

	{
		name: 'list_site_sections',
		description:
			'The editable sections of the public website — every page and global block an admin can change from the Content screen, with the key each one is stored under. Use this to find a key for read_site_section.',
		parameters: { type: 'object', properties: {} },
		label: () => 'Listing the website sections',
		run: async () => ({ sections: CONTENT_SECTIONS })
	},

	{
		name: 'read_site_section',
		description:
			'The live copy currently published in one section of the public website — headings, body text, list items, team members, FAQs and so on. Use it to answer "what does the site say about X" or to rewrite existing copy.',
		parameters: {
			type: 'object',
			properties: {
				key: { type: 'string', description: 'A key from list_site_sections, e.g. pages.about.' }
			},
			required: ['key']
		},
		label: (args) => `Reading the ${String(args.key ?? '')} content`,
		run: async (_db, args) => {
			const key = textOf(args, 'key');
			if (!key) return { error: 'A section key is required.' };

			const content = await getSiteContent();
			const value = readPath(content, key);
			if (value === undefined) {
				return { error: `No section at "${key}". Call list_site_sections for valid keys.` };
			}

			// A whole page of copy can be very large; the model gets the section but
			// not an unbounded one.
			const json = JSON.stringify(value);
			if (json.length > 20000) {
				return {
					key,
					truncated: true,
					note: 'This section is too large to return whole. Ask again for a narrower key by appending one of the keys below, e.g. pages.about.hero.',
					available_keys: value && typeof value === 'object' ? Object.keys(value as object) : []
				};
			}

			return { key, value };
		}
	},

	{
		name: 'update_site_section',
		description:
			"Edit the live copy of the public website — the same change an admin makes on the Content screen, published immediately. Read_site_section first to see the section's shape. To change one field, pass its dotted path within the section and the new value for that field alone; this is the reliable way to edit and leaves everything else untouched. Omit path only to replace an entire (small) section. The edit is audited and can be reverted from Activity.",
		parameters: {
			type: 'object',
			properties: {
				key: {
					type: 'string',
					description: 'A section key from list_site_sections, e.g. pages.governingBody.'
				},
				path: {
					type: 'string',
					description:
						'Dotted path to the field within the section, e.g. hero.heading or members.2.bio (array items are indexed from 0). Omit to replace the whole section.'
				},
				value: {
					description:
						'The new value. With a path, the value for that one field (string, object or array). Without a path, the complete new section value.'
				},
				label: {
					type: 'string',
					description: 'Optional short note describing the edit, stored with the section.'
				}
			},
			required: ['key', 'value']
		},
		label: (args) => `Updating the ${String(args.key ?? '')} content`,
		write: true,
		preview: async (_db, args) => {
			const key = textOf(args, 'key');
			if (!key) return { error: 'A section key is required.' };
			if (!CONTENT_SECTIONS.some((section) => section.key === key)) {
				return { error: `"${key}" is not an editable section.` };
			}
			if (args.value === undefined) return { error: 'A new value is required.' };

			const path = textOf(args, 'path');
			const current = await getSection(key);
			return {
				summary: `Update ${key}${path ? ` · ${path}` : ''}`,
				before: path ? readPath(current, path) : current,
				after: args.value
			};
		},
		run: async (db, args, ctx) => {
			const key = textOf(args, 'key');
			if (!key) return { error: 'A section key is required.' };
			if (!CONTENT_SECTIONS.some((section) => section.key === key)) {
				return {
					error: `"${key}" is not an editable section. Call list_site_sections for valid keys.`
				};
			}
			if (args.value === undefined) return { error: 'A new value is required.' };

			const path = textOf(args, 'path');
			let value: unknown;
			if (path) {
				// Patch one field: start from the current section so everything else is
				// preserved and the model only sends the part that changed. Re-emitting
				// a whole section as JSON is what the token budget cannot reliably fit —
				// on a reasoning model the arguments get truncated mid-write.
				const current = await getSection(key);
				const draft = current && typeof current === 'object' ? structuredClone(current) : {};
				writePath(draft as Record<string, unknown>, path, args.value);
				value = draft;
			} else {
				value = args.value;
			}

			const { error } = await db.from('site_content').upsert(
				{
					key,
					value,
					label: textOf(args, 'label'),
					updated_by: ctx.admin.userId,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'key' }
			);
			if (error) return { error: error.message };

			// The public site reads through an in-process cache; without this the edit
			// would not show until the TTL lapsed.
			invalidateSiteContent();
			await logAdminAction(ctx, `edited site content · ${key}${path ? ` · ${path}` : ''}`, {
				table: 'site_content',
				recordId: key
			});

			return { ok: true, key, path: path || null };
		}
	},

	{
		name: 'reset_site_section',
		description:
			'Discard any saved edits to one section and restore the copy bundled with the site (its original default). Use this only when asked to undo changes or reset a section. Audited and shown in Activity.',
		parameters: {
			type: 'object',
			properties: {
				key: {
					type: 'string',
					description: 'A section key from list_site_sections, e.g. pages.about.'
				}
			},
			required: ['key']
		},
		label: (args) => `Resetting the ${String(args.key ?? '')} content`,
		write: true,
		preview: async (_db, args) => {
			const key = textOf(args, 'key');
			if (!key) return { error: 'A section key is required.' };
			if (!CONTENT_SECTIONS.some((section) => section.key === key)) {
				return { error: `"${key}" is not an editable section.` };
			}
			return {
				summary: `Reset ${key} to its bundled default`,
				before: await getSection(key),
				after: readPath(fallback, key)
			};
		},
		run: async (db, args, ctx) => {
			const key = textOf(args, 'key');
			if (!key) return { error: 'A section key is required.' };
			if (!CONTENT_SECTIONS.some((section) => section.key === key)) {
				return {
					error: `"${key}" is not an editable section. Call list_site_sections for valid keys.`
				};
			}

			const { error } = await db.from('site_content').delete().eq('key', key);
			if (error) return { error: error.message };

			invalidateSiteContent();
			await logAdminAction(ctx, `reset site content to the bundled default · ${key}`, {
				table: 'site_content',
				recordId: key
			});

			return { ok: true, key };
		}
	}
];

export const TOOL_SCHEMAS = ASSISTANT_TOOLS.map((tool) => ({
	type: 'function' as const,
	function: {
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters
	}
}));

export function findTool(name: string): ToolDef | undefined {
	return ASSISTANT_TOOLS.find((tool) => tool.name === name);
}
