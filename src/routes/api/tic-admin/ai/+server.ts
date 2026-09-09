import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireAdmin, type AdminContext } from '$lib/server/adminGuard';
import { findTool, TOOL_SCHEMAS } from '$lib/server/assistantTools';
import { runTurn, SarvamError, type ChatMessage, type ToolCall } from '$lib/server/sarvam';
import { findModel } from '$lib/utils/assistantModels';
import { CONTENT_SECTIONS } from '$lib/content';
import type { RequestHandler } from './$types';

// The assistant's back end.
//
// The browser never talks to Sarvam directly: the key would be exposed to every
// script on the page, and the model needs database access the browser must not
// have. Instead the console posts a conversation here, this route runs the
// tool-calling loop against the admin's own data, and streams the result back.
//
// The loop is deliberately read-only — see assistantTools.ts. The model can look
// at anything an admin can already see in the console and nothing else, and it
// cannot change a single row.

// A question that needs a count, then a list, then a specific record is three
// round trips. Past that the model is going in circles rather than converging.
const MAX_TOOL_ROUNDS = 6;

// Sent to the model on every request. Describing the shape of the console up
// front is what stops it guessing at tables that do not exist, and what lets it
// pick the right tool on the first try rather than probing.
function systemPrompt(adminName: string): string {
	const sections = CONTENT_SECTIONS.map((section) => section.key).join(', ');
	const today = new Date().toISOString().slice(0, 10);

	return `You are the assistant built into the TIC Team Admin console for the IIT Guwahati Technology Incubation Centre (TIC). You are talking to ${adminName}, a signed-in TIC administrator. Today is ${today}.

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

WHAT YOU CANNOT DO
Every tool you have is read-only. You cannot verify a company, change a status, send an email, edit the website or delete anything. If asked to do one of those, say so in one line and point to the console section where the admin can do it themselves — Companies, Applications, Posted jobs, Role applicants, Users, Content, Email or Storage. You may freely draft or rewrite text for an admin to paste in; drafting is not changing.`;
}

type IncomingMessage = {
	role: 'user' | 'assistant';
	content: string;
	/** base64 data URIs, images only, and only on a model that accepts them. */
	images?: string[];
};

type Event =
	| { type: 'step'; label: string }
	| { type: 'text'; delta: string }
	| { type: 'reasoning'; delta: string }
	| { type: 'done' }
	| { type: 'error'; message: string };

// Turns the console's simplified messages into what the API expects. Images ride
// along in the content array, which only the vision model understands, so they
// are dropped rather than sent to a model that would reject the whole request.
function toApiMessages(messages: IncomingMessage[], acceptsImages: boolean): ChatMessage[] {
	return messages.map((message) => {
		const images = acceptsImages ? (message.images ?? []) : [];
		if (message.role !== 'user' || images.length === 0) {
			return { role: message.role, content: message.content };
		}
		return {
			role: 'user',
			content: [
				{ type: 'text', text: message.content },
				...images.map((url) => ({ type: 'image_url', image_url: { url } }))
			]
		};
	});
}

async function runTool(ctx: AdminContext, call: ToolCall): Promise<string> {
	const tool = findTool(call.function.name);
	if (!tool) {
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
		return JSON.stringify(await tool.run(ctx.db, args));
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'The lookup failed.';
		return JSON.stringify({ error: message });
	}
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);

	const body = (await request.json().catch(() => ({}))) as {
		model?: string;
		apiKey?: string;
		messages?: IncomingMessage[];
	};

	// The key is the admin's, held in their browser and sent per request, or a
	// server-side one if the deployment has been given a shared key. It is never
	// written to the database and never logged.
	const apiKey = (body.apiKey || env.SARVAM_API_KEY || '').trim();
	if (!apiKey) error(400, 'No Sarvam API key. Add one in the assistant settings.');

	const history = (body.messages ?? []).filter((message) => message?.content || message?.images);
	if (history.length === 0) error(400, 'Nothing to send.');

	const model = findModel(body.model);

	const messages: ChatMessage[] = [
		{ role: 'system', content: systemPrompt(ctx.admin.name || ctx.admin.email) },
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
						modelId: model.id,
						messages,
						tools: exhausted ? undefined : TOOL_SCHEMAS,
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

					messages.push({
						role: 'assistant',
						content: turn.content || null,
						tool_calls: turn.toolCalls
					});

					// Independent lookups, so they run together rather than in sequence.
					const results = await Promise.all(
						turn.toolCalls.map(async (call) => {
							const tool = findTool(call.function.name);
							if (tool) {
								let args: Record<string, unknown> = {};
								try {
									args = JSON.parse(call.function.arguments || '{}');
								} catch {
									// The label is cosmetic; a bad argument string is reported
									// back to the model by runTool, not here.
								}
								emit({ type: 'step', label: tool.label(args) });
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
