package com.vula.stories;

import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "EdgeTTSNative")
public class EdgeTTSNativePlugin extends Plugin {
    private static final String TAG = "EdgeTTSNativePlugin";

    private static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String CHROMIUM_FULL_VERSION = "143.0.3650.75";
    private static final String CHROMIUM_MAJOR_VERSION = "143";
    private static final String SEC_MS_GEC_VERSION = "1-143.0.3650.75";
    private static final long WIN_EPOCH = 11644473600L;

    private OkHttpClient httpClient;

    @Override
    public void load() {
        super.load();
        httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();
        Log.i(TAG, "EdgeTTSNativePlugin initialized successfully");
    }

    private String generateSecMsGec() {
        try {
            long nowSeconds = System.currentTimeMillis() / 1000L;
            long ticks = (nowSeconds + WIN_EPOCH) * 10000000L;
            ticks -= (ticks % 3000000000L);
            String strToHash = ticks + TRUSTED_CLIENT_TOKEN;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(strToHash.getBytes(StandardCharsets.US_ASCII));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02X", b));
            }
            return hex.toString();
        } catch (Exception e) {
            Log.e(TAG, "Failed to compute Sec-MS-GEC", e);
            return "";
        }
    }

    private String getTimestampIso() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }

    private String escapeXml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    @PluginMethod
    public void synthesize(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Text cannot be empty", "INVALID_INPUT");
            return;
        }

        String voice = call.getString("voice", "vi-VN-HoaiMyNeural");
        String rate = call.getString("rate", "+0%");
        String pitch = call.getString("pitch", "+0Hz");
        String gatewayUrl = call.getString("gatewayUrl", "");

        try {
            final long startTime = System.currentTimeMillis();
            Log.i(TAG, "[EdgeTTS] Yêu cầu tổng hợp giọng nói: textLen=" + text.length() + ", voice=" + voice + ", rate=" + rate);
            String secMsGec = generateSecMsGec();
            String wssUrl = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
                    + "?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
                    + "&Sec-MS-GEC=" + secMsGec
                    + "&Sec-MS-GEC-Version=" + SEC_MS_GEC_VERSION;
            Log.i(TAG, "[EdgeTTS] Đang kết nối tới máy chủ Edge: " + wssUrl);

            Request request = new Request.Builder()
                    .url(wssUrl)
                    .addHeader("Pragma", "no-cache")
                    .addHeader("Cache-Control", "no-cache")
                    .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + CHROMIUM_MAJOR_VERSION + ".0.0.0 Safari/537.36 Edg/" + CHROMIUM_MAJOR_VERSION + ".0.0.0")
                    .addHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                    .addHeader("Accept-Language", "en-US,en;q=0.9")
                    .addHeader("Accept-Encoding", "gzip, deflate, br, zstd")
                    .build();

            ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
            JSArray wordBoundaries = new JSArray();
            final String requestId = UUID.randomUUID().toString().replace("-", "");
            final boolean[] isResolved = {false};
            final String cleanSourceText = text.trim();
            final String foldedSourceText = cleanSourceText.toLowerCase(Locale.ROOT);
            final int[] searchOffset = {0};

            httpClient.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket webSocket, Response response) {
                    try {
                        Log.i(TAG, "[EdgeTTS] Đã kết nối thành công tới máy chủ Edge (HTTP " + response.code() + "). Đang gửi cấu hình và SSML (requestId=" + requestId + ")...");
                        JSONObject openDetails = new JSONObject();
                        openDetails.put("voice", voice);
                        openDetails.put("rate", rate);
                        openDetails.put("textLen", text.length());
                        sendServerLog(gatewayUrl, "info", "[EdgeTTS] WebSocket kết nối thành công tới máy chủ Bing Edge (requestId=" + requestId + ")", null, openDetails);

                        // 1. Send speech.config
                        String configPayload = "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}";
                        String configMsg = "X-Timestamp: " + getTimestampIso() + "\r\n"
                                + "Content-Type: application/json; charset=utf-8\r\n"
                                + "Path: speech.config\r\n\r\n"
                                + configPayload;
                        webSocket.send(configMsg);

                        // 2. Send SSML
                        String escapedText = escapeXml(text.trim());
                        String ssml = "<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"vi-VN\">"
                                + "<voice name=\"" + voice + "\">"
                                + "<prosody rate=\"" + rate + "\" pitch=\"" + pitch + "\">"
                                + escapedText
                                + "</prosody></voice></speak>";
                        String ssmlMsg = "X-RequestId: " + requestId + "\r\n"
                                + "Content-Type: application/ssml+xml\r\n"
                                + "X-Timestamp: " + getTimestampIso() + "\r\n"
                                + "Path: ssml\r\n\r\n"
                                + ssml;
                        webSocket.send(ssmlMsg);
                    } catch (Exception ex) {
                        Log.e(TAG, "Error sending WebSocket handshake/SSML", ex);
                        synchronized (isResolved) {
                            if (!isResolved[0]) {
                                isResolved[0] = true;
                                call.reject("Failed to send synthesis request: " + ex.getMessage(), "WS_SEND_ERROR");
                            }
                        }
                        webSocket.close(1001, "Error");
                    }
                }

                @Override
                public void onMessage(WebSocket webSocket, ByteString bytes) {
                    try {
                        byte[] data = bytes.toByteArray();
                        if (data.length < 2) return;

                        ByteBuffer buf = ByteBuffer.wrap(data);
                        int headerLen = buf.getShort() & 0xFFFF;
                        if (data.length < 2 + headerLen) return;

                        String headerStr = new String(data, 2, headerLen, StandardCharsets.UTF_8);
                        if (headerStr.contains("Path:audio")) {
                            int audioOffset = 2 + headerLen;
                            int audioLen = data.length - audioOffset;
                            if (audioLen > 0) {
                                synchronized (audioBuffer) {
                                    audioBuffer.write(data, audioOffset, audioLen);
                                }
                            }
                        }
                    } catch (Exception ex) {
                        Log.w(TAG, "Error parsing binary audio frame", ex);
                    }
                }

                @Override
                public void onMessage(WebSocket webSocket, String textMsg) {
                    try {
                        if (textMsg.contains("Path:audio.metadata")) {
                            int jsonStart = textMsg.indexOf("\r\n\r\n");
                            if (jsonStart != -1) {
                                String jsonStr = textMsg.substring(jsonStart + 4).trim();
                                JSONObject obj = new JSONObject(jsonStr);
                                JSONArray metadataList = obj.optJSONArray("Metadata");
                                if (metadataList != null) {
                                    for (int i = 0; i < metadataList.length(); i++) {
                                        JSONObject meta = metadataList.optJSONObject(i);
                                        if (meta != null && "WordBoundary".equalsIgnoreCase(meta.optString("Type"))) {
                                            JSONObject data = meta.optJSONObject("Data");
                                            if (data != null) {
                                                long offsetTicks = data.optLong("Offset", 0);
                                                long durationTicks = data.optLong("Duration", 0);
                                                JSONObject textData = data.optJSONObject("text");
                                                String word = textData != null ? textData.optString("Text", "") : "";
                                                int length = textData != null ? textData.optInt("Length", word.length()) : word.length();

                                                String cleanWord = word.trim().toLowerCase(Locale.ROOT);
                                                int charIndex = -1;
                                                if (!cleanWord.isEmpty()) {
                                                    charIndex = foldedSourceText.indexOf(cleanWord, searchOffset[0]);
                                                    if (charIndex < 0) {
                                                        String stripped = cleanWord.replaceAll("^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$", "");
                                                        if (!stripped.isEmpty()) {
                                                            charIndex = foldedSourceText.indexOf(stripped, searchOffset[0]);
                                                        }
                                                    }
                                                }
                                                if (charIndex >= 0) {
                                                    searchOffset[0] = charIndex + cleanWord.length();
                                                } else {
                                                    charIndex = searchOffset[0];
                                                }

                                                JSObject wb = new JSObject();
                                                wb.put("text", word);
                                                wb.put("charIndex", charIndex);
                                                wb.put("charLength", length);
                                                wb.put("startSeconds", (double) offsetTicks / 10000000.0);
                                                wb.put("endSeconds", (double) (offsetTicks + durationTicks) / 10000000.0);

                                                synchronized (wordBoundaries) {
                                                    wordBoundaries.put(wb);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else if (textMsg.contains("Path:turn.end")) {
                            synchronized (isResolved) {
                                if (!isResolved[0]) {
                                    isResolved[0] = true;
                                    byte[] audioBytes = audioBuffer.toByteArray();
                                    long elapsed = System.currentTimeMillis() - startTime;
                                    if (audioBytes.length == 0) {
                                        Log.w(TAG, "[EdgeTTS] Không nhận được âm thanh từ máy chủ Edge sau " + elapsed + "ms");
                                        JSONObject failDetails = new JSONObject();
                                        failDetails.put("voice", voice);
                                        failDetails.put("rate", rate);
                                        failDetails.put("elapsedMs", elapsed);
                                        failDetails.put("textPreview", text.length() > 60 ? text.substring(0, 60) + "..." : text);
                                        sendServerLog(gatewayUrl, "warn", "[EdgeTTS] Không nhận được âm thanh từ máy chủ Edge (" + elapsed + "ms)", "NO_AUDIO", failDetails);
                                        call.reject("No audio received from Edge TTS", "NO_AUDIO");
                                    } else {
                                        Log.i(TAG, "[EdgeTTS] Hoàn tất tổng hợp âm thanh từ máy chủ Edge sau " + elapsed + "ms (audioBytes=" + audioBytes.length + ", boundaries=" + wordBoundaries.length() + ")");
                                        JSONObject successDetails = new JSONObject();
                                        successDetails.put("voice", voice);
                                        successDetails.put("rate", rate);
                                        successDetails.put("textLength", text.length());
                                        successDetails.put("elapsedMs", elapsed);
                                        successDetails.put("audioBytes", audioBytes.length);
                                        successDetails.put("boundariesCount", wordBoundaries.length());
                                        successDetails.put("textPreview", text.length() > 60 ? text.substring(0, 60) + "..." : text);
                                        sendServerLog(gatewayUrl, "info", "[EdgeTTS] Hoàn tất tổng hợp âm thanh từ Edge (" + elapsed + "ms, " + audioBytes.length + " bytes)", null, successDetails);

                                        String base64 = Base64.encodeToString(audioBytes, Base64.NO_WRAP);
                                        JSObject ret = new JSObject();
                                        ret.put("audioBase64", base64);
                                        ret.put("mimeType", "audio/mpeg");
                                        ret.put("wordBoundaries", wordBoundaries);
                                        call.resolve(ret);
                                    }
                                }
                            }
                            webSocket.close(1000, "Done");
                        }
                    } catch (Exception ex) {
                        Log.e(TAG, "[EdgeTTS] Lỗi xử lý khung tin nhắn từ máy chủ Edge", ex);
                    }
                }

                @Override
                public void onClosed(WebSocket webSocket, int code, String reason) {
                    Log.d(TAG, "[EdgeTTS] Đã đóng kết nối với máy chủ Edge: code=" + code + ", reason=" + reason);
                }

                @Override
                public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                    long elapsed = System.currentTimeMillis() - startTime;
                    String errorMsg = t != null ? t.getMessage() : "Unknown error";
                    int statusCode = response != null ? response.code() : 0;
                    Log.e(TAG, "[EdgeTTS] Kết nối/xử lý với máy chủ Edge THẤT BẠI sau " + elapsed + "ms. Code: " + statusCode + ", Err: " + errorMsg, t);

                    JSONObject errDetails = new JSONObject();
                    try {
                        errDetails.put("voice", voice);
                        errDetails.put("rate", rate);
                        errDetails.put("textLength", text.length());
                        errDetails.put("elapsedMs", elapsed);
                        errDetails.put("statusCode", statusCode);
                        errDetails.put("textPreview", text.length() > 60 ? text.substring(0, 60) + "..." : text);
                    } catch (Exception ignored) {}
                    sendServerLog(gatewayUrl, "error", "[EdgeTTS] Kết nối Edge WebSocket thất bại (" + elapsed + "ms, code: " + statusCode + ")", errorMsg, errDetails);

                    synchronized (isResolved) {
                        if (!isResolved[0]) {
                            isResolved[0] = true;
                            JSObject errorDetails = new JSObject();
                            errorDetails.put("statusCode", statusCode);
                            errorDetails.put("message", errorMsg != null ? errorMsg : "Connection failure");
                            call.reject("Edge TTS WebSocket failed (" + (statusCode > 0 ? statusCode : "Network") + "): " + errorMsg, "EDGE_TTS_FAIL", errorDetails);
                        }
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error initiating Edge TTS synthesis", e);
            call.reject("Exception during synthesis: " + e.getMessage(), "INIT_ERROR");
        }
    }

    private void sendServerLog(String gatewayUrl, String level, String message, String error, JSONObject details) {
        if (gatewayUrl == null || gatewayUrl.trim().isEmpty()) return;
        try {
            String cleanUrl = gatewayUrl.replaceAll("/+$", "") + "/api/logs/client-error";
            JSONObject payload = new JSONObject();
            payload.put("platform", "android");
            payload.put("source", "EdgeTTSNative_Java");
            payload.put("level", level);
            payload.put("message", message);
            if (error != null) payload.put("error", error);
            if (details != null) payload.put("details", details);

            okhttp3.RequestBody body = okhttp3.RequestBody.create(
                    okhttp3.MediaType.parse("application/json; charset=utf-8"),
                    payload.toString()
            );
            Request logReq = new Request.Builder()
                    .url(cleanUrl)
                    .post(body)
                    .build();

            httpClient.newCall(logReq).enqueue(new okhttp3.Callback() {
                @Override
                public void onFailure(okhttp3.Call call, java.io.IOException e) {
                    Log.w(TAG, "Failed to send log to server: " + e.getMessage());
                }

                @Override
                public void onResponse(okhttp3.Call call, Response response) {
                    response.close();
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "Error building server log payload", e);
        }
    }
}
