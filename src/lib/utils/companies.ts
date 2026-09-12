// The shape of a company as both consoles read it.
//
// A company is created by a founder and verified by TIC; a founder may have
// several. It is no longer an account you sign in as, which is why nothing here
// touches auth — see $lib/utils/appAuth for that.

export type CompanyStatus = 'pending' | 'verified' | 'rejected';

export type CompanyAccount = {
	id: string;
	/** The founder who created it. */
	ownerId?: string;
	email: string;
	companyName: string;
	companySlug: string;
	website: string;
	contactName: string;
	contactEmail: string;
	phone: string;
	createdAt: string;
	status: CompanyStatus;
	rejectionReason?: string;
};

export function slugify(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 64) || 'company'
	);
}
