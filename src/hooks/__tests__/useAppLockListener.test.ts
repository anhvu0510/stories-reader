// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useAppLockListener } from '../useAppLockListener';
import { useAppLockStore } from '@/stores/useAppLockStore';

describe('useAppLockListener Hook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAppLockStore.setState({
			isLockEnabled: false,
			isLocked: false,
			showPasscodeFallback: false,
			isAuthenticating: false
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('locks the app when document visibilityState changes to hidden if lock is enabled', () => {
		useAppLockStore.setState({
			isLockEnabled: true,
			isLocked: false
		});

		renderHook(() => useAppLockListener());

		// Giả lập app chuyển vào background / sleep
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'hidden'
		});
		document.dispatchEvent(new Event('visibilitychange'));

		expect(useAppLockStore.getState().isLocked).toBe(true);
	});

	it('triggers biometric prompt when app becomes visible from locked state', () => {
		vi.useFakeTimers();
		const promptSpy = vi.spyOn(useAppLockStore.getState(), 'triggerBiometricPrompt');

		useAppLockStore.setState({
			isLockEnabled: true,
			isLocked: true
		});

		renderHook(() => useAppLockListener());

		// Giả lập app mở lại / active
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible'
		});
		document.dispatchEvent(new Event('visibilitychange'));

		vi.advanceTimersByTime(500);

		expect(promptSpy).toHaveBeenCalled();
		vi.useRealTimers();
	});
});
