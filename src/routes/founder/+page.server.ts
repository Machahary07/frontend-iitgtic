import { founderDb } from '$lib/server/founderGuard';
import type { PageServerLoad } from './$types';

// The overview counts what is waiting on whom: what TIC still has to look at,
// and what has come back needing the founder's attention. Everything is read
// with the service key and filtered to this company by hand — a founder must be
// able to see their own pending rows, which the public policies hide.

export const load: PageServerLoad = async ({ parent }) => {
	const { founder, company } = await parent();

	const empty = {
		jobs: { approved: 0, pending: 0, rejected: 0 },
		applicants: { total: 0, fresh: 0 },
		team: { approved: 0, pending: 0 },
		application: null as null | {
			id: string;
			status: string;
			startupName: string;
			createdAt: string;
		},
		profileChangePending: false
	};

	if (!founder.companyId || !company || founder.memberStatus !== 'approved') return empty;

	const db = founderDb(founder.userId);
	const companyId = founder.companyId;

	const [jobs, applicants, team, application, profileChange] = await Promise.all([
		db.from('jobs').select('id, status').eq('company_id', companyId),
		db.from('job_applications').select('id, status').eq('company_id', companyId),
		db.from('profiles').select('id, member_status').eq('company_id', companyId),
		db
			.from('applications')
			.select('id, status, startup_name, created_at')
			.eq('user_id', founder.userId)
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle(),
		db
			.from('company_profile_changes')
			.select('id', { count: 'exact', head: true })
			.eq('company_id', companyId)
			.eq('status', 'pending')
	]);

	const jobRows = (jobs.data ?? []) as { status: string }[];
	const applicantRows = (applicants.data ?? []) as { status: string }[];
	const teamRows = (team.data ?? []) as { member_status: string }[];

	return {
		jobs: {
			approved: jobRows.filter((j) => j.status === 'approved').length,
			pending: jobRows.filter((j) => j.status === 'pending').length,
			rejected: jobRows.filter((j) => j.status === 'rejected').length
		},
		applicants: {
			total: applicantRows.length,
			fresh: applicantRows.filter((a) => a.status === 'new').length
		},
		team: {
			approved: teamRows.filter((t) => t.member_status === 'approved').length,
			pending: teamRows.filter((t) => t.member_status === 'pending').length
		},
		application: application.data
			? {
					id: application.data.id as string,
					status: application.data.status as string,
					startupName: (application.data.startup_name as string) || '',
					createdAt: application.data.created_at as string
				}
			: null,
		profileChangePending: (profileChange.count ?? 0) > 0
	};
};
