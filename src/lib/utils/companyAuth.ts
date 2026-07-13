// Mock company-auth backed by localStorage.
// Plaintext passwords are obviously not for production — replace with a real
// auth provider (Supabase / Lucia / Clerk) when wiring a real backend.

const ACCOUNTS_KEY = 'tic.companies';
const SESSION_KEY = 'tic.companies.session';

export type CompanyStatus = 'pending' | 'verified' | 'rejected';

export type CompanyAccount = {
	id: string;
	email: string;
	password: string;
	companyName: string;
	companySlug: string;
	website: string;
	contactName: string;
	createdAt: string;
	status: CompanyStatus;
	rejectionReason?: string;
};

export type CompanySession = {
	companyId: string;
};

function isBrowser() {
	return typeof localStorage !== 'undefined';
}

function slugify(s: string) {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64) || 'company';
}

function readAccounts(): CompanyAccount[] {
	if (!isBrowser()) return [];
	const raw = localStorage.getItem(ACCOUNTS_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as CompanyAccount[];
		return parsed.map((a) => ({ ...a, status: a.status ?? 'pending' }));
	} catch {
		return [];
	}
}

function writeAccounts(accounts: CompanyAccount[]) {
	if (!isBrowser()) return;
	localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function signupCompany(input: {
	email: string;
	password: string;
	companyName: string;
	website?: string;
	contactName?: string;
}): { ok: true; account: CompanyAccount } | { ok: false; error: string } {
	const email = input.email.trim().toLowerCase();
	const companyName = input.companyName.trim();
	if (!email || !input.password || !companyName) {
		return { ok: false, error: 'Email, password and company name are all required.' };
	}
	if (input.password.length < 6) {
		return { ok: false, error: 'Password must be at least 6 characters.' };
	}
	const accounts = readAccounts();
	if (accounts.some((a) => a.email === email)) {
		return { ok: false, error: 'An account with this email already exists.' };
	}
	const id = 'c_' + Math.random().toString(36).slice(2, 10);
	const account: CompanyAccount = {
		id,
		email,
		password: input.password,
		companyName,
		companySlug: slugify(companyName),
		website: input.website?.trim() ?? '',
		contactName: input.contactName?.trim() ?? '',
		createdAt: new Date().toISOString(),
		status: 'pending'
	};
	writeAccounts([...accounts, account]);
	setSession({ companyId: id });
	return { ok: true, account };
}

export function getAllCompanies(): CompanyAccount[] {
	return readAccounts();
}

export function setCompanyStatus(
	id: string,
	status: CompanyStatus,
	rejectionReason?: string
): boolean {
	const accounts = readAccounts();
	const idx = accounts.findIndex((a) => a.id === id);
	if (idx < 0) return false;
	accounts[idx] = {
		...accounts[idx],
		status,
		rejectionReason: status === 'rejected' ? rejectionReason ?? '' : undefined
	};
	writeAccounts(accounts);
	return true;
}

export function deleteCompanyById(id: string): boolean {
	const accounts = readAccounts();
	const filtered = accounts.filter((a) => a.id !== id);
	if (filtered.length === accounts.length) return false;
	writeAccounts(filtered);
	return true;
}

export function loginCompany(
	email: string,
	password: string
): { ok: true; account: CompanyAccount } | { ok: false; error: string } {
	const normalized = email.trim().toLowerCase();
	const account = readAccounts().find((a) => a.email === normalized);
	if (!account || account.password !== password) {
		return { ok: false, error: 'Invalid email or password.' };
	}
	setSession({ companyId: account.id });
	return { ok: true, account };
}

export function logoutCompany() {
	if (!isBrowser()) return;
	localStorage.removeItem(SESSION_KEY);
}

export function getSession(): CompanySession | null {
	if (!isBrowser()) return null;
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as CompanySession;
	} catch {
		return null;
	}
}

function setSession(session: CompanySession) {
	if (!isBrowser()) return;
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getCurrentCompany(): CompanyAccount | null {
	const session = getSession();
	if (!session) return null;
	return readAccounts().find((a) => a.id === session.companyId) ?? null;
}

export function updateCurrentCompany(
	patch: Partial<Omit<CompanyAccount, 'id' | 'createdAt' | 'email'>>
): CompanyAccount | null {
	const current = getCurrentCompany();
	if (!current) return null;
	const accounts = readAccounts();
	const idx = accounts.findIndex((a) => a.id === current.id);
	if (idx < 0) return null;
	const updated: CompanyAccount = {
		...accounts[idx],
		...patch,
		companySlug: patch.companyName ? slugify(patch.companyName) : accounts[idx].companySlug
	};
	accounts[idx] = updated;
	writeAccounts(accounts);
	return updated;
}

export function changePassword(
	currentPassword: string,
	newPassword: string
): { ok: true } | { ok: false; error: string } {
	const current = getCurrentCompany();
	if (!current) return { ok: false, error: 'Not logged in.' };
	if (current.password !== currentPassword) {
		return { ok: false, error: 'Current password is incorrect.' };
	}
	if (newPassword.length < 6) {
		return { ok: false, error: 'New password must be at least 6 characters.' };
	}
	const accounts = readAccounts();
	const idx = accounts.findIndex((a) => a.id === current.id);
	if (idx < 0) return { ok: false, error: 'Account not found.' };
	accounts[idx] = { ...accounts[idx], password: newPassword };
	writeAccounts(accounts);
	return { ok: true };
}

export function deleteCurrentCompany(): boolean {
	const current = getCurrentCompany();
	if (!current) return false;
	writeAccounts(readAccounts().filter((a) => a.id !== current.id));
	logoutCompany();
	return true;
}
