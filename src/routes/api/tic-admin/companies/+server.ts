import { error, json } from '@sveltejs/kit';
import { logAdminAction, requireAdmin } from '$lib/server/adminGuard';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// Company moderation. `status` and `rejection_reason` are not granted to the
// authenticated role in the schema, so this service-role route is the only way
// an account can be verified or rejected.

const STATUSES = ['pending', 'verified', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

export const PATCH: RequestHandler = async ({ cookies, request }) => {
	const ctx = requireAdmin(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		id?: string;
		status?: string;
		rejectionReason?: string;
	};
	if (!body.id) error(400, 'Missing company id.');
	if (!STATUSES.includes(body.status as Status)) error(400, 'Unknown status.');

	// Selected back rather than looked up first: the update is the source of
	// truth for what the company is told, and one round trip covers both.
	const { data: company, error: dbError } = await ctx.db
		.from('companies')
		.update({
			status: body.status,
			rejection_reason: body.status === 'rejected' ? (body.rejectionReason ?? '') : null
		})
		.eq('id', body.id)
		.select('email, company_name, contact_name, rejection_reason')
		.maybeSingle();
	if (dbError) error(500, dbError.message);

	await logAdminAction(ctx, `set company status to ${body.status}`, {
		table: 'companies',
		recordId: body.id
	});

	// A decision is only useful to the company once it knows about it. The send
	// is awaited so the log row exists before the console refetches, and its
	// result is not checked: sendTemplateEmail() never throws, and a moderation
	// action must not be reported as failed because mail was.
	const email = await notifyCompany(ctx.admin.userId, body.id, body.status as Status, company);

	return json({ ok: true, email });
};

type CompanyRow = {
	email: string;
	company_name: string;
	contact_name: string;
	rejection_reason: string | null;
} | null;

// 'pending' is a revert — putting an account back in the queue is an internal
// correction, and telling the company its verification has been undone would
// raise more questions than it answers.
async function notifyCompany(
	adminId: string,
	companyId: string,
	status: Status,
	company: CompanyRow
): Promise<{ status: string; error: string | null } | null> {
	if (!company?.email || status === 'pending') return null;

	const result = await sendTemplateEmail({
		templateKey: status === 'verified' ? 'company-verified' : 'company-rejected',
		to: company.email,
		toName: company.contact_name || company.company_name,
		variables: {
			companyName: company.company_name ?? '',
			contactName: company.contact_name ?? '',
			reason: company.rejection_reason ?? ''
		},
		context: { table: 'companies', recordId: companyId, status },
		sentBy: adminId
	});

	return { status: result.status, error: result.error };
}

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const ctx = requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing company id.');

	await logAdminAction(ctx, 'deleted a company', {
		table: 'companies',
		recordId: id
	});

	// The company is deleted, not the founder who created it: one person may run
	// several, and removing their login because one startup was withdrawn would
	// take the others with it. Deleting the account itself is /api/tic-admin/users.
	//
	// jobs.company_id cascades from here. Resumes and any incubation application
	// are deliberately left: both are `on delete set null`, so TIC's record of
	// what it reviewed outlives the company.
	const { error: dbError } = await ctx.db.from('companies').delete().eq('id', id);
	if (dbError) error(500, dbError.message);
	return json({ ok: true });
};
