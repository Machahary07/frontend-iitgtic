import { zipSync } from 'fflate';

// Builds one zip of resumes in the browser from short-lived signed links, so the
// server never holds a whole role's files in memory at once. Names are made
// unique, since two applicants can share one.

export async function downloadResumesZip(
	files: { url: string; name: string }[],
	zipName: string
): Promise<void> {
	const entries: Record<string, Uint8Array> = {};
	for (const file of files) {
		const res = await fetch(file.url);
		if (!res.ok) continue;
		const base = file.name.replace(/[\\/:*?"<>|]+/g, '-');
		let name = base;
		for (let n = 2; name in entries; n++) name = base.replace(/\.pdf$/i, ` (${n}).pdf`);
		entries[name] = new Uint8Array(await res.arrayBuffer());
	}
	if (Object.keys(entries).length === 0) throw new Error('No resumes could be fetched.');

	// PDFs are already compressed; storing them is as small and much faster.
	const zipped = zipSync(entries, { level: 0 });
	const blob = new Blob([zipped as BlobPart], { type: 'application/zip' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `${zipName}.zip`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
