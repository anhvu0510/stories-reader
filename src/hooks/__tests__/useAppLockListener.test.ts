// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { useAppLockListener, APP_LOCK_GRACE_PERIOD_MS } from '../useAppLockListener';
import { useAppLockStore } from '@/stores/useAppLockStore';

describe('useAppLockListener Hook', () => {
	beforeEach(() => {
		sessionStorage.clear();
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
		vi.restoreAllMocks();
	});

	describe('Nền tảng Web (không áp dụng khóa app / passcode khi chuyển tab)', () => {
		beforeEach(() => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
		});

		it('không khóa ứng dụng khi document ẩn trên nền tảng web', () => {
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: false
			});

			renderHook(() => useAppLockListener());

			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'hidden'
			});
			document.dispatchEvent(new Event('visibilitychange'));

			expect(useAppLockStore.getState().isLocked).toBe(false);
		});
	});

	describe('Nền tảng Mobile Android', () => {
		beforeEach(() => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
		});

		it('KHÔNG khóa ứng dụng nếu vào lại trong vòng 30 giây sau khi down app', () => {
			vi.useFakeTimers();
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: false
			});

			renderHook(() => useAppLockListener());

			// Người dùng đưa app xuống background
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'hidden'
			});
			document.dispatchEvent(new Event('visibilitychange'));

			// Ngay khi vừa down app: app chưa khóa
			expect(useAppLockStore.getState().isLocked).toBe(false);

			// Trôi qua 15 giây (dưới 30s)
			vi.advanceTimersByTime(15000);

			// Người dùng vào lại app trong vòng 30s
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'visible'
			});
			document.dispatchEvent(new Event('visibilitychange'));

			// App vẫn mở bình thường, không bắt nhập passcode
			expect(useAppLockStore.getState().isLocked).toBe(false);

			vi.useRealTimers();
		});

		it('tự động khóa ứng dụng nếu ở background quá 30 giây (timer hết hạn)', () => {
			vi.useFakeTimers();
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: false
			});

			renderHook(() => useAppLockListener());

			// Người dùng đưa app xuống background
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'hidden'
			});
			document.dispatchEvent(new Event('visibilitychange'));

			expect(useAppLockStore.getState().isLocked).toBe(false);

			// Trôi qua 30 giây ở background
			vi.advanceTimersByTime(APP_LOCK_GRACE_PERIOD_MS);

			// App đã tự động bị khóa
			expect(useAppLockStore.getState().isLocked).toBe(true);

			vi.useRealTimers();
		});

		it('bắt nhập passcode (khóa app) khi vào lại sau hơn 30 giây', () => {
			vi.useFakeTimers();
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: false
			});

			renderHook(() => useAppLockListener());

			// Down app xuống background
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'hidden'
			});
			document.dispatchEvent(new Event('visibilitychange'));

			// Trôi qua 35 giây
			vi.advanceTimersByTime(35000);

			// Người dùng vào lại app sau 35s
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'visible'
			});
			document.dispatchEvent(new Event('visibilitychange'));

			// App bắt buộc phải bị khóa
			expect(useAppLockStore.getState().isLocked).toBe(true);

			vi.useRealTimers();
		});

		it('kích hoạt prompt xác thực khi app mở lại từ trạng thái đã khóa', () => {
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
});
