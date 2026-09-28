// The model the assistant runs on. Sarvam 105B only: the open-weight models
// Sarvam hosts are gated per key, and attachments — the one thing a vision model
// added — are no longer part of the assistant.
//
// Kept as a list so the request builder still reads the path from the entry.
//
// Shared by the settings dialog and the server route on purpose: the dropdown
// and the request builder must agree about which endpoint a model lives on and
// whether it can be handed an image, or the console would offer an attachment
// the API would then reject.
//
// Sarvam's own models and the open-weight models it hosts sit on different
// paths — /v1 for sarvam-*, /v2 for the open-source ones — so the path travels
// with the model rather than being assumed.

export type AssistantModel = {
	id: string;
	label: string;
	/** One line, shown under the label in the picker. */
	blurb: string;
	path: '/v1/chat/completions' | '/v2/chat/completions';
	/** Accepts images in the message content array. Gates the attach button. */
	images: boolean;
	contextLabel: string;
};

export const ASSISTANT_MODELS: AssistantModel[] = [
	{
		id: 'sarvam-105b',
		label: 'Sarvam 105B',
		blurb: 'Best quality and deepest reasoning. Text only.',
		path: '/v1/chat/completions',
		images: false,
		contextLabel: '128K context'
	}
];

export const DEFAULT_MODEL_ID = 'sarvam-105b';

export function findModel(id: string | null | undefined): AssistantModel {
	return ASSISTANT_MODELS.find((model) => model.id === id) ?? ASSISTANT_MODELS[0];
}
