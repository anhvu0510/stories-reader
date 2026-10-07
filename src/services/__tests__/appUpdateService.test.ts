import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppUpdateService, isNewerVersion } from '../appUpdateService';

// Mock @capacitor/core
vi.mock('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: vi.fn(),
		getPlatform: vi.fn()
	}
}));

// Mock @capgo/capacitor-updater
vi.mock('@capgo/capacitor-updater', () => ({
	CapacitorUpdater: {
		notifyAppReady: vi.fn().mockResolvedValue(undefined),
		current: vi.fn().mockResolvedValue({ bundle: { version: '1.0.0' } }),
		download: vi.fn().mockResolvedValue({ version: '1.0.1' }),
		set: vi.fn().mockResolvedValue(undefined),
		addListener: vi.fn().mockImplementation((_event, callback) => {
			return {
				remove: vi.fn()
			};
		})
	}
}));

describe('AppUpdateService Unit Tests (TDD)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Reflect.deleteProperty(globalThis, 'StoriesRuntime');
	});

	it('does not fetch or apply OTA in a native debug build', async () => {
		Reflect.set(globalThis, 'StoriesRuntime', { isDebugBuild: () => true });
		const { Capacitor } = await import('@capacitor/core');
		const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
		vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
		globalThis.fetch = vi.fn();
		expect(await AppUpdateService.checkForUpdate()).toBeNull();
		expect(await AppUpdateService.downloadAndApplyUpdate({ version: '9', bundleUrl: 'https://mock.api/bundle' })).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
		expect(CapacitorUpdater.download).not.toHaveBeenCalled();
		Reflect.deleteProperty(globalThis, 'StoriesRuntime');
	});

	describe('isNewerVersion helper', () => {
		it('should return true when remote is higher than current', () => {
			expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
			expect(isNewerVersion('1.2.0', '1.1.9')).toBe(true);
			expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
		});

		it('should return false when remote is equal or lower', () => {
			expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
			expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
			expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
		});
	});

	describe('checkForUpdate', () => {
		it('should return null when not running on Android platform', async () => {
			const { Capacitor } = await import('@capacitor/core');
			vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

			const manifest = await AppUpdateService.checkForUpdate('https://mock.api/version');
			expect(manifest).toBeNull();
		});

		it('should return manifest when running on Android and remote version is newer', async () => {
			const { Capacitor } = await import('@capacitor/core');
			vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

			const mockResponse = {
				version: '1.0.1',
				bundleUrl: 'https://mock.api/bundle.zip',
				releaseNotes: 'Performance improvements'
			};

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse)
			} as unknown as Response);

			const manifest = await AppUpdateService.checkForUpdate('https://mock.api/version', '1.0.0');
			expect(manifest).toEqual(mockResponse);
		});

		it('should return null and handle network failure gracefully without throwing', async () => {
			const { Capacitor } = await import('@capacitor/core');
			vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

			globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

			const manifest = await AppUpdateService.checkForUpdate('https://mock.api/version', '1.0.0');
			expect(manifest).toBeNull();
		});
	});

	describe('downloadAndApplyUpdate', () => {
		it('should call download and set on CapacitorUpdater', async () => {
			const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

			const manifest = {
				version: '1.0.1',
				bundleUrl: 'https://mock.api/bundle.zip',
				checksum: 'mock-sha256'
			};

			const onProgress = vi.fn();
			const success = await AppUpdateService.downloadAndApplyUpdate(manifest, onProgress);

			expect(success).toBe(true);
			expect(CapacitorUpdater.download).toHaveBeenCalledWith({
				url: 'https://mock.api/bundle.zip',
				version: '1.0.1',
				checksum: 'mock-sha256'
			});
			expect(CapacitorUpdater.set).toHaveBeenCalledWith({
				version: '1.0.1'
			});
		});
	});
});
