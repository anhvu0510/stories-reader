import { useState, useEffect, useCallback, useRef } from 'react';
import { AppUpdateService, UpdateManifest, AppInfo, CURRENT_APP_VERSION } from '@/services/appUpdateService';

export interface UseAppUpdateOptions {
	autoCheck?: boolean;
	endpoint?: string;
}

export interface UseAppUpdateReturn {
	appInfo: AppInfo;
	isChecking: boolean;
	isUpdating: boolean;
	progress: number;
	statusMessage: string;
	error: string | null;
	checkForUpdate: () => Promise<UpdateManifest | null>;
	applyUpdate: (manifest: UpdateManifest) => Promise<boolean>;
}

export function useAppUpdate(options: UseAppUpdateOptions = {}): UseAppUpdateReturn {
	const { autoCheck = true, endpoint } = options;

	const [appInfo, setAppInfo] = useState<AppInfo>({
		version: CURRENT_APP_VERSION,
		isBuiltin: true,
		native: CURRENT_APP_VERSION
	});
	const [isChecking, setIsChecking] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [progress, setProgress] = useState(0);
	const [statusMessage, setStatusMessage] = useState('');
	const [error, setError] = useState<string | null>(null);

	const isMountedRef = useRef(true);

	const refreshAppInfo = useCallback(async () => {
		try {
			const info = await AppUpdateService.getCurrentAppInfo();
			if (isMountedRef.current) {
				setAppInfo(info);
			}
			return info;
		} catch (err) {
			console.debug('[useAppUpdate] refreshAppInfo error:', err);
			return null;
		}
	}, []);

	const applyUpdate = useCallback(async (manifest: UpdateManifest): Promise<boolean> => {
		setIsUpdating(true);
		setStatusMessage('Đang tải bản cập nhật mới...');
		setProgress(0);

		try {
			const success = await AppUpdateService.downloadAndApplyUpdate(manifest, (percent) => {
				if (isMountedRef.current) {
					setProgress(percent);
					setStatusMessage(`Đang tải bản cập nhật: ${percent}%`);
				}
			});

			if (!success && isMountedRef.current) {
				setIsUpdating(false);
				setError('Tải bản cập nhật thất bại');
			}
			return success;
		} catch {
			if (isMountedRef.current) {
				setIsUpdating(false);
				setError('Có lỗi xảy ra khi cập nhật');
			}
			return false;
		}
	}, []);

	const checkForUpdate = useCallback(async (): Promise<UpdateManifest | null> => {
		try {
			setIsChecking(true);
			setError(null);

			await refreshAppInfo();
			const manifest = await AppUpdateService.checkForUpdate(endpoint);
			return manifest;
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Kiểm tra cập nhật thất bại';
			setError(msg);
			return null;
		} finally {
			if (isMountedRef.current) {
				setIsChecking(false);
			}
		}
	}, [endpoint, refreshAppInfo]);

	useEffect(() => {
		isMountedRef.current = true;

		// Notify that current version is healthy
		AppUpdateService.notifyAppReady();

		refreshAppInfo();

		if (!autoCheck) {
			return () => {
				isMountedRef.current = false;
			};
		}

		let active = true;
		const runUpdateFlow = async () => {
			const manifest = await checkForUpdate();
			if (!manifest || !active) return;

			await applyUpdate(manifest);
		};

		runUpdateFlow();

		return () => {
			active = false;
			isMountedRef.current = false;
		};
	}, [autoCheck, checkForUpdate, applyUpdate, refreshAppInfo]);

	return {
		appInfo,
		isChecking,
		isUpdating,
		progress,
		statusMessage,
		error,
		checkForUpdate,
		applyUpdate
	};
}

