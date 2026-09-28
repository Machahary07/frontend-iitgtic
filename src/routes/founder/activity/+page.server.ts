import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

// A founder's own trail: what the people in this company did, and what TIC did
// to this company's rows. The audit log is service-role only and holds every
// startup's history, so the filter here is the entire privacy boundary — it is
// built from the company's own member ids and its own record ids, never from
// anything the browser sends.

// Paged in the browser, so it can hold a good deal more than one screen.
const LIMIT = 500;

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, activeCompanyId } = await parent();
	if (!activeCompanyId) return { entries: [] };

	const db = founderDb(founder.userId);
	const companyId = activeCompanyId;

	const [members, jobs, owner] = await Promise.all([
		db.from('profiles').select('id').eq('company_id', companyId),
		db.from('jobs').select('id').eq('company_id', companyId),
		db.from('companies').select('owner_id').eq('id', companyId).maybeSingle()
	]);

	const memberIds = [
		...((members.data ?? []) as { id: string }[]).map((m) => m.id),
		...(owner.data?.owner_id ? [owner.data.owner_id as string] : [])
	];
	const recordIds = [
		companyId,
		...memberIds,
		...((jobs.data ?? []) as { id: string }[]).map((j) => j.id)
	];

	// audit_log's timestamp is occurred_at; it is read back as created_at, the
	// name this page has always used. (Asking for created_at itself failed both
	// queries, which is why this feed used to say "Nothing recorded yet".)
	//
	// Two reads rather than one `or`: PostgREST's or() takes the filter as a
	// string, and a list of uuids spliced into one would be a needless place for
	// quoting to go wrong.
	const [byUs, aboutUs] = await Promise.all([
		db
			.from('audit_log')
			.select('id, created_at:occurred_at, actor_label, action, table_name, record_id')
			.in('actor_id', memberIds)
			.order('occurred_at', { ascending: false })
			.limit(LIMIT),
		db
			.from('audit_log')
			.select('id, created_at:occurred_at, actor_label, action, table_name, record_id')
			.in('record_id', recordIds)
			.order('occurred_at', { ascending: false })
			.limit(LIMIT)
	]);

	type Entry = {
		id: string;
		created_at: string;
		actor_label: string | null;
		action: string;
		table_name: string | null;
		record_id: string | null;
	};

	const seen = new Set<string>();
	const entries = [...((byUs.data ?? []) as Entry[]), ...((aboutUs.data ?? []) as Entry[])]
		.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
		.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
		.slice(0, LIMIT);

	return { entries };
};
