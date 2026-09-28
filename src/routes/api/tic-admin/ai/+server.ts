import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireAdmin, type AdminContext } from '$lib/server/adminGuard';
import { findTool, toolAllowed, toolSchemasFor } from '$lib/server/assistantTools';
import { runTurn, SarvamError, tuningFromEnv, type ChatMessage, type ToolCall } from '$lib/server/sarvam';
import { findModel } from '$lib/utils/assistantModels';
import { CONTENT_SECTIONS } from '$lib/content';
import { roleLabel } from '$lib/utils/roles';
import type { RequestHandler } from './$types';

// The assistant's back end.
//
// The browser never talks to Sarvam directly: the key would be exposed to every
// script on the page, and the model needs database access the browser must not
// have. Instead the console posts a conversation here, this route runs the
// tool-calling loop against the admin's own data, and streams the result back.
//
// The loop can look at anything an admin can already see in the console. It is
// read-only everywhere except site content: the model may edit the public
// website's copy, the one write the tool surface grants — see assistantTools.ts.
// Those edits go through the same audited site_content path the Content screen
// uses. Everything else — statuses, companies, emails, deletes — stays read-only.

// A question that needs a count, then a list, then a specific record is three
// round trips. Past that the model is going in circles rather than converging.
const MAX_TOOL_ROUNDS = 6;

// Sent to the model on every request. Describing the shape of the console up
// front is what stops it guessing at tables that do not exist, and what lets it
// pick the right tool on the first try rather than probing.
function systemPrompt(adminName: string, role: string, identity: string): string {
	const sections = CONTENT_SECTIONS.map((section) => section.key).join(', ');
	const today = new Date().toISOString().slice(0, 10);

	return `${identity ? `${identity}\n\n` : ''}You are the assistant built into the TIC Team Admin console for the IIT Guwahati Technology Incubation Centre (TIC). You are talking to ${adminName}, signed in as ${roleLabel(role)}. Today is ${today}.

ACCESS
Your tools cover only the parts of the console the ${roleLabel(role)} role can open. If a question needs data or a change outside them, say in one line that their role does not include it, and do not guess at the answer.

WHAT THIS ORGANISATION DOES
IIT Guwahati TIC incubates startups. Founders apply to be incubated. Separately, companies register accounts so they can post job openings on the public site, and job seekers apply to those postings. The public site also carries editable pages: about, team, governing body, mentors, FAQ, blog, incubation, incubated startups, events, partners, opportunities, apply, contact, privacy and terms.

WHAT THE CONSOLE HOLDS
- Companies — company accounts, each pending, verified or rejected. Only verified companies may post roles.
- Applications — founders applying for incubation. Status: submitted, under-review, accepted, rejected.
- Posted jobs — roles published by verified companies.
- Role applicants — people applying to those posted jobs. Status: new, shortlisted, forwarded, rejected. These are NOT incubation applicants; never conflate the two.
- Users — account profiles, each a founder, a company or an admin.
- Activity — the audit trail of every change, and public-site traffic.
- Content — the live copy of the public website, stored under keys: ${sections}.
- Email — the transactional templates the site sends, plus the delivery log and newsletter sign-ups.
- Storage — uploaded documents and images.

HOW TO ANSWER
- Use the tools. You have no memory of this database between messages, and any number you state without looking it up is a guess. If a question touches the console's data at all, call a tool before answering.
- Prefer console_overview for anything broad. Reach for a narrower tool when the question names a person, a company, a job or a section.
- Chain tools when you need to: list first, then open the specific record.
- Answer from what the tools returned, and say plainly when a tool came back empty rather than filling the gap.
- Be concise and concrete. Give the figure, the name, the date. Short markdown — a sentence or a tight list, not an essay. No preamble like "Certainly".
- Use British spelling, matching the rest of the console.

WHAT YOU CAN CHANGE
You can edit the copy on the public website and the transactional email templates.

For website copy: call read_site_section first to see the section's shape. Then, to change one field, call update_site_section with the section key, the dotted path to that field (e.g. hero.heading, or members.2.bio — array items count from 0) and the new value for that field alone. Editing by path is the reliable way and leaves the rest of the section untouched; only omit path to replace a whole small section outright. reset_site_section puts a section back to its bundled default.

For emails: call get_email_template first to see its subject, its content blocks and the {{variables}} it uses. Then call update_email_template with the changed subject and/or the full blocks list — send the whole list with your edits, keeping every {{variable}} the template needs, and never send the compiled HTML body. You can also switch a template on or off with its enabled flag. reset_email_template restores a template's bundled default. You cannot edit the shared layout.

You can send email two ways. send_newsletter emails every active subscriber — just a subject and the message blocks; a one-click unsubscribe link is added to the footer automatically, so do not add one yourself. send_email sends a one-off message to specific people — an applicant, a company, an individual or a small group (up to 100). Find each recipient's address with the read tools (list_incubation_applications, list_companies, list_role_applicants, list_users) and never guess one. Both can carry a PDF via a file block with attach set to true. Both are real sends, so they always wait for the admin's explicit approval — you never send unattended. There is no other way to send mail: you cannot change a status to make the system send its automatic email.

Every edit is audited and can be reverted from Activity, so make the change when asked rather than only describing it; still confirm first if the request is vague about what to write.

FILES THE ADMIN ATTACHES
When the admin attaches a file it is uploaded and its public URL is listed in their message under "[The admin attached…]". You are given only the name and URL — never the file's contents, so never claim to have read a file or summarise what is inside it. To use an attachment:
- An image: write its URL into the matching image field with update_site_section — for a person that field is their avatar's src, e.g. path members.2.avatar.src on pages.team or pages.governingBody. Read the section first to find the right index, and set the avatar's alt text when it is empty.
- A document (PDF, Word, etc.): attach it to an email by adding a file block to the template with update_email_template — set the block's src to the URL, its name to the file's name, and attach to true so it is delivered as a real attachment. It rides on every send of that template until removed.
Only ever use a URL the admin attached or that a tool returned; never invent one. You still cannot send email — you prepare the template; the admin sends.

WHAT YOU CANNOT DO
You can write website content and email templates, and send email (the newsletter, or a direct message to chosen recipients). You cannot verify a company, change a status, or delete anything. If asked to do one of those, say so in one line and point to the console section where the admin can do it themselves — Companies, Applications, Posted jobs, Role applicants, Users or Storage. You may freely draft or rewrite text for an admin to paste in; drafting is not changing.`;
}

