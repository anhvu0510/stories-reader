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
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				// Khi ứng dụng bị sleep, tắt màn hình hoặc đưa xuống background
				if (useAppLockStore.getState().isLockEnabled) {
					lock();
				}
			} else if (document.visibilityState === 'visible') {
				// Khi người dùng mở lại ứng dụng từ background
				if (useAppLockStore.getState().isLocked) {
					// Chờ 300ms để WebView và Activity ổn định rồi kích hoạt prompt
					setTimeout(() => {
						triggerBiometricPrompt();
					}, 300);
				}
			}
		};

		const handlePageHide = () => {
			if (useAppLockStore.getState().isLockEnabled) {
				lock();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHide);
		};
	}, [isLockEnabled, isLocked, lock, triggerBiometricPrompt]);
}
