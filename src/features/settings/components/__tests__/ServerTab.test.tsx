// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

import { ServerTab } from '../ServerTab';
import { AppUpdateService } from '@/services/appUpdateService';
import { useToastStore } from '@/stores/useToastStore';

describe('ServerTab Component (Sync and OTA Update Check UI)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useToastStore.setState({ toasts: [] });
	});

	afterEach(() => {
		cleanup();
	});

	it('renders server API list and update reload button without separate OTA card', async () => {
		vi.spyOn(AppUpdateService, 'getCurrentAppInfo').mockResolvedValue({
			version: '1.0.3',
			isBuiltin: true,
			native: '1.0.3'
		});

		render(<ServerTab />);

		expect(screen.getByText('Danh sách Máy chủ API')).toBeDefined();
		expect(screen.getByRole('button', { name: /Cập nhật/i })).toBeDefined();
		// OTA card section was removed
		expect(screen.queryByText('Phiên bản & Cập nhật OTA')).toBeNull();
	});

	it('triggers check for update when reload button is clicked and shows toast if latest', async () => {
		vi.spyOn(AppUpdateService, 'getCurrentAppInfo').mockResolvedValue({
			version: '1.0.3',
			isBuiltin: true,
			native: '1.0.3'
		});

		const checkSpy = vi.spyOn(AppUpdateService, 'checkForUpdate').mockResolvedValue(null);

		render(<ServerTab />);

		const updateButton = screen.getByRole('button', { name: /Cập nhật/i });
		fireEvent.click(updateButton);

		await waitFor(() => {
			expect(checkSpy).toHaveBeenCalled();
			expect(useToastStore.getState().toasts.some((t) => t.message.includes('phiên bản mới nhất'))).toBe(true);
		});
	});

	it('downloads and applies update when newer version is found on reload', async () => {
		vi.spyOn(AppUpdateService, 'getCurrentAppInfo').mockResolvedValue({
			version: '1.0.3',
			isBuiltin: true,
			native: '1.0.3'
		});

		const checkSpy = vi.spyOn(AppUpdateService, 'checkForUpdate').mockResolvedValue({
			version: '1.0.4',
			bundleUrl: 'https://example.com/ota/bundle.zip',
			checksum: 'dummy-checksum'
		});

		const applySpy = vi.spyOn(AppUpdateService, 'downloadAndApplyUpdate').mockResolvedValue(true);

		render(<ServerTab />);

		const updateButton = screen.getByRole('button', { name: /Cập nhật/i });
		fireEvent.click(updateButton);

		await waitFor(() => {
			expect(checkSpy).toHaveBeenCalled();
			expect(applySpy).toHaveBeenCalledWith(
				expect.objectContaining({ version: '1.0.4' }),
				expect.any(Function)
			);
		});
	});
});
