// Floats a dropdown, menu or hover card above everything on the page, anchored
// to the element that opened it.
//
// It goes into the browser's top layer (the Popover API), so no ancestor can
// clip it: not a scrolling table, not a card with overflow: hidden, not a
// transformed parent, and not an open <dialog> — a plain <body> portal would
// sit behind a modal. The node stays where it is in the DOM, so "is this click
// inside the menu?" checks keep working.
//
//   {#if open}<div use:floating={{ anchor: button }}>…</div>{/if}

export type FloatingOptions = {
	anchor: HTMLElement | null | undefined;
	/** Horizontal alignment against the anchor. */
	align?: 'start' | 'center' | 'end';
	/** Space between anchor and node, in px. */
	gap?: number;
	/** Make the node exactly as wide as the anchor (selects). */
	matchWidth?: boolean;
};

const EDGE = 8;

export function floating(node: HTMLElement, options: FloatingOptions) {
	let opts = options;
	let frame = 0;

	node.setAttribute('popover', 'manual');
	// app.scss strips the browser's own popover box off anything marked this way.
	node.setAttribute('data-floating', '');
	node.showPopover();

	function place() {
		const anchor = opts.anchor;
		if (!anchor) return;
		const r = anchor.getBoundingClientRect();
		const gap = opts.gap ?? 6;
		if (opts.matchWidth) node.style.width = `${r.width}px`;

		const w = node.offsetWidth;
		const h = node.offsetHeight;
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		// Below by default; above when it would run off the bottom and there is
		// more room up there.
		const below = vh - r.bottom - gap;
		const above = r.top - gap;
		const top = h > below && above > below ? Math.max(EDGE, r.top - gap - h) : r.bottom + gap;

		const align = opts.align ?? 'start';
		let left =
			align === 'end' ? r.right - w : align === 'center' ? r.left + r.width / 2 - w / 2 : r.left;
		left = Math.min(Math.max(left, EDGE), vw - w - EDGE);

		node.style.top = `${top}px`;
		node.style.left = `${left}px`;
	}

	function schedule() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(place);
	}

	place();
	// Capture, so scrolling any container (not just the window) keeps it attached.
	window.addEventListener('scroll', schedule, true);
	window.addEventListener('resize', schedule);
	const observer = new ResizeObserver(schedule);
	observer.observe(node);

	return {
		update(next: FloatingOptions) {
			opts = next;
			schedule();
		},
		destroy() {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule, true);
			window.removeEventListener('resize', schedule);
			observer.disconnect();
			if (node.matches(':popover-open')) node.hidePopover();
		}
	};
}
