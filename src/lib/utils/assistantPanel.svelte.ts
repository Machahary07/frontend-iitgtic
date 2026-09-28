import { browser } from '$app/environment';

// Whether the assistant's side panel is showing, shared between the sparkle in
// AdminShell (which opens it) and the /tic-admin layout (which draws it).
//
// The panel lives in the layout rather than on a page so it survives moving
// between pages: a question asked on Companies is still there on Approvals.

/** Wide enough to dock the panel as a column beside the page. Narrower, it
 *  floats over the page from the right. Matches the layout's CSS. */
const DOCK = '(min-width: 1280px)';
/** Docked but not roomy: the sidebar folds to its icon rail while the panel is
 *  open, so the page keeps a readable width. Never written to the sidebar's own
 *  saved preference, so closing the panel puts it back as it was. */
const SQUEEZE = '(min-width: 1280px) and (max-width: 1599.98px)';

function watch(query: string, set: (value: boolean) => void): void {
	if (!browser) return;
	const list = window.matchMedia(query);
	set(list.matches);
	list.addEventListener('change', (event) => set(event.matches));
}

class AssistantPanel {
	/** True once a layout has mounted the panel. Without it the sparkle falls
	 *  back to being a plain link. */
	available = $state(false);
	open = $state(false);
	docked = $state(true);
	squeezed = $state(false);

	constructor() {
		watch(DOCK, (value) => (this.docked = value));
		watch(SQUEEZE, (value) => (this.squeezed = value));
	}

	/** Whether the sidebar should give up its width to the panel right now. */
	get borrowsRail(): boolean {
		return this.open && this.squeezed;
	}

	show(): void {
		this.open = true;
	}

	close(): void {
		this.open = false;
	}

	toggle(): void {
		this.open = !this.open;
	}
}

export const assistantPanel = new AssistantPanel();
