// CSV export, shared by the TIC console and the company portal.
//
// Both exports are opened in a spreadsheet, which is why cellText() is more
// careful than a plain quote-and-escape. A value starting with =, +, - or @ is
// read by Excel and Sheets as a formula, so an applicant who types
// `=HYPERLINK(...)` into a form field gets it executed on the reviewer's
// machine. Prefixing with an apostrophe makes it text again.

const RISKY_PREFIX = /^[=+\-@\t\r]/;

function cellText(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'boolean') return value ? 'yes' : 'no';

	const text = String(value);
	return RISKY_PREFIX.test(text) ? `'${text}` : text;
}

function escape(value: unknown): string {
	const text = cellText(value);
	// Excel needs CRLF inside a quoted cell to keep a line break as a line break.
	return /["\n\r,]/.test(text) ? `"${text.replace(/"/g, '""').replace(/\n/g, '\r\n')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
	const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))];
	return lines.join('\r\n');
}

/**
 * Hands the file to the browser. The BOM is what makes Excel open a UTF-8 CSV
 * as UTF-8 — without it a name with an accent in it arrives mangled.
 */
export function downloadCsv(fileName: string, csv: string): void {
	const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
	document.body.appendChild(link);
	link.click();
	link.remove();

	// Revoked on the next tick rather than immediately: Safari has not started
	// the download by the time click() returns.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// `applicants-frontend-engineer-2026-09-01.csv`
export function stampedFileName(prefix: string, scope = ''): string {
	const date = new Date().toISOString().slice(0, 10);
	const middle = scope ? `-${scope.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}` : '';
	return `${prefix}${middle}-${date}.csv`;
}