type IncomingMessage = {
	role: 'user' | 'assistant';
	content: string;
	/** base64 data URIs, images only, and only on a model that accepts them. */
	images?: string[];
	/** Files the admin attached, uploaded to a public bucket. Their URLs are folded
	 *  into the text so any model can place or attach one; contents are never read. */
	attachments?: { name: string; url: string; kind?: 'image' | 'file'; size?: string }[];
};

type Event =
	| { type: 'step'; label: string }
	| { type: 'text'; delta: string }
	| { type: 'reasoning'; delta: string }
	| {
			type: 'proposal';
			id: string;
			tool: string;
			args: Record<string, unknown>;
			summary: string;
			before: unknown;
			after: unknown;
			/** For an email: the rendered message to show instead of before/after. */
			html?: string;
	  }
	| { type: 'done' }
	| { type: 'error'; message: string };

// The attached files, folded into the user's text as name + URL so a text-only
// model can place or attach one. Their contents are deliberately not included —
// an attachment is a thing to use, not to read. The vision channel below is
// separate: it lets a model *look* at an attached image.
function attachmentNote(
	attachments: { name: string; url: string; kind?: 'image' | 'file'; size?: string }[]
): string {
	if (attachments.length === 0) return '';
	const lines = attachments
		.map((item) => {
			const what = item.kind === 'file' ? 'file' : 'image';
			return `- ${what} "${item.name}"${item.size ? ` (${item.size})` : ''}: ${item.url}`;
		})
		.join('\n');
	return `\n\n[The admin attached ${attachments.length} file${attachments.length > 1 ? 's' : ''}, uploaded to storage. You have only the name and URL below, not the contents:\n${lines}]`;
}

// Turns the console's simplified messages into what the API expects. Images ride
// along in the content array, which only the vision model understands, so they
// are dropped rather than sent to a model that would reject the whole request.
function toApiMessages(messages: IncomingMessage[], acceptsImages: boolean): ChatMessage[] {
	return messages.map((message) => {
		if (message.role !== 'user') {
			return { role: message.role, content: message.content };
		}

		const text = message.content + attachmentNote(message.attachments ?? []);
		const images = acceptsImages ? (message.images ?? []) : [];
		if (images.length === 0) {
			return { role: 'user', content: text };
		}
		return {
			role: 'user',
			content: [
				{ type: 'text', text },
				...images.map((url) => ({ type: 'image_url', image_url: { url } }))
			]
		};
	});
}

