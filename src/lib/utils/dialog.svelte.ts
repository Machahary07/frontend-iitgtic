// One modal at a time, requested imperatively from anywhere in the app.
//
// A native confirm() blocks the thread, which is what let the old call sites
// write `if (!confirm(...)) return`. A custom dialog cannot block, so this hands
// back a promise that settles when the person answers and every call site awaits
// it. The shape is deliberately close to confirm() so the swap stays readable.

export type DialogTone = 'default' | 'danger';

export type ConfirmRequest = {
	title: string;
	/** Optional second line. The title alone carries the question when omitted. */
	body?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: DialogTone;
	/** Bullet list of consequences, shown under the body. */
	points?: string[];
	/** Confirm stays disabled until this exact text is typed (case-insensitive). */
	typeToConfirm?: string;
};

type Active = ConfirmRequest & { settle: (answer: boolean) => void };

class DialogHost {
	active = $state<Active | null>(null);

	ask(request: ConfirmRequest): Promise<boolean> {
		// A second request arriving while one is open would strand the first
		// promise forever, so the outgoing one is answered "no" rather than left
		// hanging — the safe answer for a question nobody got to see.
		this.active?.settle(false);

		return new Promise((resolve) => {
			this.active = {
				...request,
				settle: (answer) => {
					this.active = null;
					resolve(answer);
				}
			};
		});
	}

	answer(value: boolean) {
		this.active?.settle(value);
	}
}

export const dialog = new DialogHost();

/** Ask a yes/no question. Resolves false on Cancel, Esc, or a backdrop click. */
export const askConfirm = (request: ConfirmRequest) => dialog.ask(request);
