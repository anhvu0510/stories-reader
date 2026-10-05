import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { biometricService } from '@/services/biometricService';
import { isValidTimePasscode } from '@/services/secretServerService';

/**
 * Kiểm tra xem ứng dụng có đang chạy trên môi trường di động Android hay không
 */
export function isAndroidApp(): boolean {
	return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

interface AppLockStore {
	isLockEnabled: boolean;
	isLocked: boolean;
	showPasscodeFallback: boolean;
	isAuthenticating: boolean;

	// Actions
	lock: () => void;
	unlock: () => void;
	enableLockAfterPasscode: () => void;
	disableLock: () => void;
	setShowPasscodeFallback: (show: boolean) => void;
	triggerBiometricPrompt: () => Promise<boolean>;
	verifyAndUnlockWithPasscode: (code: string) => boolean;
}

const STORAGE_KEY_SESSION_UNLOCKED = 'stories_session_unlocked';

function isSessionUnlocked(): boolean {
	try {
		return sessionStorage.getItem(STORAGE_KEY_SESSION_UNLOCKED) === 'true';
	} catch {
		return false;
	}
}

function setSessionUnlocked(unlocked: boolean) {
	try {
		if (unlocked) {
			sessionStorage.setItem(STORAGE_KEY_SESSION_UNLOCKED, 'true');
		} else {
			sessionStorage.removeItem(STORAGE_KEY_SESSION_UNLOCKED);
		}
	} catch {}
}

export const useAppLockStore = create<AppLockStore>((set, get) => {
	const initialLockEnabled = isAndroidApp() && biometricService.isBiometricLockEnabled();
	const initialUnlocked = isSessionUnlocked();

	return {
		isLockEnabled: initialLockEnabled,
		// Passcode/AppLock chỉ áp dụng cho Android; phiên chưa mở khóa thì mới khóa ứng dụng
		isLocked: isAndroidApp() && initialLockEnabled && !initialUnlocked,
		showPasscodeFallback: false,
		isAuthenticating: false,

		lock: () => {
			// Tuyệt đối không khóa trên nền tảng web hoặc khi chưa bật bảo mật
			if (!isAndroidApp() || !get().isLockEnabled) return;
			setSessionUnlocked(false);
			void biometricService.cancel();
			set({
				isLocked: true,
				showPasscodeFallback: false,
				isAuthenticating: false
			});
		},

		unlock: () => {
			setSessionUnlocked(true);
			set({
				isLocked: false,
				showPasscodeFallback: false,
				isAuthenticating: false
			});
		},

		enableLockAfterPasscode: () => {
			// Chỉ áp dụng kích hoạt khóa bảo mật trên mobile Android, không áp dụng cho web
			if (!isAndroidApp()) return;
			biometricService.setBiometricLockEnabled(true);
			setSessionUnlocked(true);
			set({
				isLockEnabled: true,
				isLocked: false,
				showPasscodeFallback: false,
				isAuthenticating: false
			});
		},

		disableLock: () => {
			biometricService.setBiometricLockEnabled(false);
			setSessionUnlocked(false);
			set({
				isLockEnabled: false,
				isLocked: false,
				showPasscodeFallback: false,
				isAuthenticating: false
			});
		},

		setShowPasscodeFallback: (show: boolean) => {
			set({ showPasscodeFallback: show });
		},

		triggerBiometricPrompt: async () => {
			// Không chạy trên web
			if (!isAndroidApp()) return false;

			// TUYỆT ĐỐI không gọi khi app đang ở background / ẩn màn hình
			if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
				return false;
			}

			const { isLocked } = get();
			if (!isLocked) return false;

			set({ isAuthenticating: true });

			// Timeout an toàn tự reset cờ nếu không có phản hồi từ native trong 8s
			const safetyTimer = setTimeout(() => {
				if (get().isAuthenticating) {
					set({ isAuthenticating: false });
				}
			}, 8000);

			try {
				const result = await biometricService.authenticate({
					title: 'Xác thực bảo mật',
					subtitle: 'Quét sinh trắc học để tiếp tục sử dụng Stories Reader',
					negativeButtonText: 'Passcode'
				});

				clearTimeout(safetyTimer);
				set({ isAuthenticating: false });

				if (result.success) {
					get().unlock();
					return true;
				}

				// Nếu người dùng chọn 'Nhập Passcode' hoặc bị hủy / lỗi
				if (result.fallbackToPasscode) {
					set({ showPasscodeFallback: true });
				}
				return false;
			} catch (error) {
				clearTimeout(safetyTimer);
				console.error('[AppLockStore] Lỗi khi kích hoạt sinh trắc học:', error);
				set({
					isAuthenticating: false,
					showPasscodeFallback: true
				});
				return false;
			}
		},

		verifyAndUnlockWithPasscode: (code: string) => {
			const isValid = isValidTimePasscode(code);
			if (isValid) {
				get().unlock();
				return true;
			}
			return false;
		}
	};
});
