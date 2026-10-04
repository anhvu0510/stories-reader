import { create } from 'zustand';
import { biometricService } from '@/services/biometricService';
import { isValidTimePasscode } from '@/services/secretServerService';

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
	const initialLockEnabled = biometricService.isBiometricLockEnabled();
	const initialUnlocked = isSessionUnlocked();

	return {
		isLockEnabled: initialLockEnabled,
		// Nếu đã kích hoạt khóa sinh trắc học và phiên chưa được mở khóa thì khóa ứng dụng
		isLocked: initialLockEnabled && !initialUnlocked,
		showPasscodeFallback: false,
		isAuthenticating: false,

		lock: () => {
			if (!get().isLockEnabled) return;
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
