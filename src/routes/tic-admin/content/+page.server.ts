import { adminDb } from '$lib/server/adminData';
import { CONTENT_SECTIONS } from '$lib/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { admin } = await parent();
	const db = adminDb(admin!);

	const { data } = await db.from('site_content').select('key, updated_at, updated_by');
	const stored = new Map((data ?? []).map((row) => [row.key as string, row]));

	const { data: profiles } = await db.from('profiles').select('id, full_name, email');
	const nameById = new Map(
		(profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string)])
	);

	return {
		sections: CONTENT_SECTIONS.map((section) => {
			const row = stored.get(section.key);
			return {
				...section,
				stored: Boolean(row),
				updatedAt: (row?.updated_at as string) ?? null,
				updatedBy: row?.updated_by ? (nameById.get(row.updated_by as string) ?? null) : null
			};
		})
	};
};
