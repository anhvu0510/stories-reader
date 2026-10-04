// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { biometricService, STORAGE_KEY_BIOMETRIC_LOCK } from '../biometricService';

describe('BiometricService', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	it('reads and writes biometric lock enabled state to localStorage', () => {
		expect(biometricService.isBiometricLockEnabled()).toBe(false);

		biometricService.setBiometricLockEnabled(true);
		expect(localStorage.getItem(STORAGE_KEY_BIOMETRIC_LOCK)).toBe('true');
		expect(biometricService.isBiometricLockEnabled()).toBe(true);

		biometricService.setBiometricLockEnabled(false);
		expect(localStorage.getItem(STORAGE_KEY_BIOMETRIC_LOCK)).toBeNull();
		expect(biometricService.isBiometricLockEnabled()).toBe(false);
	});

	it('returns unsupported status gracefully when running on web platform', async () => {
		const availability = await biometricService.checkBiometricAvailability();
		expect(availability.isAvailable).toBe(false);
		expect(availability.status).toBe('UNSUPPORTED');
	});

	it('falls back to passcode when running authenticate on non-native platform', async () => {
		const result = await biometricService.authenticate();
		expect(result.success).toBe(false);
		expect(result.fallbackToPasscode).toBe(true);
	});
});
