import { describe, it, expect } from 'vitest';
import { isValidTimePasscode, unlockSecretServer } from '../secretServerService';

describe('secretServerService', () => {
	it('validates passcode matching HHmmDDYY on exact time', () => {
		// Example: 2026-10-04 at 00:23
		const fixedDate = new Date(2026, 9, 4, 0, 23, 0); // Month is 0-indexed (9 = Oct)
		const validCode = '00230426';

		expect(isValidTimePasscode(validCode, fixedDate)).toBe(true);
	});

	it('accepts passcode within tolerance window of +/- 3 minutes', () => {
		const fixedDate = new Date(2026, 9, 4, 0, 25, 0);
		// 2 minutes ago: 00:23
		expect(isValidTimePasscode('00230426', fixedDate, 3)).toBe(true);
		// 3 minutes ahead: 00:28
		expect(isValidTimePasscode('00280426', fixedDate, 3)).toBe(true);
		// 4 minutes ago: 00:21 (out of range)
		expect(isValidTimePasscode('00210426', fixedDate, 3)).toBe(false);
	});

	it('rejects invalid or malformed passcodes', () => {
		const fixedDate = new Date(2026, 9, 4, 0, 23, 0);
		expect(isValidTimePasscode('1234', fixedDate)).toBe(false);
		expect(isValidTimePasscode('abcdefgh', fixedDate)).toBe(false);
		expect(isValidTimePasscode('', fixedDate)).toBe(false);
		expect(isValidTimePasscode('99999999', fixedDate)).toBe(false);
	});

	it('unlocks secret server when passcode is valid', () => {
		const fixedDate = new Date(2026, 9, 4, 0, 23, 0);
		const server = unlockSecretServer('00230426', fixedDate);

		expect(server).not.toBeNull();
		expect(server?.name).toBe('VPS Oracle');
		expect(server?.url).toMatch(/^https:\/\/.+/);
	});

	it('returns null when unlocking with invalid passcode', () => {
		const fixedDate = new Date(2026, 9, 4, 0, 23, 0);
		const server = unlockSecretServer('00000000', fixedDate);

		expect(server).toBeNull();
	});
});
