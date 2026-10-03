/**
 * Service managing obfuscated / encrypted server configurations
 * and time-based passcode verification (HHmmDDYY).
 */

const CIPHER_PAYLOAD = 'KFYBEwQAUWhHNzQ2UhwXAhEJEWlJW0dCXhRpVgcGHRUAaEpOBRUbfgQNGhMBe1BIAh5WQzAfCxwaSxwgAkMZ';
const SECRET_SEED = ['Stories', 'Reader', 'SecretKey', '2026'].join('');

export interface SecretServerConfig {
	name: string;
	url: string;
}

/**
 * Checks if the given passcode matches HHmmDDYY for current time (+/- toleranceMinutes)
 * Format:
 * - HH: 24-hour format (00-23)
 * - mm: Minutes (00-59)
 * - DD: Day of month (01-31)
 * - YY: Two-digit year (e.g. 26 for 2026)
 */
export function isValidTimePasscode(passcode: string, now = new Date(), toleranceMinutes = 3): boolean {
	if (!passcode || typeof passcode !== 'string') return false;
	const cleanCode = passcode.trim();
	if (cleanCode.length !== 8 || !/^\d{8}$/.test(cleanCode)) return false;

	for (let offset = -toleranceMinutes; offset <= toleranceMinutes; offset++) {
		const targetDate = new Date(now.getTime() + offset * 60 * 1000);
		const hh = String(targetDate.getHours()).padStart(2, '0');
		const mm = String(targetDate.getMinutes()).padStart(2, '0');
		const dd = String(targetDate.getDate()).padStart(2, '0');
		const yy = String(targetDate.getFullYear()).slice(-2);
		const expected = `${hh}${mm}${dd}${yy}`;

		if (cleanCode === expected) {
			return true;
		}
	}

	return false;
}

function decryptPayload(ciphertext: string, key: string): string {
	const binaryString = atob(ciphertext);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	const keyBytes = new TextEncoder().encode(key);
	const decrypted = new Uint8Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		decrypted[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
	}

	return new TextDecoder().decode(decrypted);
}

/**
 * Validates the time-based passcode and returns the decrypted server configuration if valid.
 */
export function unlockSecretServer(passcode: string, now = new Date()): SecretServerConfig | null {
	if (!isValidTimePasscode(passcode, now)) {
		return null;
	}

	try {
		const jsonStr = decryptPayload(CIPHER_PAYLOAD, SECRET_SEED);
		const parsed = JSON.parse(jsonStr) as SecretServerConfig;
		if (parsed && parsed.url && parsed.name) {
			return parsed;
		}
	} catch (e) {
		console.error('[SecretServerService] Failed to decrypt server configuration:', e);
	}

	return null;
}

/**
 * Safely decodes and returns the obfuscated default gateway URL at runtime
 * without exposing the raw domain in git history or static analysis.
 */
export function getEncryptedDefaultGatewayUrl(): string {
	try {
		const jsonStr = decryptPayload(CIPHER_PAYLOAD, SECRET_SEED);
		const parsed = JSON.parse(jsonStr) as SecretServerConfig;
		return parsed?.url ? parsed.url.replace(/\/+$/, '') : '';
	} catch {
		return '';
	}
}
