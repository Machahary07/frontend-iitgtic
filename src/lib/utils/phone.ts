// Phone numbers, everywhere on the site: exactly ten digits, nothing else.
//
// The action keeps the field honest as it is typed or pasted — "+91 98640-12345"
// becomes 9864012345 — so the check on submit is a formality rather than the
// first the person hears of it. A pasted number with a country code keeps its
// last ten digits, which is the subscriber number.

export const PHONE_DIGITS = 10;
export const PHONE_PATTERN = '\\d{10}';

export function cleanPhone(value: string): string {
	const digits = value.replace(/\D/g, '');
	return digits.length > PHONE_DIGITS ? digits.slice(-PHONE_DIGITS) : digits;
}

export function isValidPhone(value: string | null | undefined): boolean {
	return /^\d{10}$/.test(value ?? '');
}

/** `use:phoneInput` on an <input>. Works alongside bind:value. */
export function phoneInput(node: HTMLInputElement) {
	node.inputMode = 'numeric';
	node.maxLength = PHONE_DIGITS + 8; // room to paste "+91 98640 12345" before it is cleaned
	node.pattern = PHONE_PATTERN;
	if (!node.title) node.title = 'Exactly 10 digits';

	const onInput = () => {
		const cleaned = cleanPhone(node.value);
		if (cleaned === node.value) return;
		node.value = cleaned;
		// Re-announce so a bind:value on the same input picks up the cleaned value.
		node.dispatchEvent(new Event('input', { bubbles: true }));
	};

	node.addEventListener('input', onInput);
	return { destroy: () => node.removeEventListener('input', onInput) };
}
