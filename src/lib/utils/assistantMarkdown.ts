// A deliberately small markdown renderer for assistant replies.
//
// The model is asked for short markdown, and this covers exactly that subset:
// paragraphs, bullet and numbered lists, bold, italic, inline code and links.
// Anything else is left as the literal text the model wrote.
//
// The order matters for safety. Everything is HTML-escaped first, so the only
// tags in the output are the ones added afterwards. Model output is untrusted
// text — it can contain anything a row in the database contains — so it must
// never reach {@html} unescaped.

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function inline(text: string): string {
	return (
		escapeHtml(text)
			// Code first: its contents must not then be read as bold or a link.
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
			// Only http(s) targets, so a javascript: URL in model output cannot
			// become a live link.
			.replace(
				/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
				'<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
			)
	);
}

// A pipe row is a table row; the row under the header is the alignment rule and
// carries no content of its own.
function isTableRow(line: string): boolean {
	return line.startsWith('|') && line.length > 1;
}

function isTableRule(line: string): boolean {
	return /^\|[\s:|-]+\|?$/.test(line) && line.includes('-');
}

function cellsOf(line: string): string[] {
	return line
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((cell) => cell.trim());
}

export function renderMarkdown(source: string): string {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const out: string[] = [];

	let list: 'ul' | 'ol' | null = null;
	let quote: string[] = [];
	let paragraph: string[] = [];

	const closeParagraph = () => {
		if (paragraph.length === 0) return;
		out.push(`<p>${inline(paragraph.join(' '))}</p>`);
		paragraph = [];
	};

	const closeList = () => {
		if (!list) return;
		out.push(`</${list}>`);
		list = null;
	};

	const closeQuote = () => {
		if (quote.length === 0) return;
		out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
		quote = [];
	};

	for (let index = 0; index < lines.length; index += 1) {
		const trimmed = lines[index].trim();

		if (!trimmed) {
			closeParagraph();
			closeList();
			closeQuote();
			continue;
		}

		// Tables are how the model lays out anything with more than one column —
		// templates and their triggers, applicants and their statuses — so they are
		// worth parsing rather than leaving as a row of pipes.
		if (isTableRow(trimmed) && isTableRule((lines[index + 1] ?? '').trim())) {
			closeParagraph();
			closeList();
			closeQuote();

			const header = cellsOf(trimmed);
			const body: string[][] = [];
			let cursor = index + 2;

			while (cursor < lines.length && isTableRow(lines[cursor].trim())) {
				body.push(cellsOf(lines[cursor].trim()));
				cursor += 1;
			}
			index = cursor - 1;

			const head = header.map((cell) => `<th>${inline(cell)}</th>`).join('');
			const rows = body
				.map((row) => {
					// A short row would otherwise collapse the grid, so every row is
					// padded out to the header's width.
					const cells = Array.from(
						{ length: header.length },
						(_, column) => `<td>${inline(row[column] ?? '')}</td>`
					);
					return `<tr>${cells.join('')}</tr>`;
				})
				.join('');

			// The wrapper is what lets a wide table scroll inside the bubble instead
			// of stretching the whole thread.
			out.push(
				`<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
			);
			continue;
		}

		const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
		if (heading) {
			closeParagraph();
			closeList();
			closeQuote();
			// Headings inside a chat bubble are all one size — the nesting carries no
			// meaning here, and h1-sized text in a reply just shouts.
			out.push(`<p class="md-h">${inline(heading[2])}</p>`);
			continue;
		}

		// The model quotes copy back when asked what the site says, so a quote has
		// to read as one rather than as a stray angle bracket.
		const quoted = /^>\s?(.*)$/.exec(trimmed);
		if (quoted) {
			closeParagraph();
			closeList();
			quote.push(quoted[1]);
			continue;
		}
		closeQuote();

		const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
		const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);

		if (bullet || numbered) {
			closeParagraph();
			const wanted = bullet ? 'ul' : 'ol';
			if (list !== wanted) {
				closeList();
				out.push(`<${wanted}>`);
				list = wanted;
			}
			out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
			continue;
		}

		closeList();
		paragraph.push(trimmed);
	}

	closeParagraph();
	closeList();
	closeQuote();

	return out.join('');
}
