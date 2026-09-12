import { error, json } from '@sveltejs/kit';
import {
	listMyCompanies,
	logFounderAction,
	requireCompanyOwner,
	requireSignedInFounder
} from '$lib/server/founderGuard';
import { setActiveCompany } from '$lib/server/founderSession';
import { sendTemplateEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

// A founder's companies. Creating one is the first thing most founders do here,
// and they may create more than one — so this is a list, not a property of the
// account.
//
// POST   { companyName, ... }  register a startup, pending TIC verification
// PUT    { companyId }         switch which company the console is pointed at
// DELETE ?id=                  remove one, with everything hanging off it

function slugify(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 64) || 'company'
	);
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const { founder, db } = requireSignedInFounder(cookies);
	const body = (await request.json().catch(() => ({}))) as {
		companyName?: string;
		website?: string;
		contactName?: string;
		contactEmail?: string;
		phone?: string;
	};

	const companyName = body.companyName?.trim() ?? '';
	const contactName = body.contactName?.trim() ?? '';
	const contactEmail = body.contactEmail?.trim().toLowerCase() ?? '';
	const phone = body.phone?.trim() ?? '';

	if (!companyName || !contactName || !contactEmail || !phone) {
		return json(
			{
				ok: false,
				error: 'Company name, contact person, contact email and phone are all required.'
			},
			{ status: 400 }
		);
	}

	// The same person registering the same startup twice is a slip, not a second
	// company, and two rows would split its roles and applicants between them.
	const mine = await listMyCompanies(db, founder.userId);
	if (mine.some((c) => c.name.toLowerCase() === companyName.toLowerCase())) {
		return json(
			{ ok: false, error: 'You already have a company with this name.' },
			{ status: 409 }
		);
	}

	const { data, error: dbError } = await db
		.from('companies')
		.insert({
			owner_id: founder.userId,
			email: founder.email,
			company_name: companyName,
			company_slug: slugify(companyName),
			website: body.website?.trim() ?? '',
			contact_name: contactName,
			contact_email: contactEmail,
			phone,
			status: 'pending'
		})
		.select('id, company_name')
		.single();

	if (dbError) error(500, dbError.message);

	// A founder who has just created a company is looking at that company.
	setActiveCompany(cookies, data.id as string);

	// The receipt that used to go out on company signup. It says what happens
	// next, which is the part a founder cannot see from here.
	await sendTemplateEmail({
		templateKey: 'company-signup',
		to: founder.email,
		toName: contactName,
		variables: { companyName, contactName, email: founder.email },
		context: { table: 'companies', recordId: data.id as string }
	});

	await logFounderAction({ founder, db }, `registered ${companyName}, pending TIC verification`, {
		table: 'companies',
		recordId: data.id as string,
		after: { company_name: companyName, contact_name: contactName, contact_email: contactEmail }
	});

	return json({ ok: true, id: data.id });
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const { founder, db } = requireSignedInFounder(cookies);
	const body = (await request.json().catch(() => ({}))) as { companyId?: string };
	if (!body.companyId) error(400, 'Missing company id.');

	const mine = await listMyCompanies(db, founder.userId);
	if (!mine.some((c) => c.id === body.companyId)) error(403, 'That company is not yours.');

	setActiveCompany(cookies, body.companyId);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ cookies, url }) => {
	const id = url.searchParams.get('id');
	const ctx = await requireCompanyOwner(cookies, id);

	// The cascade takes the jobs with it; applicants and the incubation
	// application keep their rows and lose the link, so TIC's own history of what
	// was reviewed does not disappear with the company.
	const { error: dbError } = await ctx.db.from('companies').delete().eq('id', ctx.companyId);
	if (dbError) error(500, dbError.message);

	await logFounderAction(ctx, `deleted the company ${ctx.company.name}`, {
		table: 'companies',
		recordId: ctx.companyId
	});

	return json({ ok: true });
};
