// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AppLockOverlay } from '../AppLockOverlay';
import { useAppLockStore } from '@/stores/useAppLockStore';
import { biometricService } from '@/services/biometricService';

describe('AppLockOverlay Component', () => {
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

	it('renders nothing when isLocked is false', () => {
		const { container } = render(<AppLockOverlay />);
		expect(container.firstChild).toBeNull();
	});

	it('renders lock screen overlay when isLocked is true', () => {
		useAppLockStore.setState({
			isLockEnabled: true,
			isLocked: true,
			showPasscodeFallback: false
		});

		render(<AppLockOverlay />);

		expect(screen.getByText('Stories Reader')).toBeDefined();
		expect(screen.getByText(/Ứng dụng đang được khóa bảo vệ/i)).toBeDefined();
		expect(screen.getByRole('button', { name: /Mở khóa bằng Passcode/i })).toBeDefined();
	});

	it('switches to passcode fallback modal when clicking Passcode button', async () => {
		useAppLockStore.setState({
			isLockEnabled: true,
			isLocked: true,
			showPasscodeFallback: false
		});

		render(<AppLockOverlay />);

		const passcodeBtn = screen.getByRole('button', { name: /Mở khóa bằng Passcode/i });
		fireEvent.click(passcodeBtn);

		expect(useAppLockStore.getState().showPasscodeFallback).toBe(true);

		await waitFor(() => {
			expect(screen.getByText('Mở khóa Ứng dụng')).toBeDefined();
			expect(screen.getByText(/Nhập mã Passcode \(HHMMDDMM\)/i)).toBeDefined();
		});
	});

	it('triggers biometric prompt when clicking Quét Sinh trắc học button', async () => {
		const promptSpy = vi.spyOn(biometricService, 'authenticate').mockResolvedValue({
			success: true
		});

		useAppLockStore.setState({
			isLockEnabled: true,
			isLocked: true,
			showPasscodeFallback: false
		});

		render(<AppLockOverlay />);

		// Tìm button "Quét Sinh trắc học"
		const bioButtons = screen.getAllByRole('button');
		const bioBtn = bioButtons.find((btn) => btn.textContent?.includes('Quét Sinh trắc học'));
		expect(bioBtn).toBeDefined();

		if (bioBtn) {
			fireEvent.click(bioBtn);
		}

		expect(promptSpy).toHaveBeenCalled();
	});
});
