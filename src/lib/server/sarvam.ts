import { findModel } from '$lib/utils/assistantModels';

// Thin client for Sarvam's chat completions API.
//
// It is OpenAI-compatible, so the message and tool shapes are the familiar ones,
// with two differences worth stating: the key travels in an api-subscription-key
// header rather than as a bearer token, and Sarvam's own models and the
// open-weight ones it hosts sit on different paths. The model registry carries
// the path so nothing here has to guess.

const BASE_URL = 'https://api.sarvam.ai';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | unknown[] | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string;
};

export type ToolCall = {
	id: string;
	type: 'function';
	function: { name: string; arguments: string };
};

/** One completed assistant turn, whether it was streamed or not. */
export type Turn = {
	content: string;
	toolCalls: ToolCall[];
};

export class SarvamError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

// Sarvam reports failures as JSON, but a gateway in front of it may not, so the
// body is only parsed opportunistically and the raw text is the fallback.
async function readError(response: Response): Promise<string> {
	const raw = await response.text().catch(() => '');
	try {
		const parsed = JSON.parse(raw);
		const detail = parsed?.error?.message ?? parsed?.message ?? parsed?.detail;
		if (typeof detail === 'string' && detail) return detail;
	} catch {
		// Not JSON — the text itself is the best description available.
	}
	return raw.slice(0, 500) || `Sarvam returned ${response.status}.`;
}

function friendlyError(status: number, detail: string, modelLabel: string): string {
	if (status === 401 || status === 403) {
		return 'Sarvam rejected the API key. Check it in the assistant settings.';
	}
	// The open-weight models are gated behind a per-key beta flag, so a working
	// key still gets turned away here. Saying which model and what to do about it
	// is the difference between a dead end and a five-minute fix.
	if (/beta/i.test(detail)) {
		return `${modelLabel} is not enabled on this Sarvam key — it is in beta and each key has to be allow-listed for it. Ask Sarvam support for access, or switch back to Sarvam 105B in the assistant settings.`;
	}
	if (status === 404) {
		return `Sarvam does not recognise that model. ${detail}`;
	}
	if (status === 429) {
		return 'Sarvam is rate limiting this key. Wait a moment and try again.';
	}
	return detail;
}

/** Sampling settings, from the deployment's SARVAM_* variables. */
export type Tuning = {
	temperature: number;
	topP: number;
	maxTokens: number;
	/** sarvam-* models only; the open-weight ones reject the field. */
	reasoningEffort: 'low' | 'medium' | 'high' | null;
};

