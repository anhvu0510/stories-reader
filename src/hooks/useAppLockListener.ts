import { useEffect } from 'react';
import { useAppLockStore, isAndroidApp } from '@/stores/useAppLockStore';

/**
 * Ngưỡng thời gian chờ trước khi khóa ứng dụng và bắt nhập passcode (30 giây)
 */
export const APP_LOCK_GRACE_PERIOD_MS = 30 * 1000;

/**
 * Key lưu thời điểm app bị đưa xuống background trong sessionStorage
 */
export const STORAGE_KEY_LAST_HIDDEN = 'stories_app_last_hidden_time';

/**
 * Hook quản lý vòng đời ứng dụng (sleep / resume) cho tính năng khóa bảo mật sinh trắc học và Passcode.
 * Chỉ áp dụng trên môi trường mobile Android, không áp dụng trên Web.
 * Khi ứng dụng bị down (background/sleep), nếu trong vòng 30s không vào lại thì bắt nhập passcode.
 */
export function useAppLockListener() {
	const isLockEnabled = useAppLockStore((state) => state.isLockEnabled);
	const isLocked = useAppLockStore((state) => state.isLocked);
	const lock = useAppLockStore((state) => state.lock);
	const triggerBiometricPrompt = useAppLockStore((state) => state.triggerBiometricPrompt);

	useEffect(() => {
		// Passcode và màn hình khóa chỉ áp dụng cho mobile Android, không áp dụng trên Web
		if (!isAndroidApp()) return;

		let resumeTimer: NodeJS.Timeout | null = null;
		let gracePeriodTimer: NodeJS.Timeout | null = null;
		let lastHiddenTimestamp: number | null = null;

		const handleAppHidden = () => {
			if (resumeTimer) {
				clearTimeout(resumeTimer);
				resumeTimer = null;
			}

			// Nếu tính năng khóa chưa được bật hoặc app đã bị khóa sẵn thì không cần đếm giờ
			const state = useAppLockStore.getState();
			if (!state.isLockEnabled || state.isLocked) return;

			// Ghi lại mốc thời gian khi app bắt đầu bị down (background)
			const now = Date.now();
			lastHiddenTimestamp = now;
			try {
				sessionStorage.setItem(STORAGE_KEY_LAST_HIDDEN, String(now));
			} catch {}

			// Đặt hẹn giờ: nếu sau 30 giây vẫn ở background thì tự động khóa app
			if (gracePeriodTimer) {
				clearTimeout(gracePeriodTimer);
			}
			gracePeriodTimer = setTimeout(() => {
				if (useAppLockStore.getState().isLockEnabled) {
					lock();
				}
			}, APP_LOCK_GRACE_PERIOD_MS);
		};

		const handleAppVisible = () => {
			// Hủy timer đếm ngược 30 giây khi người dùng quay lại
			if (gracePeriodTimer) {
				clearTimeout(gracePeriodTimer);
				gracePeriodTimer = null;
			}

			// Lấy mốc thời gian lúc app bị down
			let hiddenAt = lastHiddenTimestamp;
			if (!hiddenAt) {
				try {
					const saved = sessionStorage.getItem(STORAGE_KEY_LAST_HIDDEN);
					if (saved) hiddenAt = Number(saved);
				} catch {}
			}

			// Xóa mốc thời gian đã lưu để tránh tính lại
			lastHiddenTimestamp = null;
			try {
				sessionStorage.removeItem(STORAGE_KEY_LAST_HIDDEN);
			} catch {}

			// Nếu app chưa khóa nhưng đã quá 30 giây ở background: khóa app và bắt nhập passcode
			const currentState = useAppLockStore.getState();
			const elapsed = hiddenAt ? Date.now() - hiddenAt : 0;
			if (hiddenAt && currentState.isLockEnabled && !currentState.isLocked && elapsed >= APP_LOCK_GRACE_PERIOD_MS) {
				lock();
			}

			// Nếu app đang bị khóa: xóa trạng thái treo và kích hoạt prompt sinh trắc học / passcode
			if (useAppLockStore.getState().isLocked) {
				useAppLockStore.setState({ isAuthenticating: false });

				resumeTimer = setTimeout(() => {
					if (document.visibilityState === 'visible' && useAppLockStore.getState().isLocked) {
						triggerBiometricPrompt();
					}
				}, 400);
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				handleAppHidden();
				return;
			}

			if (document.visibilityState === 'visible') {
				handleAppVisible();
			}
		};

		const handlePageHide = () => {
			handleAppHidden();
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);

		return () => {
			if (resumeTimer) clearTimeout(resumeTimer);
			if (gracePeriodTimer) clearTimeout(gracePeriodTimer);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHide);
		};
	}, [isLockEnabled, isLocked, lock, triggerBiometricPrompt]);
}
