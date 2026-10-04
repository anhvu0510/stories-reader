import { useEffect } from 'react';
import { useAppLockStore } from '@/stores/useAppLockStore';

/**
 * Hook quản lý vòng đời ứng dụng (sleep / resume) cho tính năng khóa bảo mật sinh trắc học.
 * Khi ứng dụng bị sleep hoặc chuyển vào background: tự động khóa ứng dụng.
 * Khi ứng dụng mở lại hoặc active: tự động yêu cầu xác thực sinh trắc học.
 */
export function useAppLockListener() {
	const isLockEnabled = useAppLockStore((state) => state.isLockEnabled);
	const isLocked = useAppLockStore((state) => state.isLocked);
	const lock = useAppLockStore((state) => state.lock);
	const triggerBiometricPrompt = useAppLockStore((state) => state.triggerBiometricPrompt);

	useEffect(() => {
		let resumeTimer: NodeJS.Timeout | null = null;

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				if (resumeTimer) {
					clearTimeout(resumeTimer);
					resumeTimer = null;
				}
				// Khi ứng dụng bị sleep, tắt màn hình hoặc đưa xuống background: lập tức khóa
				if (useAppLockStore.getState().isLockEnabled) {
					lock();
				}
			} else if (document.visibilityState === 'visible') {
				// Khi người dùng mở lại ứng dụng từ background
				if (useAppLockStore.getState().isLocked) {
					// Đảm bảo xóa trạng thái treo từ phiên trước
					useAppLockStore.setState({ isAuthenticating: false });

					// Chờ 400ms để Android Activity onResume hoàn tất trước khi mở hộp thoại
					resumeTimer = setTimeout(() => {
						if (document.visibilityState === 'visible' && useAppLockStore.getState().isLocked) {
							triggerBiometricPrompt();
						}
					}, 400);
				}
			}
		};

		const handlePageHide = () => {
			if (resumeTimer) {
				clearTimeout(resumeTimer);
				resumeTimer = null;
			}
			if (useAppLockStore.getState().isLockEnabled) {
				lock();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);

		return () => {
			if (resumeTimer) {
				clearTimeout(resumeTimer);
			}
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHide);
		};
	}, [isLockEnabled, isLocked, lock, triggerBiometricPrompt]);
}