function number(raw: string | undefined, fallback: number, min: number, max: number): number {
	const value = Number(raw);
	return raw?.trim() && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

// Read once per request rather than at import, so changing a variable on the
// host takes effect on the next question without a rebuild.
export function tuningFromEnv(env: Record<string, string | undefined>): Tuning {
	const effort = env.SARVAM_REASONING_EFFORT?.trim().toLowerCase();
	return {
		temperature: number(env.SARVAM_TEMPERATURE, 0.2, 0, 2),
		topP: number(env.SARVAM_TOP_P, 1, 0, 1),
		// sarvam-105b reasons before it answers and the reasoning is billed and
		// budgeted out of the same allowance, so a limit sized for the answer
		// alone gets spent thinking and returns nothing.
		maxTokens: Math.round(number(env.SARVAM_MAX_TOKENS, 4096, 256, 32768)),
		reasoningEffort: effort === 'low' || effort === 'medium' || effort === 'high' ? effort : null
	};
}

type CallOptions = {
	apiKey: string;
	tuning?: Tuning;
	modelId: string;
	messages: ChatMessage[];
	tools?: unknown[];
	signal?: AbortSignal;
	/** Called with each new fragment of assistant prose as it arrives. */
	onText?: (delta: string) => void;
	/** Called with the model's private reasoning, which sarvam-105b emits before
	 *  it answers. Shown as progress, never as the answer. */
	onReasoning?: (delta: string) => void;
};

/**
 * Runs one turn and returns it. Streams when a text handler is supplied, so the
 * console can paint the answer as it is written; falls back to a plain response
 * read if the endpoint answers with JSON anyway.
 */
export async function runTurn(options: CallOptions): Promise<Turn> {
	const model = findModel(options.modelId);
	const wantsStream = Boolean(options.onText);
	const tuning = options.tuning ?? tuningFromEnv({});
	const sarvamModel = model.id.startsWith('sarvam-');

	const response = await fetch(`${BASE_URL}${model.path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'api-subscription-key': options.apiKey
		},
		signal: options.signal,
		body: JSON.stringify({
			model: model.id,
			messages: options.messages,
			temperature: tuning.temperature,
			top_p: tuning.topP,
			max_tokens: tuning.maxTokens,
			...(sarvamModel && tuning.reasoningEffort ? { reasoning_effort: tuning.reasoningEffort } : {}),
			stream: wantsStream,
			...(options.tools?.length ? { tools: options.tools, tool_choice: 'auto' } : {})
		})
	});

	if (!response.ok) {
		const detail = await readError(response);
		throw new SarvamError(friendlyError(response.status, detail, model.label), response.status);
	}

	const contentType = response.headers.get('content-type') ?? '';
	if (!wantsStream || !contentType.includes('event-stream')) {
		return readWholeResponse(response);
	}
	return readStream(response, options.onText!, options.onReasoning);
}

async function readWholeResponse(response: Response): Promise<Turn> {
	const payload = (await response.json()) as {
		choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
	};
	const message = payload.choices?.[0]?.message;
	return {
		content: message?.content ?? '',
		toolCalls: message?.tool_calls ?? []
	};
}

// Tool calls arrive split across deltas — the id and name in the first, the
// arguments a character at a time after it — and are keyed by index rather than
// by id, so they are reassembled positionally.
type PartialCall = { id: string; name: string; arguments: string };

async function readStream(
	response: Response,
	onText: (delta: string) => void,
	onReasoning?: (delta: string) => void
): Promise<Turn> {
	const reader = response.body?.getReader();
	if (!reader) throw new SarvamError('Sarvam sent an empty response.', 502);

	const decoder = new TextDecoder();
	const calls = new Map<number, PartialCall>();
	let content = '';
	let buffer = '';

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		// SSE events are separated by a blank line, but a chunk can split one in
		// half, so only whole lines are consumed and the remainder is carried over.
		let newline: number;
		while ((newline = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);

			if (!line.startsWith('data:')) continue;
			const data = line.slice(5).trim();
			if (!data || data === '[DONE]') continue;

			let event: {
				choices?: {
					delta?: {
						content?: string | null;
						reasoning_content?: string | null;
						tool_calls?: {
							index?: number;
							id?: string;
							function?: { name?: string; arguments?: string };
						}[];
					};
				}[];
			};
			try {
				event = JSON.parse(data);
			} catch {
				// A keep-alive or a comment frame. Nothing to add.
				continue;
			}

			const delta = event.choices?.[0]?.delta;
			if (!delta) continue;

			if (typeof delta.content === 'string' && delta.content) {
				content += delta.content;
				onText(delta.content);
			}

			if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
				onReasoning?.(delta.reasoning_content);
			}

			for (const [position, call] of (delta.tool_calls ?? []).entries()) {
				const index = call.index ?? position;
				const existing = calls.get(index) ?? { id: '', name: '', arguments: '' };
				calls.set(index, {
					id: call.id || existing.id,
					name: call.function?.name || existing.name,
					arguments: existing.arguments + (call.function?.arguments ?? '')
				});
			}
		}
	}

	return {
		content,
		toolCalls: [...calls.entries()]
			.sort(([a], [b]) => a - b)
			.filter(([, call]) => call.name)
			.map(([index, call]) => ({
				id: call.id || `call_${index}`,
				type: 'function' as const,
				function: { name: call.name, arguments: call.arguments || '{}' }
			}))
	};
}
