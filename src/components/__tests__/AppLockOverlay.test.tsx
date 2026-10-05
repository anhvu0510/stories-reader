// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { AppLockOverlay } from '../AppLockOverlay';
import { useAppLockStore } from '@/stores/useAppLockStore';
import { biometricService } from '@/services/biometricService';

describe('AppLockOverlay Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(document, 'visibilityState', {
			value: 'visible',
			configurable: true
		});
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

	describe('Nền tảng Web (không áp dụng màn hình khóa)', () => {
		beforeEach(() => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
		});

		it('luôn trả về null trên nền tảng web kể cả khi isLocked là true', () => {
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: true,
				showPasscodeFallback: false
			});

			const { container } = render(<AppLockOverlay />);
			expect(container.firstChild).toBeNull();
		});
	});

	describe('Nền tảng Mobile Android', () => {
		beforeEach(() => {
			vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
			vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
		});

		it('không hiển thị khi isLocked là false', () => {
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: false,
				showPasscodeFallback: false
			});

			const { container } = render(<AppLockOverlay />);
			expect(container.firstChild).toBeNull();
		});

		it('hiển thị màn hình khóa bảo mật khi isLocked là true trên Android', () => {
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: true,
				showPasscodeFallback: false
			});

			render(<AppLockOverlay />);

			expect(screen.getByText('Stories Reader')).toBeDefined();
			expect(screen.getByText(/Ứng dụng đang được khóa bảo vệ/i)).toBeDefined();
			expect(screen.getByRole('button', { name: /Passcode/i })).toBeDefined();
		});

		it('chuyển sang modal nhập passcode khi nhấn nút Passcode', async () => {
			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: true,
				showPasscodeFallback: false
			});

			render(<AppLockOverlay />);

			const passcodeBtn = screen.getByRole('button', { name: /Passcode/i });
			fireEvent.click(passcodeBtn);

			expect(useAppLockStore.getState().showPasscodeFallback).toBe(true);

			await waitFor(() => {
				expect(screen.getByText('Mở khóa Ứng dụng')).toBeDefined();
				expect(screen.getByText(/Nhập mã Passcode/i)).toBeDefined();
			});
		});

		it('kích hoạt prompt sinh trắc học khi nhấn nút Quét Sinh trắc học', async () => {
			const promptSpy = vi.spyOn(biometricService, 'authenticate').mockResolvedValue({
				success: true
			});

			useAppLockStore.setState({
				isLockEnabled: true,
				isLocked: true,
				showPasscodeFallback: false
			});

			render(<AppLockOverlay />);

			const bioButtons = screen.getAllByRole('button');
			const bioBtn = bioButtons.find((btn) => btn.textContent?.includes('Quét Sinh trắc học'));
			expect(bioBtn).toBeDefined();

			if (bioBtn) {
				fireEvent.click(bioBtn);
			}

			expect(promptSpy).toHaveBeenCalled();
		});
	});
});
