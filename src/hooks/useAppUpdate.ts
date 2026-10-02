import { useState, useEffect, useCallback, useRef } from 'react';
import { AppUpdateService, UpdateManifest } from '@/services/appUpdateService';

export interface UseAppUpdateOptions {
	autoCheck?: boolean;
	endpoint?: string;
}

export interface UseAppUpdateReturn {
	isChecking: boolean;
	isUpdating: boolean;
	progress: number;
	statusMessage: string;
	error: string | null;
	checkForUpdate: () => Promise<UpdateManifest | null>;
}

export function useAppUpdate(options: UseAppUpdateOptions = {}): UseAppUpdateReturn {
	const { autoCheck = true, endpoint } = options;

	const [isChecking, setIsChecking] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [progress, setProgress] = useState(0);
	const [statusMessage, setStatusMessage] = useState('');
	const [error, setError] = useState<string | null>(null);

	const isMountedRef = useRef(true);

	const checkForUpdate = useCallback(async (): Promise<UpdateManifest | null> => {
		try {
			setIsChecking(true);
			setError(null);

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
	}, [endpoint]);

	useEffect(() => {
		isMountedRef.current = true;

		// Notify that current version is healthy
		AppUpdateService.notifyAppReady();

		if (!autoCheck) {
			return () => {
				isMountedRef.current = false;
			};
		}

		let active = true;
		const runUpdateFlow = async () => {
			const manifest = await checkForUpdate();
			if (!manifest || !active) return;

			setIsUpdating(true);
			setStatusMessage('Đang tải bản cập nhật mới...');
			setProgress(0);

			const success = await AppUpdateService.downloadAndApplyUpdate(manifest, (percent) => {
				if (active) {
					setProgress(percent);
					setStatusMessage(`Đang tải bản cập nhật: ${percent}%`);
				}
			});

			if (!success && active) {
				setIsUpdating(false);
				setError('Tải bản cập nhật thất bại');
			}
		};

		runUpdateFlow();

		return () => {
			active = false;
			isMountedRef.current = false;
		};
	}, [autoCheck, checkForUpdate]);

	return {
		isChecking,
		isUpdating,
		progress,
		statusMessage,
		error,
		checkForUpdate
	};
}
