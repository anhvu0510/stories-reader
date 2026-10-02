// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppUpdate } from '../useAppUpdate';
import { AppUpdateService } from '@/services/appUpdateService';

describe('useAppUpdate Hook (TDD)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should call notifyAppReady and check for update on mount', async () => {
		const notifySpy = vi.spyOn(AppUpdateService, 'notifyAppReady').mockResolvedValue(undefined);
		const checkSpy = vi.spyOn(AppUpdateService, 'checkForUpdate').mockResolvedValue(null);

		const { result } = renderHook(() => useAppUpdate({ autoCheck: true }));

		await waitFor(() => {
			expect(notifySpy).toHaveBeenCalled();
			expect(checkSpy).toHaveBeenCalled();
		});

		expect(result.current.isUpdating).toBe(false);
	});

	it('should trigger update flow and update progress when update is available', async () => {
		vi.spyOn(AppUpdateService, 'notifyAppReady').mockResolvedValue(undefined);
		vi.spyOn(AppUpdateService, 'checkForUpdate').mockResolvedValue({
			version: '1.0.1',
			bundleUrl: 'https://mock.api/bundle.zip'
		});

		vi.spyOn(AppUpdateService, 'downloadAndApplyUpdate').mockImplementation(async (_m, onProg) => {
			onProg?.(45);
			return true;
		});

		const { result } = renderHook(() => useAppUpdate({ autoCheck: true }));

		await waitFor(() => {
			expect(result.current.isUpdating).toBe(true);
		});

		expect(result.current.progress).toBe(45);
	});
});
