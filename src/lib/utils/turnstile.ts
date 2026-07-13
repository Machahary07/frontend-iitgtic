// Client-side helper: asks our server route to verify a Turnstile token
// against Cloudflare using the secret key (which never reaches the browser).
export async function verifyTurnstileToken(token: string): Promise<boolean> {
	try {
		const res = await fetch('/api/turnstile', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token })
		});
		if (!res.ok) return false;
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}
