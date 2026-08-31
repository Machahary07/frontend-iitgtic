// Resend's published allowances, and the arithmetic the usage meter does with
// them. Shared because the server enforces the caps before spending an API call
// and the console draws the same numbers as a meter.
//
// Resend exposes no quota endpoint, so "used" is counted from our own
// public.email_log rather than asked of the provider. The two agree as long as
// every send goes through sendTemplateEmail() — which is the only reason a row
// is written for a blocked or failed attempt too.

export type PlanId = 'free' | 'pro' | 'scale' | 'enterprise';

export type Plan = {
	id: PlanId;
	name: string;
	// null means the plan does not cap that window.
	monthly: number | null;
	daily: number | null;
	note: string;
};

export const EMAIL_PLANS: Record<PlanId, Plan> = {
	free: {
		id: 'free',
		name: 'Free',
		monthly: 3000,
		daily: 100,
		note: '3,000 emails a month, capped at 100 a day, one verified domain.'
	},
	pro: {
		id: 'pro',
		name: 'Pro',
		monthly: 50000,
		daily: null,
		note: '50,000 emails a month with no daily cap.'
	},
	scale: {
		id: 'scale',
		name: 'Scale',
		monthly: 100000,
		daily: null,
		note: '100,000 emails a month with no daily cap.'
	},
	enterprise: {
		id: 'enterprise',
		name: 'Enterprise',
		monthly: null,
		daily: null,
		note: 'Custom volume — set RESEND_MONTHLY_LIMIT to track it here.'
	}
};

export function resolvePlan(id: string | undefined): Plan {
	const key = (id ?? 'free').toLowerCase() as PlanId;
	return EMAIL_PLANS[key] ?? EMAIL_PLANS.free;
}

export type Allowance = {
	label: string;
	used: number;
	limit: number | null;
	remaining: number | null;
	percent: number;
	// 'ok' under 75%, 'warn' from 75%, 'full' once nothing is left.
	tone: 'ok' | 'warn' | 'full';
	resetsAt: string;
};

export function allowance(
	label: string,
	used: number,
	limit: number | null,
	resetsAt: Date
): Allowance {
	const remaining = limit === null ? null : Math.max(0, limit - used);
	const percent = limit === null || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
	return {
		label,
		used,
		limit,
		remaining,
		percent,
		tone: remaining === 0 ? 'full' : percent >= 75 ? 'warn' : 'ok',
		resetsAt: resetsAt.toISOString()
	};
}

// Windows are UTC so the meter, the quota check and Resend's own accounting all
// roll over at the same instant regardless of where the admin is sitting.
export function monthStart(now = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStart(now = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function dayStart(now = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextDayStart(now = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
