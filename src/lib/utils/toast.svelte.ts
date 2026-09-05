// App-wide toasts, requested imperatively from anywhere — the counterpart to
// the confirm dialog. A page used to drop a message into its own layout, which
// pushed the content down and scrolled away with it. showToast() puts the same
// message in one fixed region in the corner instead, so it reads the same on
// every screen and never moves the page under someone.

export type ToastTone = 'ok' | 'err' | 'info';
export type ToastItem = { id: number; tone: ToastTone; text: string };

// An orientation note is read rather than glanced at, so 'info' stays up longer
// than the tick that only confirms what someone just did.
const LIFE: Record<ToastTone, number> = { ok: 4000, err: 6000, info: 7000 };

class ToastHost {
	items = $state<ToastItem[]>([]);
	private seq = 0;
	private timers = new Map<number, ReturnType<typeof setTimeout>>();

	show(text: string, tone: ToastTone = 'ok'): number {
		const id = ++this.seq;
		this.items = [...this.items, { id, tone, text }];
		this.timers.set(
			id,
			setTimeout(() => this.dismiss(id), LIFE[tone])
		);
		return id;
	}

	dismiss(id: number): void {
		const timer = this.timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
		this.items = this.items.filter((item) => item.id !== id);
	}
}

export const toasts = new ToastHost();

/** Show a corner toast. `ok` for a success, `err` for a failure, `info` for a notice. */
export const showToast = (text: string, tone: ToastTone = 'ok') => toasts.show(text, tone);
