import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import {
	groupsFor,
	profileFromApplication,
	sanitizeProfile,
	slugify,
	type DraftStatus,
	type ProfileGroup,
	type ProfileStage,
	type StartupProfileData
} from '$lib/utils/startupProfile';

// startup_profiles is service-role only, so every read and write is here, behind
// a check the caller has already made (a founder guard, a staff role, or "only
// what is listed" for the public site).

export type ProfileRow = {
	id: string;
	company_id: string | null;
	slug: string;
	stage: ProfileStage;
	is_virtual: boolean;
	listed: boolean;
	published: StartupProfileData | null;
	draft: StartupProfileData;
	draft_status: DraftStatus;
	review_note: string | null;
	submitted_at: string | null;
	reviewed_at: string | null;
	live_at: string | null;
	graduated_at: string | null;
	updated_at: string;
};

const COLUMNS =
	'id, company_id, slug, stage, is_virtual, listed, published, draft, draft_status, review_note, submitted_at, reviewed_at, live_at, graduated_at, updated_at';

function shape(row: Record<string, unknown>): ProfileRow {
	return {
		...(row as unknown as ProfileRow),
		draft: sanitizeProfile(row.draft),
		published: row.published ? sanitizeProfile(row.published) : null
	};
}

export type PublicStartup = StartupProfileData & { slug: string; groups: ProfileGroup[] };

function toPublic(row: ProfileRow): PublicStartup {
	return { ...(row.published as StartupProfileData), slug: row.slug, groups: groupsFor(row.stage, row.is_virtual) };
}

/** Every startup listed on the site, newest live first. */
export async function listPublicStartups(): Promise<PublicStartup[]> {
	const { data } = await supabaseAdmin
		.from('startup_profiles')
		.select(COLUMNS)
		.eq('listed', true)
		.neq('stage', 'exited')
		.not('published', 'is', null)
		.order('live_at', { ascending: false, nullsFirst: false });
	return (data ?? []).map((r) => toPublic(shape(r)));
}

export async function startupsInGroup(group: ProfileGroup): Promise<PublicStartup[]> {
	return (await listPublicStartups()).filter((s) => s.groups.includes(group));
}

export async function publicStartup(slug: string): Promise<PublicStartup | null> {
	const { data } = await supabaseAdmin
		.from('startup_profiles')
		.select(COLUMNS)
		.eq('slug', slug)
		.eq('listed', true)
		.neq('stage', 'exited')
		.not('published', 'is', null)
		.maybeSingle();
	return data ? toPublic(shape(data)) : null;
}

export async function profileById(id: string): Promise<ProfileRow | null> {
	const { data } = await supabaseAdmin.from('startup_profiles').select(COLUMNS).eq('id', id).maybeSingle();
	return data ? shape(data) : null;
}

export async function profileForCompany(companyId: string): Promise<ProfileRow | null> {
	const { data } = await supabaseAdmin
		.from('startup_profiles')
		.select(COLUMNS)
		.eq('company_id', companyId)
		.maybeSingle();
	return data ? shape(data) : null;
}

export async function listAllProfiles(): Promise<ProfileRow[]> {
	const { data } = await supabaseAdmin
		.from('startup_profiles')
		.select(COLUMNS)
		.order('updated_at', { ascending: false });
	return (data ?? []).map(shape);
}

async function freeSlug(name: string): Promise<string> {
	const base = slugify(name);
	const { data } = await supabaseAdmin
		.from('startup_profiles')
		.select('slug')
		.like('slug', `${base}%`);
	const taken = new Set((data ?? []).map((r) => r.slug as string));
	if (!taken.has(base)) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * The profile for an accepted company, created on first use from its
 * application. Null while the company has no accepted application.
 */
export async function ensureProfile(companyId: string): Promise<ProfileRow | null> {
	const existing = await profileForCompany(companyId);
	if (existing) return existing;

	const [{ data: company }, { data: app }] = await Promise.all([
		supabaseAdmin
			.from('companies')
			.select('company_name, website, contact_email')
			.eq('id', companyId)
			.maybeSingle(),
		supabaseAdmin
			.from('applications')
			.select('answers')
			.eq('company_id', companyId)
			.eq('status', 'accepted')
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle()
	]);
	if (!company || !app) return null;

	const draft = profileFromApplication((app.answers ?? {}) as Record<string, unknown>, {
		name: company.company_name as string,
		website: company.website as string | null,
		contactEmail: company.contact_email as string | null
	});
	const { data, error } = await supabaseAdmin
		.from('startup_profiles')
		.insert({ company_id: companyId, slug: await freeSlug(draft.name), draft })
		.select(COLUMNS)
		.single();
	// A second request racing this one inserts first; read what it made.
	if (error) return profileForCompany(companyId);
	return shape(data);
}

/**
 * Puts an approved profile on the website as a current incubatee. Refused
 * while there is no approved version, so the site never shows an empty page.
 */
export async function goLive(profileId: string, isVirtual: boolean): Promise<string | null> {
	const profile = await profileById(profileId);
	if (!profile) return 'Profile not found.';
	if (!profile.published) return 'Approve the startup’s public profile in Approvals first.';
	const { error } = await supabaseAdmin
		.from('startup_profiles')
		.update({
			listed: true,
			stage: 'current',
			is_virtual: isVirtual,
			live_at: profile.live_at ?? new Date().toISOString()
		})
		.eq('id', profileId);
	return error ? error.message : null;
}
