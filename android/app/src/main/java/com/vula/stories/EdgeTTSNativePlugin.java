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

import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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
            final String cleanSourceText = text;
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

    // ==========================================
    // Native Streaming Ahead-Of-Time TTS Engine
    // ==========================================

    private PowerManager.WakeLock wakeLock = null;
    private MediaPlayer currentPlayer = null;
    private MediaPlayer nextPlayer = null;
    private int currentChunkIndex = -1;
    private int nextChunkIndex = -1;
    private final List<String> currentChunks = new ArrayList<>();
    private String currentVoice = "vi-VN-HoaiMyNeural";
    private String currentRate = "+0%";
    private String currentPitch = "+0Hz";
    private String currentGatewayUrl = "";
    private boolean isStreamingPlaying = false;
    private boolean isStreamingPaused = false;
    private final ExecutorService prefetchExecutor = Executors.newFixedThreadPool(3);
    private final Map<Integer, File> readyAudioFiles = new ConcurrentHashMap<>();
    private final Map<Integer, JSONArray> readyWordBoundaries = new ConcurrentHashMap<>();
    private final Set<Integer> inFlightIndices = Collections.synchronizedSet(new HashSet<>());
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable wordBoundaryTicker = null;
    private int lastWordBoundaryCharIndex = -1;

    private synchronized void acquireWakeLock() {
        try {
            if (wakeLock == null && getContext() != null) {
                PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "stories:EdgeTTSNativeWakeLock");
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(45 * 60 * 1000L); // 45 mins safety timeout
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire wake lock: " + e.getMessage());
        }
    }

    private synchronized void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not release wake lock: " + e.getMessage());
        }
    }

    private static final int MAX_PAST_CHUNKS_RETAINED = 6;
    private static final int MAX_TOTAL_CACHE_FILES = 20;

    private File getCacheDirInternal() {
        File dir = new File(getContext().getCacheDir(), "edge_tts_cache");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private void cleanCacheDir(boolean purgeAll) {
        try {
            File dir = getCacheDirInternal();
            File[] files = dir.listFiles();
            if (files != null) {
                long now = System.currentTimeMillis();
                for (File f : files) {
                    if (purgeAll || (now - f.lastModified() > 60 * 60 * 1000L)) {
                        f.delete();
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    private void evictOldChunksFromCache() {
        try {
            // Tier 1: Sliding Window - Delete chunks that are far behind current reading position
            int thresholdIndex = currentChunkIndex - MAX_PAST_CHUNKS_RETAINED;
            if (thresholdIndex > 0) {
                for (Map.Entry<Integer, File> entry : readyAudioFiles.entrySet()) {
                    int idx = entry.getKey();
                    if (idx < thresholdIndex) {
                        File file = readyAudioFiles.remove(idx);
                        if (file != null && file.exists()) {
                            file.delete();
                        }
                        readyWordBoundaries.remove(idx);
                        inFlightIndices.remove(idx);
                    }
                }
            }

            // Tier 2: Hard File Cap - If memory/disk count still exceeds quota, delete oldest
            if (readyAudioFiles.size() > MAX_TOTAL_CACHE_FILES) {
                List<Integer> sortedIndices = new ArrayList<>(readyAudioFiles.keySet());
                Collections.sort(sortedIndices);
                int toRemove = readyAudioFiles.size() - MAX_TOTAL_CACHE_FILES;
                for (int i = 0; i < toRemove && i < sortedIndices.size(); i++) {
                    int idx = sortedIndices.get(i);
                    if (idx < currentChunkIndex) { // Never delete current playing chunk
                        File file = readyAudioFiles.remove(idx);
                        if (file != null && file.exists()) {
                            file.delete();
                        }
                        readyWordBoundaries.remove(idx);
                        inFlightIndices.remove(idx);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error in evictOldChunksFromCache: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playChapter(PluginCall call) {
        JSArray chunksArray = call.getArray("chunks");
        if (chunksArray == null || chunksArray.length() == 0) {
            call.reject("Chunks array cannot be empty", "INVALID_INPUT");
            return;
        }

        int startIndex = call.getInt("startIndex", 0);
        String voice = call.getString("voice", "vi-VN-HoaiMyNeural");
        String pitch = call.getString("pitch", "+0Hz");
        String gatewayUrl = call.getString("gatewayUrl", "");

        String rate = "+0%";
        if (call.hasOption("rate")) {
            try {
                double r = call.getDouble("rate");
                int pct = (int) Math.round((r - 1.0) * 100);
                rate = (pct >= 0 ? "+" : "") + pct + "%";
            } catch (Exception ex) {
                rate = call.getString("rate", "+0%");
            }
        }

        synchronized (this) {
            stopPlaybackInternal(false);
            currentChunks.clear();
            for (int i = 0; i < chunksArray.length(); i++) {
                try {
                    currentChunks.add(chunksArray.getString(i));
                } catch (Exception e) {
                    currentChunks.add("");
                }
            }
            if (startIndex < 0 || startIndex >= currentChunks.size()) {
                startIndex = 0;
            }
            currentChunkIndex = startIndex;
            currentVoice = voice;
            currentRate = rate;
            currentPitch = pitch;
            currentGatewayUrl = gatewayUrl;
            isStreamingPlaying = true;
            isStreamingPaused = false;
            readyAudioFiles.clear();
            readyWordBoundaries.clear();
            inFlightIndices.clear();
        }

        acquireWakeLock();
        cleanCacheDir(true);

        Log.i(TAG, "[EdgeTTS:Stream] Bắt đầu phát chương từ câu " + startIndex + "/" + currentChunks.size() + " với giọng " + voice + " tốc độ " + rate);
        JSObject startState = new JSObject();
        startState.put("isPlaying", true);
        startState.put("isPaused", false);
        startState.put("isBuffering", true);
        notifyListeners("onPlaybackStateChange", startState);

        prefetchChunk(startIndex);
        prefetchChunk(startIndex + 1);
        prefetchChunk(startIndex + 2);

        call.resolve();
    }

    private void prefetchChunk(int index) {
        if (index < 0 || index >= currentChunks.size()) return;
        if (readyAudioFiles.containsKey(index) || inFlightIndices.contains(index)) return;

        inFlightIndices.add(index);
        String text = currentChunks.get(index);
        if (text == null || text.trim().isEmpty()) {
            inFlightIndices.remove(index);
            return;
        }

        prefetchExecutor.submit(() -> {
            try {
                String secMsGec = generateSecMsGec();
                String wssUrl = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
                        + "?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
                        + "&Sec-MS-GEC=" + secMsGec
                        + "&Sec-MS-GEC-Version=" + SEC_MS_GEC_VERSION;

                Request request = new Request.Builder()
                        .url(wssUrl)
                        .addHeader("Pragma", "no-cache")
                        .addHeader("Cache-Control", "no-cache")
                        .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + CHROMIUM_MAJOR_VERSION + ".0.0.0 Safari/537.36 Edg/" + CHROMIUM_MAJOR_VERSION + ".0.0.0")
                        .addHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                        .addHeader("Accept-Language", "en-US,en;q=0.9")
                        .build();

                ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
                JSONArray wordBoundaries = new JSONArray();
                String requestId = UUID.randomUUID().toString().replace("-", "");
                String cleanSourceText = text;
                String foldedSourceText = cleanSourceText.toLowerCase(Locale.ROOT);
                int[] searchOffset = {0};

                httpClient.newWebSocket(request, new WebSocketListener() {
                    @Override
                    public void onOpen(WebSocket webSocket, Response response) {
                        try {
                            String configPayload = "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}";
                            String configMsg = "X-Timestamp: " + getTimestampIso() + "\r\n"
                                    + "Content-Type: application/json; charset=utf-8\r\n"
                                    + "Path: speech.config\r\n\r\n"
                                    + configPayload;
                            webSocket.send(configMsg);

                            String escapedText = escapeXml(cleanSourceText);
                            String ssml = "<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"vi-VN\">"
                                    + "<voice name=\"" + currentVoice + "\">"
                                    + "<prosody rate=\"" + currentRate + "\" pitch=\"" + currentPitch + "\">"
                                    + escapedText
                                    + "</prosody></voice></speak>";
                            String ssmlMsg = "X-RequestId: " + requestId + "\r\n"
                                    + "Content-Type: application/ssml+xml\r\n"
                                    + "X-Timestamp: " + getTimestampIso() + "\r\n"
                                    + "Path: ssml\r\n\r\n"
                                    + ssml;
                            webSocket.send(ssmlMsg);
                        } catch (Exception ex) {
                            webSocket.close(1001, "Error");
                            inFlightIndices.remove(index);
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
                        } catch (Exception ignored) {}
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

                                                    JSONObject wb = new JSONObject();
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
                                byte[] audioBytes = audioBuffer.toByteArray();
                                if (audioBytes.length > 0) {
                                    File chunkFile = new File(getCacheDirInternal(), "chunk_" + index + ".mp3");
                                    try (FileOutputStream fos = new FileOutputStream(chunkFile)) {
                                        fos.write(audioBytes);
                                    }
                                    readyAudioFiles.put(index, chunkFile);
                                    readyWordBoundaries.put(index, wordBoundaries);
                                    Log.d(TAG, "[EdgeTTS:Stream] Nạp xong câu " + index + " (" + audioBytes.length + " bytes, " + wordBoundaries.length() + " words)");

                                    mainHandler.post(() -> onChunkAudioReady(index));
                                }
                                inFlightIndices.remove(index);
                                webSocket.close(1000, "Done");
                            }
                        } catch (Exception ex) {
                            Log.e(TAG, "[EdgeTTS:Stream] Lỗi lưu cache audio câu " + index, ex);
                            inFlightIndices.remove(index);
                        }
                    }

                    @Override
                    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                        Log.w(TAG, "[EdgeTTS:Stream] Lỗi tải ngầm câu " + index + ": " + (t != null ? t.getMessage() : "Unknown"));
                        inFlightIndices.remove(index);
                    }
                });
            } catch (Exception ex) {
                inFlightIndices.remove(index);
            }
        });
    }

    private void onChunkAudioReady(int index) {
        if (!isStreamingPlaying) return;

        if (index == currentChunkIndex && currentPlayer == null) {
            startCurrentPlayer(index);
        } else if (index == currentChunkIndex + 1 && currentPlayer != null && nextPlayer == null) {
            prepareNextPlayer(index);
        }
    }

    private void startCurrentPlayer(int index) {
        try {
            File audioFile = readyAudioFiles.get(index);
            if (audioFile == null || !audioFile.exists()) return;

            if (currentPlayer != null) {
                try {
                    currentPlayer.reset();
                    currentPlayer.release();
                } catch (Exception ignored) {}
                currentPlayer = null;
            }

            currentPlayer = new MediaPlayer();
            currentPlayer.setDataSource(audioFile.getAbsolutePath());
            currentPlayer.setOnPreparedListener(mp -> {
                if (!isStreamingPlaying) {
                    mp.release();
                    return;
                }
                mp.start();
                currentChunkIndex = index;
                lastWordBoundaryCharIndex = -1;

                JSObject chunkData = new JSObject();
                chunkData.put("chunkIndex", index);
                notifyListeners("onChunkStart", chunkData);

                JSObject state = new JSObject();
                state.put("isPlaying", true);
                state.put("isPaused", false);
                state.put("isBuffering", false);
                notifyListeners("onPlaybackStateChange", state);

                startWordBoundaryTicker();
                maintainPrefetchAndNextPlayer();
            });

            currentPlayer.setOnCompletionListener(mp -> {
                mp.release();
                mainHandler.post(this::onChunkCompleted);
            });

            currentPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "[EdgeTTS:Stream] MediaPlayer error: what=" + what + ", extra=" + extra);
                mp.reset();
                mp.release();
                currentPlayer = null;
                mainHandler.post(this::onChunkCompleted);
                return true;
            });

            currentPlayer.prepareAsync();
        } catch (Exception ex) {
            Log.e(TAG, "[EdgeTTS:Stream] Error starting player for chunk " + index, ex);
        }
    }

    private void prepareNextPlayer(int nextIndex) {
        if (!isStreamingPlaying || nextPlayer != null || currentPlayer == null) return;
        File nextFile = readyAudioFiles.get(nextIndex);
        if (nextFile == null || !nextFile.exists()) return;

        try {
            MediaPlayer next = new MediaPlayer();
            next.setDataSource(nextFile.getAbsolutePath());
            next.setOnPreparedListener(mp -> {
                if (!isStreamingPlaying || currentPlayer == null) {
                    mp.release();
                    return;
                }
                nextPlayer = mp;
                nextChunkIndex = nextIndex;
                try {
                    currentPlayer.setNextMediaPlayer(nextPlayer);
                    Log.d(TAG, "[EdgeTTS:Stream] Đã nối gapless câu tiếp theo: " + nextIndex);
                } catch (Exception ex) {
                    Log.w(TAG, "Failed setNextMediaPlayer: " + ex.getMessage());
                }
            });
            next.setOnErrorListener((mp, what, extra) -> {
                mp.reset();
                mp.release();
                nextPlayer = null;
                nextChunkIndex = -1;
                return true;
            });
            next.prepareAsync();
        } catch (Exception ex) {
            Log.w(TAG, "Error preparing next player: " + ex.getMessage());
        }
    }

    private void onChunkCompleted() {
        if (!isStreamingPlaying) return;
        stopWordBoundaryTicker();

        if (nextPlayer != null) {
            currentPlayer = nextPlayer;
            currentChunkIndex = nextChunkIndex;
            nextPlayer = null;
            nextChunkIndex = -1;
            lastWordBoundaryCharIndex = -1;

            JSObject chunkData = new JSObject();
            chunkData.put("chunkIndex", currentChunkIndex);
            notifyListeners("onChunkStart", chunkData);

            startWordBoundaryTicker();
            maintainPrefetchAndNextPlayer();
        } else if (currentChunkIndex + 1 < currentChunks.size()) {
            currentChunkIndex++;
            JSObject state = new JSObject();
            state.put("isPlaying", true);
            state.put("isPaused", false);
            state.put("isBuffering", true);
            notifyListeners("onPlaybackStateChange", state);

            if (readyAudioFiles.containsKey(currentChunkIndex)) {
                startCurrentPlayer(currentChunkIndex);
            } else {
                prefetchChunk(currentChunkIndex);
            }
        } else {
            Log.i(TAG, "[EdgeTTS:Stream] Hoàn tất đọc hết chương");
            stopPlaybackInternal(false);
            notifyListeners("onPlaybackComplete", new JSObject());
        }
    }

    private void maintainPrefetchAndNextPlayer() {
        if (!isStreamingPlaying) return;

        evictOldChunksFromCache();

        for (int i = currentChunkIndex + 1; i <= currentChunkIndex + 3; i++) {
            if (i < currentChunks.size()) {
                prefetchChunk(i);
            }
        }

        if (nextPlayer == null && readyAudioFiles.containsKey(currentChunkIndex + 1)) {
            prepareNextPlayer(currentChunkIndex + 1);
        }
    }

    private void startWordBoundaryTicker() {
        stopWordBoundaryTicker();
        wordBoundaryTicker = new Runnable() {
            @Override
            public void run() {
                if (isStreamingPlaying && currentPlayer != null && currentPlayer.isPlaying()) {
                    try {
                        int posMs = currentPlayer.getCurrentPosition();
                        double posSec = (double) posMs / 1000.0;
                        JSONArray boundaries = readyWordBoundaries.get(currentChunkIndex);
                        if (boundaries != null && boundaries.length() > 0) {
                            JSONObject activeWb = null;
                            for (int i = 0; i < boundaries.length(); i++) {
                                JSONObject wb = boundaries.optJSONObject(i);
                                if (wb != null) {
                                    double startSec = wb.optDouble("startSeconds", 0);
                                    if (posSec >= startSec) {
                                        activeWb = wb;
                                    } else {
                                        break;
                                    }
                                }
                            }
                            if (activeWb != null) {
                                int charIdx = activeWb.optInt("charIndex", -1);
                                if (charIdx != lastWordBoundaryCharIndex) {
                                    lastWordBoundaryCharIndex = charIdx;
                                    JSObject ev = new JSObject();
                                    ev.put("chunkIndex", currentChunkIndex);
                                    ev.put("charIndex", charIdx);
                                    ev.put("charLength", activeWb.optInt("charLength", 1));
                                    ev.put("text", activeWb.optString("text", ""));
                                    notifyListeners("onWordBoundary", ev);
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                    mainHandler.postDelayed(this, 30);
                }
            }
        };
        mainHandler.postDelayed(wordBoundaryTicker, 30);
    }

    private void stopWordBoundaryTicker() {
        if (wordBoundaryTicker != null) {
            mainHandler.removeCallbacks(wordBoundaryTicker);
            wordBoundaryTicker = null;
        }
    }

    @PluginMethod
    public void pausePlayback(PluginCall call) {
        if (currentPlayer != null && currentPlayer.isPlaying()) {
            try {
                currentPlayer.pause();
                isStreamingPaused = true;
                stopWordBoundaryTicker();

                JSObject state = new JSObject();
                state.put("isPlaying", false);
                state.put("isPaused", true);
                state.put("isBuffering", false);
                notifyListeners("onPlaybackStateChange", state);
            } catch (Exception ex) {
                Log.w(TAG, "Error pausing player: " + ex.getMessage());
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void resumePlayback(PluginCall call) {
        if (currentPlayer != null && isStreamingPaused) {
            try {
                currentPlayer.start();
                isStreamingPaused = false;
                startWordBoundaryTicker();

                JSObject state = new JSObject();
                state.put("isPlaying", true);
                state.put("isPaused", false);
                state.put("isBuffering", false);
                notifyListeners("onPlaybackStateChange", state);
            } catch (Exception ex) {
                Log.w(TAG, "Error resuming player: " + ex.getMessage());
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        stopPlaybackInternal(true);
        call.resolve();
    }

    @PluginMethod
    public void seekToChunk(PluginCall call) {
        int targetIndex = call.getInt("chunkIndex", 0);
        if (targetIndex < 0 || targetIndex >= currentChunks.size()) {
            call.reject("Index out of bounds", "INVALID_INDEX");
            return;
        }

        synchronized (this) {
            stopWordBoundaryTicker();
            if (currentPlayer != null) {
                try {
                    currentPlayer.reset();
                    currentPlayer.release();
                } catch (Exception ignored) {}
                currentPlayer = null;
            }
            if (nextPlayer != null) {
                try {
                    nextPlayer.reset();
                    nextPlayer.release();
                } catch (Exception ignored) {}
                nextPlayer = null;
                nextChunkIndex = -1;
            }
            currentChunkIndex = targetIndex;
            lastWordBoundaryCharIndex = -1;
            inFlightIndices.clear();
        }

        JSObject state = new JSObject();
        state.put("isPlaying", true);
        state.put("isPaused", false);
        state.put("isBuffering", true);
        notifyListeners("onPlaybackStateChange", state);

        if (readyAudioFiles.containsKey(targetIndex)) {
            startCurrentPlayer(targetIndex);
        } else {
            prefetchChunk(targetIndex);
        }
        maintainPrefetchAndNextPlayer();
        call.resolve();
    }

    private synchronized void stopPlaybackInternal(boolean emitEvent) {
        isStreamingPlaying = false;
        isStreamingPaused = false;
        stopWordBoundaryTicker();

        if (currentPlayer != null) {
            try {
                currentPlayer.reset();
                currentPlayer.release();
            } catch (Exception ignored) {}
                currentPlayer = null;
        }
        if (nextPlayer != null) {
            try {
                nextPlayer.reset();
                nextPlayer.release();
            } catch (Exception ignored) {}
            nextPlayer = null;
            nextChunkIndex = -1;
        }

        releaseWakeLock();

        if (emitEvent) {
            JSObject state = new JSObject();
            state.put("isPlaying", false);
            state.put("isPaused", false);
            state.put("isBuffering", false);
            notifyListeners("onPlaybackStateChange", state);
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopPlaybackInternal(false);
        cleanCacheDir(true);
        try {
            prefetchExecutor.shutdownNow();
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
