import { json, text } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import {
	recipientOf,
	suppressionFor,
	verifyResendSignature,
	type ResendEvent
} from '$lib/server/resendWebhook';
import type { RequestHandler } from './$types';

// Delivery feedback from Resend.
//
// email_log records what we handed to the provider; it cannot know what
// happened next. A hard bounce or a spam complaint arrives here, minutes or
// hours later, and is what turns an optimistic 'sent' into the truth.
//
// Point Resend at https://<site>/api/resend-webhook and put the signing secret
// it gives you in RESEND_WEBHOOK_SECRET. Without that secret the endpoint
// refuses everything — an unauthenticated version of this route would let
// anyone suppress any address, which is a denial of service on your own mail.

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.RESEND_WEBHOOK_SECRET?.trim();
	if (!secret) {
		console.error('[resend-webhook] RESEND_WEBHOOK_SECRET is not set; rejecting.');
		return text('Webhook not configured.', { status: 503 });
	}

	// The signature covers the exact bytes sent, so the body is read as text and
	// parsed only after it verifies.
	const raw = await request.text();
	const verified = verifyResendSignature(secret, request.headers, raw);
	if (!verified.ok) {
		console.warn('[resend-webhook] rejected:', verified.reason);
		return text('Invalid signature.', { status: 401 });
	}

	let event: ResendEvent;
	try {
		event = JSON.parse(raw) as ResendEvent;
	} catch {
		return text('Malformed payload.', { status: 400 });
	}
	if (!event.type) return text('Missing event type.', { status: 400 });

	const email = recipientOf(event);
	const occurredAt = event.created_at ?? new Date().toISOString();

	// Resend retries anything that did not answer 2xx, so the same event can
	// arrive more than once. The unique index turns the repeat into a 23505,
	// which is a success from the provider's point of view — not an error.
	const { error: insertError } = await supabaseAdmin.from('email_events').insert({
		provider_id: event.data?.email_id ?? null,
		type: event.type,
		to_email: email,
		occurred_at: occurredAt,
		payload: event as unknown as Record<string, unknown>
	});
	if (insertError && insertError.code !== '23505') {
		console.error('[resend-webhook] could not record event:', insertError.message);
		// Answered as a failure so Resend retries: losing a bounce silently is
		// how a suppression list goes stale.
		return text('Could not record event.', { status: 500 });
	}

	const suppression = suppressionFor(event);
	if (suppression && email) {
		const { error: suppressError } = await supabaseAdmin
			.from('email_suppressions')
			.upsert(
				{ email, reason: suppression.reason, detail: suppression.detail },
				{ onConflict: 'email' }
			);
		if (suppressError) {
			console.error('[resend-webhook] could not suppress:', suppressError.message);
			return text('Could not record suppression.', { status: 500 });
		}
	}

	return json({ ok: true });
};
