package com.vula.stories;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * Plugin Capacitor Native xử lý xác thực sinh trắc học (Vân tay / Khuôn mặt)
 * trên nền tảng Android sử dụng thư viện chuẩn AndroidX Biometric.
 */
@CapacitorPlugin(name = "BiometricAuth")
public class BiometricPlugin extends Plugin {

    private static final String TAG = "BiometricPlugin";
    private BiometricPrompt currentBiometricPrompt = null;

    /**
     * Kiểm tra tính khả dụng của phần cứng và trạng thái đăng ký sinh trắc học trên thiết bị.
     */
    @PluginMethod
    public void checkBiometricAvailability(PluginCall call) {
        try {
            BiometricManager biometricManager = BiometricManager.from(getContext());
            int canAuth = biometricManager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
            );

            JSObject result = new JSObject();
            switch (canAuth) {
                case BiometricManager.BIOMETRIC_SUCCESS:
                    result.put("isAvailable", true);
                    result.put("hasHardware", true);
                    result.put("isEnrolled", true);
                    result.put("status", "SUCCESS");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                    result.put("isAvailable", false);
                    result.put("hasHardware", false);
                    result.put("isEnrolled", false);
                    result.put("status", "NO_HARDWARE");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                    result.put("isAvailable", false);
                    result.put("hasHardware", true);
                    result.put("isEnrolled", false);
                    result.put("status", "HW_UNAVAILABLE");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                    result.put("isAvailable", false);
                    result.put("hasHardware", true);
                    result.put("isEnrolled", false);
                    result.put("status", "NONE_ENROLLED");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                    result.put("isAvailable", false);
                    result.put("hasHardware", true);
                    result.put("isEnrolled", true);
                    result.put("status", "SECURITY_UPDATE_REQUIRED");
                    break;
                default:
                    result.put("isAvailable", false);
                    result.put("hasHardware", false);
                    result.put("isEnrolled", false);
                    result.put("status", "UNKNOWN");
                    break;
            }
            call.resolve(result);
        } catch (Exception e) {
            JSObject err = new JSObject();
            err.put("isAvailable", false);
            err.put("hasHardware", false);
            err.put("isEnrolled", false);
            err.put("status", "ERROR");
            err.put("errorMessage", e.getMessage());
            call.resolve(err);
        }
    }

    /**
     * Kích hoạt hộp thoại BiometricPrompt của hệ thống Android để quét vân tay hoặc khuôn mặt.
     */
    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Xác thực bảo mật");
        String subtitle = call.getString("subtitle", "Quét sinh trắc học để tiếp tục");
        String negativeButtonText = call.getString("negativeButtonText", "Nhập Passcode");

        if (!(getActivity() instanceof FragmentActivity)) {
            JSObject err = new JSObject();
            err.put("success", false);
            err.put("errorMessage", "Activity hiện tại không hỗ trợ FragmentActivity");
            call.resolve(err);
            return;
        }

        final FragmentActivity activity = (FragmentActivity) getActivity();

        activity.runOnUiThread(() -> {
            try {
                if (activity.isFinishing() || activity.isDestroyed()) {
                    JSObject err = new JSObject();
                    err.put("success", false);
                    err.put("errorMessage", "Activity không ở trạng thái sẵn sàng");
                    call.resolve(err);
                    return;
                }

                // Hủy prompt cũ đang tồn tại nếu có trước khi mở prompt mới
                if (currentBiometricPrompt != null) {
                    try {
                        currentBiometricPrompt.cancelAuthentication();
                    } catch (Exception e) {
                        Log.d(TAG, "Hủy prompt sinh trắc học trước đó: " + e.getMessage());
                    }
                    currentBiometricPrompt = null;
                }

                Executor executor = ContextCompat.getMainExecutor(activity);
                currentBiometricPrompt = new BiometricPrompt(
                        activity,
                        executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                currentBiometricPrompt = null;

                                JSObject res = new JSObject();
                                res.put("success", false);
                                res.put("errorCode", errorCode);
                                res.put("errorMessage", errString.toString());

                                // Kiểm tra nếu người dùng nhấn nút 'Nhập Passcode' hoặc tự hủy
                                boolean isNegativeButton = (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON);
                                boolean isCanceled = (errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_CANCELED);
                                boolean isLockout = (errorCode == BiometricPrompt.ERROR_LOCKOUT || errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT);

                                res.put("isCanceled", isCanceled);
                                res.put("fallbackToPasscode", isNegativeButton || isLockout || isCanceled);

                                call.resolve(res);
                            }

                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult authResult) {
                                super.onAuthenticationSucceeded(authResult);
                                currentBiometricPrompt = null;

                                JSObject res = new JSObject();
                                res.put("success", true);
                                call.resolve(res);
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                super.onAuthenticationFailed();
                                // Android BiometricPrompt tự động xử lý rung và gợi ý thử lại trên giao diện native
                            }
                        }
                );

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButtonText(negativeButtonText)
                        .setAllowedAuthenticators(
                                BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
                        )
                        .build();

                currentBiometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                currentBiometricPrompt = null;
                JSObject err = new JSObject();
                err.put("success", false);
                err.put("errorMessage", e.getMessage());
                call.resolve(err);
            }
        });
    }

    /**
     * Hủy hộp thoại quét sinh trắc học nếu đang hiển thị
     */
    @PluginMethod
    public void cancel(PluginCall call) {
        if (currentBiometricPrompt != null) {
            try {
                currentBiometricPrompt.cancelAuthentication();
            } catch (Exception e) {
                Log.d(TAG, "Hủy xác thực sinh trắc học an toàn: " + e.getMessage());
            }
            currentBiometricPrompt = null;
        }
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }
}
