// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppLockStore } from '../useAppLockStore';
import { biometricService } from '@/services/biometricService';

describe('useAppLockStore', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.clearAllMocks();
		useAppLockStore.setState({
			isLockEnabled: false,
			isLocked: false,
			showPasscodeFallback: false,
			isAuthenticating: false
		});
	});

	it('activates biometric lock and unlocks current session upon passcode entry', () => {
		useAppLockStore.getState().enableLockAfterPasscode();

		expect(useAppLockStore.getState().isLockEnabled).toBe(true);
		expect(useAppLockStore.getState().isLocked).toBe(false);
		expect(biometricService.isBiometricLockEnabled()).toBe(true);
	});

	it('locks the app when lock() is called if lock is enabled', () => {
		useAppLockStore.getState().enableLockAfterPasscode();
		expect(useAppLockStore.getState().isLocked).toBe(false);

		// Mô phỏng sự kiện app bị sleep / vào background
		useAppLockStore.getState().lock();
		expect(useAppLockStore.getState().isLocked).toBe(true);
	});

	it('does not lock the app if lock is not enabled', () => {
		useAppLockStore.setState({ isLockEnabled: false, isLocked: false });
		useAppLockStore.getState().lock();
		expect(useAppLockStore.getState().isLocked).toBe(false);
	});

	it('unlocks the app when unlock() is called', () => {
		useAppLockStore.setState({ isLockEnabled: true, isLocked: true });
		useAppLockStore.getState().unlock();

		expect(useAppLockStore.getState().isLocked).toBe(false);
		expect(useAppLockStore.getState().showPasscodeFallback).toBe(false);
	});

	it('verifies valid time passcode and unlocks the app', () => {
		useAppLockStore.setState({ isLockEnabled: true, isLocked: true });

		const now = new Date();
		const hh = String(now.getHours()).padStart(2, '0');
		const mm = String(now.getMinutes()).padStart(2, '0');
		const dd = String(now.getDate()).padStart(2, '0');
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const validCode = `${hh}${mm}${dd}${month}`;

		const result = useAppLockStore.getState().verifyAndUnlockWithPasscode(validCode);
		expect(result).toBe(true);
		expect(useAppLockStore.getState().isLocked).toBe(false);
	});

	it('rejects invalid passcode and keeps app locked', () => {
		useAppLockStore.setState({ isLockEnabled: true, isLocked: true });

		const result = useAppLockStore.getState().verifyAndUnlockWithPasscode('00000000');
		expect(result).toBe(false);
		expect(useAppLockStore.getState().isLocked).toBe(true);
	});

	it('shows passcode fallback when biometric authentication fails or is canceled', async () => {
		useAppLockStore.setState({ isLockEnabled: true, isLocked: true, showPasscodeFallback: false });

		vi.spyOn(biometricService, 'authenticate').mockResolvedValue({
			success: false,
			fallbackToPasscode: true,
			isCanceled: true
		});

		const success = await useAppLockStore.getState().triggerBiometricPrompt();
		expect(success).toBe(false);
		expect(useAppLockStore.getState().isLocked).toBe(true);
		expect(useAppLockStore.getState().showPasscodeFallback).toBe(true);
	});

	it('unlocks app when biometric authentication succeeds', async () => {
		useAppLockStore.setState({ isLockEnabled: true, isLocked: true, showPasscodeFallback: false });

		vi.spyOn(biometricService, 'authenticate').mockResolvedValue({
			success: true
		});

		const success = await useAppLockStore.getState().triggerBiometricPrompt();
		expect(success).toBe(true);
		expect(useAppLockStore.getState().isLocked).toBe(false);
	});
});
