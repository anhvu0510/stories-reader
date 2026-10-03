// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { ServerTab } from '../ServerTab';
import { AppUpdateService } from '@/services/appUpdateService';
import { useToastStore } from '@/stores/useToastStore';

describe('ServerTab Component (OTA Version Tracking UI)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useToastStore.setState({ toasts: [] });
	});

	afterEach(() => {
		cleanup();
	});

	it('renders version tracking section and displays active version', async () => {
		vi.spyOn(AppUpdateService, 'getCurrentAppInfo').mockResolvedValue({
			version: '1.0.1',
			isBuiltin: true,
			native: '1.0.1'
		});

		render(<ServerTab />);

		expect(screen.getByText('Phiên bản & Cập nhật OTA')).toBeDefined();
		expect(screen.getAllByText(/v1\.0\./).length).toBeGreaterThan(0);
	});

	it('triggers manual check for update when button is clicked', async () => {
		vi.spyOn(AppUpdateService, 'getCurrentAppInfo').mockResolvedValue({
			version: '1.0.1',
			isBuiltin: true,
			native: '1.0.1'
		});

		const checkSpy = vi.spyOn(AppUpdateService, 'checkForUpdate').mockResolvedValue(null);

		render(<ServerTab />);

		const checkButton = screen.getByRole('button', { name: /Kiểm tra cập nhật/i });
		fireEvent.click(checkButton);

		await waitFor(() => {
			expect(checkSpy).toHaveBeenCalled();
		});
	});

	it('shows update available banner when a newer version is found', async () => {
		vi.spyOn(AppUpdateService, 'getCurrentAppInfo').mockResolvedValue({
			version: '1.0.0',
			isBuiltin: true,
			native: '1.0.0'
		});

		vi.spyOn(AppUpdateService, 'checkForUpdate').mockResolvedValue({
			version: '1.0.2',
			bundleUrl: 'https://example.com/ota/bundle.zip',
			releaseNotes: 'Cập nhật tính năng mới'
		});

		render(<ServerTab />);

		const checkButton = screen.getByRole('button', { name: /Kiểm tra cập nhật/i });
		fireEvent.click(checkButton);

		await waitFor(() => {
			expect(screen.getByText(/Có bản cập nhật mới v1.0.2/)).toBeDefined();
			expect(screen.getByText('Cập nhật ngay')).toBeDefined();
			expect(screen.getByText('Cập nhật tính năng mới')).toBeDefined();
		});
	});
});
