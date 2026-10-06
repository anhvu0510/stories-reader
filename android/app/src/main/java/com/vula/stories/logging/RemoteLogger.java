package com.vula.stories.logging;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Centralized remote telemetry and error logger.
 * Ships structured JSON diagnostics to Gateway VPS (/api/logs/client-error).
 * Stores gatewayUrl in SharedPreferences for cold-start and crash reporting survival.
 */
public class RemoteLogger {
    private static final String TAG = "RemoteLogger";
    private static final String PREFS_NAME = "stories_remote_logger_prefs";
    private static final String KEY_GATEWAY_URL = "gateway_url";

    private static Context appContext = null;
    private static OkHttpClient asyncClient = null;
    private static String cachedGatewayUrl = "";

    public static synchronized void init(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
            SharedPreferences prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            cachedGatewayUrl = prefs.getString(KEY_GATEWAY_URL, "");
        }
        if (asyncClient == null) {
            asyncClient = new OkHttpClient.Builder()
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .writeTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build();
        }
    }

    public static synchronized void setGatewayUrl(String url) {
        if (url == null || url.trim().isEmpty()) return;
        String cleanUrl = url.trim().replaceAll("/+$", "");
        if (!cleanUrl.equals(cachedGatewayUrl)) {
            cachedGatewayUrl = cleanUrl;
            if (appContext != null) {
                SharedPreferences prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_GATEWAY_URL, cleanUrl).apply();
            }
        }
    }

    public static synchronized String getGatewayUrl() {
        if (cachedGatewayUrl != null && !cachedGatewayUrl.isEmpty()) {
            return cachedGatewayUrl;
        }
        if (appContext != null) {
            SharedPreferences prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            cachedGatewayUrl = prefs.getString(KEY_GATEWAY_URL, "");
        }
        return cachedGatewayUrl;
    }

    /**
     * Rút gọn nội dung văn bản phục vụ logging:
     * Thay vì in nguyên cả câu dài, chỉ lấy phần đầu và phần đuôi (ví dụ: "Đoạn đầu ... đoạn cuối")
     * để vừa đủ nhận diện ngữ cảnh mà không làm nặng payload hoặc lộ dữ liệu người dùng.
     */
    public static String formatSnippet(String text) {
        if (text == null) return "";
        String trimmed = text.trim();
        if (trimmed.length() <= 35) {
            return trimmed;
        }
        return trimmed.substring(0, 16) + "..." + trimmed.substring(trimmed.length() - 12);
    }

    public static void log(String source, String level, String message, String error, JSONObject details) {
        // Record breadcrumb automatically
        BreadcrumbTracker.add(source, message != null ? message : (error != null ? error : ""));

        String rootUrl = getGatewayUrl();
        if (rootUrl == null || rootUrl.isEmpty()) return;

        try {
            // Tự động rút gọn nếu details có chứa fullText để đảm bảo an toàn băng thông
            if (details != null && details.has("fullText")) {
                String raw = details.optString("fullText", "");
                details.remove("fullText");
                details.put("snippet", formatSnippet(raw));
            }

            String endpoint = rootUrl + "/api/logs/client-error";
            JSONObject payload = new JSONObject();
            payload.put("platform", "android");
            payload.put("source", source != null ? source : "AndroidClient");
            payload.put("level", level != null ? level : "info");
            payload.put("message", message != null ? message : "");
            if (error != null) payload.put("error", error);
            if (details != null) payload.put("details", details);

            RequestBody body = RequestBody.create(
                    payload.toString(),
                    MediaType.parse("application/json; charset=utf-8")
            );

            Request request = new Request.Builder()
                    .url(endpoint)
                    .post(body)
                    .build();

            if (asyncClient != null) {
                asyncClient.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onFailure(Call call, IOException e) {
                        Log.w(TAG, "Async log delivery failed: " + e.getMessage());
                    }

                    @Override
                    public void onResponse(Call call, Response response) {
                        try {
                            if (response != null) {
                                response.close();
                            }
                        } catch (Exception e) {
                            Log.w(TAG, "Lỗi đóng phản hồi HTTP async log: " + e.getMessage());
                        }
                    }
                });
            }
        } catch (Exception e) {
            Log.w(TAG, "Error formatting log payload", e);
        }
    }

    /**
     * Synchronous blocking HTTP POST with dedicated timeout.
     * Essential for fatal crash reporting right before the process terminates.
     */
    public static boolean logSync(String source, String level, String message, String error, JSONObject details, int timeoutSeconds) {
        String rootUrl = getGatewayUrl();
        if (rootUrl == null || rootUrl.isEmpty()) return false;

        try {
            // Tự động rút gọn nếu details có chứa fullText
            if (details != null && details.has("fullText")) {
                String raw = details.optString("fullText", "");
                details.remove("fullText");
                details.put("snippet", formatSnippet(raw));
            }

            String endpoint = rootUrl + "/api/logs/client-error";
            JSONObject payload = new JSONObject();
            payload.put("platform", "android");
            payload.put("source", source != null ? source : "CrashReporter");
            payload.put("level", level != null ? level : "fatal");
            payload.put("message", message != null ? message : "");
            if (error != null) payload.put("error", error);
            if (details != null) payload.put("details", details);

            RequestBody body = RequestBody.create(
                    payload.toString(),
                    MediaType.parse("application/json; charset=utf-8")
            );

            Request request = new Request.Builder()
                    .url(endpoint)
                    .post(body)
                    .build();

            OkHttpClient syncClient = new OkHttpClient.Builder()
                    .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                    .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
                    .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                    .build();

            try (Response response = syncClient.newCall(request).execute()) {
                return response.isSuccessful();
            }
        } catch (Exception e) {
            Log.e(TAG, "Sync crash delivery failed", e);
            return false;
        }
    }
}
