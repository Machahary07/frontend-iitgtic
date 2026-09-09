import { browser } from '$app/environment';
import { DEFAULT_MODEL_ID, findModel } from '$lib/utils/assistantModels';

// Where the assistant's API key and model choice live.
//
// The key stays in the admin's own browser and is sent with each request rather
// than being stored on the server. That is a deliberate trade: it means a key
// belongs to the person who pasted it, is never written to the database, and
// disappears when they clear the console. A deployment that would rather use one
// shared key sets SARVAM_API_KEY on the server instead and nobody has to paste
// anything.
//
// Being localStorage, it is readable by anything running on this origin. That is
// acceptable for a key scoped to an admin-only console, and it is why the key is
// never given a PUBLIC_ env var — but it is a reason to rotate the key rather
// than treat it as long-lived.

const STORE_KEY = 'tic-admin:assistant';

type Stored = { apiKey?: string; model?: string; autoApprove?: boolean };

function read(): Stored {
	if (!browser) return {};
	// Private windows and blocked site data throw on access rather than returning
	// null, so a failed read simply means "no settings yet".
	try {
		return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Stored;
	} catch {
		return {};
	}
}

class AssistantSettings {
	apiKey = $state('');
	modelId = $state(DEFAULT_MODEL_ID);
	// Whether the assistant may apply a content edit on its own. Off by default:
	// the edits reach the live public site, so the safe posture is to show the
	// change and wait for the admin to approve it.
	autoApprove = $state(false);

	constructor() {
		const stored = read();
		this.apiKey = stored.apiKey ?? '';
		this.modelId = findModel(stored.model).id;
		this.autoApprove = stored.autoApprove ?? false;
	}

	get model() {
		return findModel(this.modelId);
	}

	private persist(): void {
		try {
			localStorage.setItem(
				STORE_KEY,
				JSON.stringify({ apiKey: this.apiKey, model: this.modelId, autoApprove: this.autoApprove })
			);
		} catch {
			// Not being able to remember the settings is not a reason to refuse them
			// for this session.
		}
	}

	save(apiKey: string, modelId: string): void {
		this.apiKey = apiKey.trim();
		this.modelId = findModel(modelId).id;
		this.persist();
	}

	setAutoApprove(value: boolean): void {
		this.autoApprove = value;
		this.persist();
	}

	forget(): void {
		this.apiKey = '';
		try {
			localStorage.removeItem(STORE_KEY);
		} catch {
			// Nothing to clear.
		}
	}
}

export const assistantSettings = new AssistantSettings();
