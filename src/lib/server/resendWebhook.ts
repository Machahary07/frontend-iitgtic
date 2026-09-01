import { createHmac, timingSafeEqual } from 'node:crypto';

// Resend signs its webhooks with Svix. The scheme is small enough to implement
// directly, which keeps this consistent with the rest of the email code — the
// send path calls Resend's REST API with fetch rather than pulling in a client.
//
//   signed content = `${svix-id}.${svix-timestamp}.${raw body}`
//   signature      = base64( HMAC-SHA256( base64decode(secret), content ) )
//
// The secret arrives as `whsec_<base64>`; the prefix is not part of the key.
// `svix-signature` carries a space-separated list of `v1,<sig>` pairs, because a
// secret being rotated is signed with both the old and the new one.

const TOLERANCE_SECONDS = 5 * 60;

export type VerifyResult = { ok: true } | { ok: false; reason: string };

function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}

export function verifyResendSignature(
	secret: string,
	headers: Headers,
	rawBody: string
): VerifyResult {
	const id = headers.get('svix-id') ?? headers.get('webhook-id');
	const timestamp = headers.get('svix-timestamp') ?? headers.get('webhook-timestamp');
	const signature = headers.get('svix-signature') ?? headers.get('webhook-signature');

	if (!id || !timestamp || !signature) return { ok: false, reason: 'Missing signature headers.' };

	// A captured request must not stay replayable forever.
	const sent = Number(timestamp);
	if (!Number.isFinite(sent)) return { ok: false, reason: 'Malformed timestamp.' };
	if (Math.abs(Date.now() / 1000 - sent) > TOLERANCE_SECONDS) {
		return { ok: false, reason: 'Timestamp outside the tolerance window.' };
	}

	const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
	const expected = createHmac('sha256', key)
		.update(`${id}.${timestamp}.${rawBody}`)
		.digest('base64');

	const provided = signature
		.split(' ')
		.map((part) => part.split(',', 2)[1])
		.filter((sig): sig is string => Boolean(sig));

	if (provided.length === 0) return { ok: false, reason: 'No v1 signature present.' };
	if (!provided.some((sig) => safeEqual(sig, expected))) {
		return { ok: false, reason: 'Signature did not match.' };
	}

	return { ok: true };
}

// --- event shape ------------------------------------------------------------

export type ResendEvent = {
	type: string;
	created_at?: string;
	data?: {
		email_id?: string;
		to?: string[] | string;
		subject?: string;
		bounce?: { type?: string; subType?: string; message?: string };
	};
};

export function recipientOf(event: ResendEvent): string {
	const to = event.data?.to;
	const first = Array.isArray(to) ? to[0] : to;
	return (first ?? '').trim().toLowerCase();
}

// Which events take an address out of circulation.
//
// A complaint always does — someone pressed "this is spam", and mailing them
// again is how a sending domain gets blocked. A bounce only does when it is
// permanent: a full mailbox or a temporary server failure comes back as a
// transient bounce, and suppressing on those would lose real recipients.
export function suppressionFor(
	event: ResendEvent
): { reason: 'bounced' | 'complained'; detail: string } | null {
	if (event.type === 'email.complained') {
		return { reason: 'complained', detail: 'Recipient reported the message as spam.' };
	}
	if (event.type === 'email.bounced') {
		const bounce = event.data?.bounce;
		if ((bounce?.type ?? '').toLowerCase() !== 'permanent') return null;
		return {
			reason: 'bounced',
			detail: bounce?.message || `${bounce?.type ?? 'Permanent'} / ${bounce?.subType ?? 'General'}`
		};
	}
	return null;
}
