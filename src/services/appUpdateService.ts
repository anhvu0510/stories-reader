import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

import { useAppStore } from '@/stores/useAppStore';

import { isNativeDebugBuild } from './debugRuntime';
import { getEncryptedDefaultGatewayUrl } from './secretServerService';

export interface UpdateManifest {
	version: string;
	bundleUrl: string;
	checksum?: string;
	releaseNotes?: string;
	updatedAt?: string;
}

export interface AppInfo {
	version: string;
	isBuiltin: boolean;
	native: string;
	bundleId?: string;
}

declare const __APP_VERSION__: string | undefined;
export const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '1.0.4';
export const DEFAULT_UPDATE_ENDPOINT = 'https://anhvu0510.github.io/stories-reader/ota/version.json';
export const FALLBACK_UPDATE_ENDPOINT = '';

/**
 * Compare two semantic version strings (e.g. "1.0.1" vs "1.0.0")
 * Returns true if remote is strictly greater than current.
 */
export function isNewerVersion(remote: string, current: string): boolean {
	const parse = (v: string) => v.split('.').map((part) => parseInt(part, 10) || 0);
	const rParts = parse(remote);
	const cParts = parse(current);

	const length = Math.max(rParts.length, cParts.length);
	for (let i = 0; i < length; i++) {
		const r = rParts[i] ?? 0;
		const c = cParts[i] ?? 0;
		if (r > c) return true;
		if (r < c) return false;
	}

	return false;
}

export class AppUpdateService {
	/**
	 * Signal to CapacitorUpdater that the app loaded successfully.
	 * Must be called early on boot to prevent automatic rollback.
	 */
	static async notifyAppReady(): Promise<void> {
		if (Capacitor.getPlatform() !== 'android') return;

		try {
			await CapacitorUpdater.notifyAppReady();
		} catch (err) {
			console.warn('[AppUpdateService] notifyAppReady ignored:', err);
		}
	}

	/**
	 * Get current active app version and bundle state.
	 */
	static async getCurrentAppInfo(): Promise<AppInfo> {
		if (Capacitor.getPlatform() !== 'android') {
			return {
				version: CURRENT_APP_VERSION,
				isBuiltin: true,
				native: CURRENT_APP_VERSION,
			};
		}

		try {
			const res = await CapacitorUpdater.current();
			const bundleVer = res.bundle?.version;
			const nativeVer = res.native || CURRENT_APP_VERSION;
			const isBuiltin = !res.bundle?.id || res.bundle.id === 'builtin';
			const version = bundleVer || nativeVer;

			return {
				version,
				isBuiltin,
				native: nativeVer,
				bundleId: res.bundle?.id,
			};
		} catch (err) {
			console.warn('[AppUpdateService] getCurrentAppInfo ignored:', err);
			return {
				version: CURRENT_APP_VERSION,
				isBuiltin: true,
				native: CURRENT_APP_VERSION,
			};
		}
	}

	private static async resolveCheckVersion(currentVer?: string): Promise<string> {
		if (currentVer) return currentVer;
		const appInfo = await this.getCurrentAppInfo();
		return appInfo.version;
	}

	private static parseManifest(data: UpdateManifest | null | undefined, checkVer: string): UpdateManifest | null {
		if (!data?.version || !data?.bundleUrl) return null;
		if (isNewerVersion(data.version, checkVer)) return data;
		return null;
	}

	/**
	 * Check if a new OTA update bundle is available on the server.
	 */
	static async checkForUpdate(endpoint = DEFAULT_UPDATE_ENDPOINT, currentVer?: string): Promise<UpdateManifest | null> {
		if (isNativeDebugBuild() || Capacitor.getPlatform() !== 'android') return null;

		try {
			const checkVer = await this.resolveCheckVersion(currentVer);
			const res = await this.fetchManifestResponse(endpoint);
			if (!res?.ok) return null;

			const data = (await res.json()) as UpdateManifest;
			return this.parseManifest(data, checkVer);
		} catch (err) {
			console.warn('[AppUpdateService] Checking update failed or offline:', err);
			return null;
		}
	}

	private static async fetchJsonNoStore(url: string): Promise<Response | null> {
		try {
			return await fetch(url, {
				headers: { Accept: 'application/json' },
				cache: 'no-store',
			});
		} catch {
			return null;
		}
	}

	private static async fetchManifestResponse(endpoint: string): Promise<Response | null> {
		// Primary failed, will attempt fallback below
		const primary = await this.fetchJsonNoStore(endpoint);
		if (primary?.ok) return primary;

		const activeDomainUrl = useAppStore.getState().activeDomain?.url || getEncryptedDefaultGatewayUrl();
		if (!activeDomainUrl) return null;
		return await this.fetchJsonNoStore(`${activeDomainUrl.replace(/\/+$/, '')}/api/app-update/version`);
	}

	/**
	 * Download the OTA update bundle and apply it to reload the app.
	 */
	static async downloadAndApplyUpdate(manifest: UpdateManifest, onProgress?: (percent: number) => void): Promise<boolean> {
		if (isNativeDebugBuild()) return false;
		try {
			let listenerHandle: { remove: () => void } | null = null;
			if (onProgress) {
				listenerHandle = await CapacitorUpdater.addListener('download', (info: { percent: number }) => {
					onProgress(info.percent);
				});
			}

			const bundle = await CapacitorUpdater.download({
				url: manifest.bundleUrl,
				version: manifest.version,
				checksum: manifest.checksum,
			});

			if (listenerHandle) {
				listenerHandle.remove();
			}

			await CapacitorUpdater.set(bundle);
			return true;
		} catch (err) {
			console.error('[AppUpdateService] Failed to download or apply OTA update:', err);
			return false;
		}
	}
}
