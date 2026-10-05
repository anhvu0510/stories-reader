import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Trạng thái khả dụng của phần cứng sinh trắc học
 */
export interface BiometricAvailability {
	isAvailable: boolean;
	hasHardware: boolean;
	isEnrolled: boolean;
	status: 'SUCCESS' | 'NO_HARDWARE' | 'HW_UNAVAILABLE' | 'NONE_ENROLLED' | 'SECURITY_UPDATE_REQUIRED' | 'UNSUPPORTED' | 'ERROR' | 'UNKNOWN';
	errorMessage?: string;
}

/**
 * Kết quả xác thực sinh trắc học
 */
export interface BiometricAuthResponse {
	success: boolean;
	isCanceled?: boolean;
	fallbackToPasscode?: boolean;
	errorCode?: number;
	errorMessage?: string;
}

interface BiometricAuthPlugin {
	checkBiometricAvailability(): Promise<BiometricAvailability>;
	authenticate(options: {
		title?: string;
		subtitle?: string;
		negativeButtonText?: string;
	}): Promise<BiometricAuthResponse>;
	cancel?(): Promise<{ success: boolean }>;
}

// Đăng ký Native Plugin Capacitor
const NativeBiometricAuth = registerPlugin<BiometricAuthPlugin>('BiometricAuth');

export const STORAGE_KEY_BIOMETRIC_LOCK = 'stories_biometric_lock_enabled';

class BiometricService {
	/**
	 * Kiểm tra xem người dùng đã kích hoạt chế độ khóa sinh trắc học chưa (chỉ hỗ trợ trên Android)
	 */
	public isBiometricLockEnabled(): boolean {
		// Passcode và bảo mật chỉ áp dụng cho mobile Android, không áp dụng trên Web
		if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
			return false;
		}
		try {
			return localStorage.getItem(STORAGE_KEY_BIOMETRIC_LOCK) === 'true';
		} catch {
			return false;
		}
	}

	/**
	 * Bật hoặc tắt cờ cấu hình bảo mật sinh trắc học
	 */
	public setBiometricLockEnabled(enabled: boolean): void {
		// Trên Web không áp dụng lưu cờ khóa bảo mật, dọn dẹp cờ cũ nếu có
		if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
			try {
				localStorage.removeItem(STORAGE_KEY_BIOMETRIC_LOCK);
			} catch {}
			return;
		}
		try {
			if (enabled) {
				localStorage.setItem(STORAGE_KEY_BIOMETRIC_LOCK, 'true');
			} else {
				localStorage.removeItem(STORAGE_KEY_BIOMETRIC_LOCK);
			}
		} catch (error) {
			console.error('[BiometricService] Lỗi khi lưu trạng thái khóa sinh trắc học:', error);
		}
	}

	/**
	 * Kiểm tra tính khả dụng của cảm biến sinh trắc học (vân tay / khuôn mặt)
	 */
	public async checkBiometricAvailability(): Promise<BiometricAvailability> {
		if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
			// Trên môi trường trình duyệt Web không có phần cứng Android Biometric Native
			return {
				isAvailable: false,
				hasHardware: false,
				isEnrolled: false,
				status: 'UNSUPPORTED',
				errorMessage: 'Sinh trắc học native chỉ hỗ trợ trên thiết bị di động Android'
			};
		}

		try {
			return await NativeBiometricAuth.checkBiometricAvailability();
		} catch (error: any) {
			console.warn('[BiometricService] Lỗi khi kiểm tra tính khả dụng:', error);
			return {
				isAvailable: false,
				hasHardware: false,
				isEnrolled: false,
				status: 'ERROR',
				errorMessage: error?.message || 'Không thể kiểm tra sinh trắc học'
			};
		}
	}

	/**
	 * Hiển thị hộp thoại quét sinh trắc học (vân tay / khuôn mặt)
	 */
	public async authenticate(options?: {
		title?: string;
		subtitle?: string;
		negativeButtonText?: string;
	}): Promise<BiometricAuthResponse> {
		if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
			// Môi trường Web không áp dụng khóa bảo mật và passcode
			return {
				success: false,
				fallbackToPasscode: false,
				errorMessage: 'Không áp dụng bảo mật sinh trắc học trên nền tảng web'
			};
		}

		try {
			return await NativeBiometricAuth.authenticate({
				title: options?.title || 'Xác thực bảo mật',
				subtitle: options?.subtitle || 'Quét sinh trắc học để tiếp tục sử dụng',
				negativeButtonText: options?.negativeButtonText || 'Nhập Passcode'
			});
		} catch (error: any) {
			console.error('[BiometricService] Lỗi trong quá trình xác thực:', error);
			return {
				success: false,
				fallbackToPasscode: true,
				errorMessage: error?.message || 'Xác thực sinh trắc học thất bại'
			};
		}
	}

	/**
	 * Hủy bỏ prompt quét sinh trắc học nếu đang chạy
	 */
	public async cancel(): Promise<void> {
		if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
		try {
			if (typeof NativeBiometricAuth.cancel === 'function') {
				await NativeBiometricAuth.cancel();
			}
		} catch (error) {
			console.warn('[BiometricService] Lỗi khi hủy sinh trắc học:', error);
		}
	}
}

export const biometricService = new BiometricService();
