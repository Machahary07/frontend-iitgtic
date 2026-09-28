import { untrack } from 'svelte';
import { browser } from '$app/environment';

// Paging for every list in the consoles, so a long table is a page at a time
// wherever it appears and the controls look and behave the same everywhere.
//
// Two shapes of list, one bar (Pagination.svelte):
//   - a list already in the page (most of them): new Pager(() => rows) slices it
//     here, in the browser;
//   - a list too long to ship whole (the audit log, the email log): the page
//     asks the server for one page at a time and hands the bar the total.
//
// The page size is one preference for the whole console, remembered in this
// browser, because someone who likes 50 rows likes them on every screen.

export const PAGE_SIZES = [10, 25, 50, 100] as const;
const SIZE_KEY = 'tic:page-size';
const DEFAULT_SIZE = 25;

function readSize(): number {
	if (!browser) return DEFAULT_SIZE;
	try {
		const stored = Number(localStorage.getItem(SIZE_KEY));
		return (PAGE_SIZES as readonly number[]).includes(stored) ? stored : DEFAULT_SIZE;
	} catch {
		return DEFAULT_SIZE;
	}
}

export function rememberPageSize(size: number): void {
	try {
		localStorage.setItem(SIZE_KEY, String(size));
	} catch {
		// Not remembering it is no reason to refuse it for this page.
	}
}

export function initialPageSize(): number {
	return readSize();
}

export class Pager<T> {
	page = $state(1);
	size = $state(DEFAULT_SIZE);
	#source: () => T[];

	/**
	 * @param source the full list, read reactively — filters and sorting stay
	 *   with the page, the pager only slices.
	 * @param resetOn anything that should send the list back to page 1 when it
	 *   changes: a filter tab, a search term. Must be created during component
	 *   initialisation for this to be tracked.
	 */
	constructor(source: () => T[], resetOn?: () => unknown, size?: number) {
		this.#source = source;
		this.size = size ?? readSize();
		if (resetOn) {
			$effect.pre(() => {
				resetOn();
				untrack(() => (this.page = 1));
			});
		}
	}

	get total(): number {
		return this.#source().length;
	}

	get pageCount(): number {
		return Math.max(1, Math.ceil(this.total / this.size));
	}

	/** The page actually shown: a list that shrank under the reader (a row
	 *  deleted, a live refresh) never leaves them on a page past the end. */
	get current(): number {
		return Math.min(Math.max(1, this.page), this.pageCount);
	}

	get rows(): T[] {
		const start = (this.current - 1) * this.size;
		return this.#source().slice(start, start + this.size);
	}

	go(page: number): void {
		this.page = Math.min(Math.max(1, page), this.pageCount);
	}

	resize(size: number): void {
		// Keep the first row on screen in view rather than jumping to the start.
		const first = (this.current - 1) * this.size;
		this.size = size;
		this.page = Math.floor(first / size) + 1;
		rememberPageSize(size);
	}
}
