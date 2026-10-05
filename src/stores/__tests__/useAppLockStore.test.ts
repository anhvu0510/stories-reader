// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
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

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Nền tảng Web (không áp dụng passcode / app lock)', () => {
		it('không kích hoạt bảo mật khi gọi enableLockAfterPasscode trên web', () => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

			useAppLockStore.getState().enableLockAfterPasscode();

			expect(useAppLockStore.getState().isLockEnabled).toBe(false);
			expect(useAppLockStore.getState().isLocked).toBe(false);
			expect(biometricService.isBiometricLockEnabled()).toBe(false);
		});

		it('không khóa ứng dụng khi gọi lock() trên web', () => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

			useAppLockStore.setState({ isLockEnabled: true, isLocked: false });
			useAppLockStore.getState().lock();

			expect(useAppLockStore.getState().isLocked).toBe(false);
		});
	});

	describe('Nền tảng Mobile Android', () => {
		beforeEach(() => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
		});

		it('kích hoạt khóa sinh trắc học và mở khóa session trên Android khi nhập passcode thành công', () => {
			useAppLockStore.getState().enableLockAfterPasscode();

			expect(useAppLockStore.getState().isLockEnabled).toBe(true);
			expect(useAppLockStore.getState().isLocked).toBe(false);
			expect(biometricService.isBiometricLockEnabled()).toBe(true);
		});

		it('khóa ứng dụng khi gọi lock() trên Android nếu lock đã được bật', () => {
			useAppLockStore.getState().enableLockAfterPasscode();
			expect(useAppLockStore.getState().isLocked).toBe(false);

			useAppLockStore.getState().lock();
			expect(useAppLockStore.getState().isLocked).toBe(true);
		});

		it('không khóa app nếu lock chưa được kích hoạt', () => {
			useAppLockStore.setState({ isLockEnabled: false, isLocked: false });
			useAppLockStore.getState().lock();
			expect(useAppLockStore.getState().isLocked).toBe(false);
		});

		it('mở khóa app khi gọi unlock()', () => {
			useAppLockStore.setState({ isLockEnabled: true, isLocked: true });
			useAppLockStore.getState().unlock();

			expect(useAppLockStore.getState().isLocked).toBe(false);
			expect(useAppLockStore.getState().showPasscodeFallback).toBe(false);
		});

		it('xác thực đúng mã time passcode và mở khóa app', () => {
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

		it('từ chối mã passcode sai và giữ nguyên trạng thái khóa', () => {
			useAppLockStore.setState({ isLockEnabled: true, isLocked: true });

			const result = useAppLockStore.getState().verifyAndUnlockWithPasscode('00000000');
			expect(result).toBe(false);
			expect(useAppLockStore.getState().isLocked).toBe(true);
		});

		it('hiển thị fallback passcode khi xác thực sinh trắc học bị hủy hoặc lỗi', async () => {
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

		it('mở khóa app khi xác thực sinh trắc học thành công', async () => {
			useAppLockStore.setState({ isLockEnabled: true, isLocked: true, showPasscodeFallback: false });

			vi.spyOn(biometricService, 'authenticate').mockResolvedValue({
				success: true
			});

			const success = await useAppLockStore.getState().triggerBiometricPrompt();
			expect(success).toBe(true);
			expect(useAppLockStore.getState().isLocked).toBe(false);
		});
	});
});