async function runTool(ctx: AdminContext, call: ToolCall): Promise<string> {
	const tool = findTool(call.function.name);
	if (!tool || !toolAllowed(ctx.admin.role, tool.name)) {
		return JSON.stringify({ error: `No tool named "${call.function.name}".` });
	}

	// Arguments are a string the model wrote, so they are frequently not valid
	// JSON on the first try. That is a recoverable mistake, not a request failure:
	// the model is told so and can call again.
	let args: Record<string, unknown>;
	try {
		args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
	} catch {
		return JSON.stringify({ error: 'Arguments were not valid JSON. Send a JSON object.' });
	}

	try {
		return JSON.stringify(await tool.run(ctx.db, args, ctx));
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'The lookup failed.';
		return JSON.stringify({ error: message });
	}
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = await requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		model?: string;
		apiKey?: string;
		messages?: IncomingMessage[];
		/** When false (the default), a content write is previewed for the admin to
		 *  approve rather than applied inside the loop. */
		autoApprove?: boolean;
	};
	const autoApprove = body.autoApprove === true;

	// The key is the admin's, held in their browser and sent per request, or a
	// server-side one if the deployment has been given a shared key. It is never
	// written to the database and never logged.
	const apiKey = (body.apiKey || env.SARVAM_API_KEY || '').trim();
	if (!apiKey) error(400, 'No Sarvam API key. Add one in the assistant settings.');

	const history = (body.messages ?? []).filter((message) => message?.content || message?.images);
	if (history.length === 0) error(400, 'Nothing to send.');

	const model = findModel(body.model || env.SARVAM_MODEL_ID);
	const tuning = tuningFromEnv(env);
	const tools = toolSchemasFor(ctx.admin.role);

	const messages: ChatMessage[] = [
		{
			role: 'system',
			content: systemPrompt(
				ctx.admin.name || ctx.admin.email,
				ctx.admin.role,
				env.SARVAM_SYSTEM_MESSAGE?.trim() ?? ''
			)
		},
		...toApiMessages(history, model.images)
	];

	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			// Newline-delimited JSON rather than SSE: the console is the only
			// consumer, and one JSON object per line is trivial to read back with a
			// stream reader and needs no event framing.
			const emit = (event: Event) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			};

			try {
				for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
					// On the last permitted round the tools are withheld, which forces
					// an answer out of whatever has been gathered instead of ending the
					// turn on a tool call nobody will run.
					const exhausted = round === MAX_TOOL_ROUNDS;

					const turn = await runTurn({
						apiKey,
						tuning,
						modelId: model.id,
						messages,
						tools: exhausted ? undefined : tools,
						signal: request.signal,
						onText: (delta) => emit({ type: 'text', delta }),
						onReasoning: (delta) => emit({ type: 'reasoning', delta })
					});

					if (turn.toolCalls.length === 0) {
						// Some models answer with neither prose nor a tool call. Saying so
						// is better than an empty bubble.
						if (!turn.content.trim()) {
							emit({
								type: 'text',
								delta: 'The model returned an empty reply. Try asking again.'
							});
						}
						break;
					}

					// A tool call whose arguments were cut off mid-stream (the token budget
					// spent on reasoning, say) carries an incomplete JSON string. Echoing
					// that straight back makes Sarvam reject the whole next request;
					// blanking it keeps the request valid, and the tool result below
					// already tells the model the arguments were unreadable so it retries.
					const echoedCalls = turn.toolCalls.map((call) => {
						try {
							JSON.parse(call.function.arguments || '{}');
							return call;
						} catch {
							return { ...call, function: { ...call.function, arguments: '{}' } };
						}
					});

					messages.push({
						role: 'assistant',
						content: turn.content || null,
						tool_calls: echoedCalls
					});

					// Independent lookups, so they run together rather than in sequence.
					const results = await Promise.all(
						turn.toolCalls.map(async (call) => {
							const found = findTool(call.function.name);
							const tool = found && toolAllowed(ctx.admin.role, found.name) ? found : undefined;
							let args: Record<string, unknown> = {};
							if (tool) {
								try {
									args = JSON.parse(call.function.arguments || '{}');
								} catch {
									// The label is cosmetic; a bad argument string is reported
									// back to the model by runTool, not here.
								}
								emit({ type: 'step', label: tool.label(args) });
							}

							// A write the admin still has to approve: don't run it. Show them
							// the before/after and hand the model a note so it stops rather
							// than looping. The write itself happens later, through
							// /api/tic-admin/ai/apply, when they click Approve. confirmAlways
							// tools (the newsletter blast) take this path even with Auto on.
							if (tool?.write && (!autoApprove || tool.confirmAlways)) {
								const preview = tool.preview
									? await tool.preview(ctx.db, args)
									: { error: 'This change cannot be previewed.' };
								if ('error' in preview) return { call, content: JSON.stringify(preview) };

								emit({
									type: 'proposal',
									id: randomUUID(),
									tool: call.function.name,
									args,
									summary: preview.summary,
									before: preview.before,
									after: preview.after,
									html: preview.html
								});
								return {
									call,
									content: JSON.stringify({
										status: 'awaiting_approval',
										note: 'This change has been shown to the admin to approve or reject. Do not call it again; briefly tell them what you have proposed.'
									})
								};
							}

							return { call, content: await runTool(ctx, call) };
						})
					);

					for (const { call, content } of results) {
						messages.push({ role: 'tool', tool_call_id: call.id, content });
					}
				}

				emit({ type: 'done' });
			} catch (cause) {
				if (cause instanceof SarvamError) {
					emit({ type: 'error', message: cause.message });
				} else if (cause instanceof Error && cause.name === 'AbortError') {
					// The admin navigated away or pressed stop. Nothing to report.
				} else {
					emit({
						type: 'error',
						message: cause instanceof Error ? cause.message : 'The assistant failed.'
					});
				}
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-store',
			// Proxies that buffer would hold the whole answer back and undo the
			// point of streaming it.
			'X-Accel-Buffering': 'no'
		}
	});
};
