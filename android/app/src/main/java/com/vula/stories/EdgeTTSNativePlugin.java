package com.vula.stories;

import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.RemoteLogger;
import com.vula.stories.player.GaplessStreamPlayer;
import com.vula.stories.player.StoriesAudioBridge;
import com.vula.stories.player.media3.Media3ReadAloudBridge;
import com.vula.stories.player.media3.PlaybackSnapshot;
import com.vula.stories.player.media3.ReadAloudRequestNormalizer;
import com.vula.stories.player.media3.ReadAloudSessionRequest;
import com.vula.stories.player.media3.ReadAloudUtterance;
import com.vula.stories.player.media3.WordBoundary;
import com.vula.stories.tts.edge.AudioCacheManager;
import com.vula.stories.tts.edge.EdgeAuth;

import android.os.Handler;
import android.os.Looper;

import com.vula.stories.player.PrefetchRetryManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "EdgeTTSNative")
public class EdgeTTSNativePlugin extends Plugin implements StoriesAudioBridge.AudioControlListener, Media3ReadAloudBridge.Listener {
    private static final String TAG = "EdgeTTSNativePlugin";

    private OkHttpClient httpClient;
    private AudioCacheManager cacheManager;
    private GaplessStreamPlayer player;
    private Handler mainHandler;

    private final List<String> currentChunks = new ArrayList<>();
    private String currentVoice = "vi-VN-HoaiMyNeural";
    private String currentRate = "+0%";
    private String currentPitch = "+0Hz";
    private String currentGatewayUrl = "";
    private boolean isStreamingPlaying = false;
    // Chỉ số câu mục tiêu đang hoặc chuẩn bị phát (tránh deadlock khi player.getCurrentChunkIndex() khởi tạo là -1)
    private int currentPlayIndex = 0;
    // Quản lý phiên phát streaming để hủy và cô lập triệt để các tiến trình prefetch nền khi user nhấn stop
    private long streamingSessionId = 0;

    // Khoảng thời gian tối thiểu giữa 2 lần gửi remote log câu (1.5s) để chống spam khi seek nhanh hoặc chuỗi câu siêu ngắn
    private static final long MIN_CHUNK_LOG_INTERVAL_MS = 1500;
    private long lastChunkLogTime = 0;

    // Quản lý cơ chế thử lại cuốn chiếu (Linear Backoff Retry) khi gặp sự cố mạng (Connection reset, timeout)
    private final PrefetchRetryManager retryManager = new PrefetchRetryManager();

    // Metadata phục vụ thanh điều khiển âm thanh trên Notification & Lock Screen
    private String currentBookTitle = "Stories Reader";
    private String currentChapterTitle = "Chương đọc";

    // Số lượng tải trước song song tối đa (3 task, tương ứng với số luồng của prefetchExecutor)
    private static final int MAX_CONCURRENT_PREFETCH = 3;

    private final ExecutorService prefetchExecutor = Executors.newFixedThreadPool(MAX_CONCURRENT_PREFETCH);
    private final Map<Integer, File> readyAudioFiles = new ConcurrentHashMap<>();
    private final Map<Integer, byte[]> readyAudioBytes = new ConcurrentHashMap<>();
    private String currentBufferMode = "file";
    private boolean isMedia3Active = false;
    private final Map<Integer, JSONArray> readyWordBoundaries = new ConcurrentHashMap<>();
    private final Set<Integer> inFlightIndices = Collections.synchronizedSet(new HashSet<>());
    private final Map<Integer, WebSocket> activeSockets = new ConcurrentHashMap<>();

    private boolean isMemoryMode() {
        return "memory".equalsIgnoreCase(currentBufferMode);
    }

    private Set<Integer> getReadyIndices() {
        if (isMemoryMode()) {
            return readyAudioBytes.keySet();
        }
        return readyAudioFiles.keySet();
    }

    private boolean hasReadyAudio(int index) {
        if (isMemoryMode()) {
            return readyAudioBytes.containsKey(index);
        }
        return readyAudioFiles.containsKey(index);
    }

    private void playChunkAudio(int index) {
        if (isMemoryMode()) {
            byte[] bytes = readyAudioBytes.get(index);
            if (bytes != null) {
                player.start(index, bytes);
            }
            return;
        }
        File file = readyAudioFiles.get(index);
        if (file != null) {
            player.start(index, file);
        }
    }

    private void prepareNextAudio(int index) {
        if (isMemoryMode()) {
            byte[] bytes = readyAudioBytes.get(index);
            if (bytes != null) {
                player.prepareNext(index, bytes);
            }
            return;
        }
        File file = readyAudioFiles.get(index);
        if (file != null) {
            player.prepareNext(index, file);
        }
    }

    private void evictOldChunks(int currentIdx) {
        if (isMemoryMode()) {
            cacheManager.evictOldMemoryChunks(currentIdx, readyAudioBytes, readyWordBoundaries, inFlightIndices);
            return;
        }
        cacheManager.evictOldChunks(currentIdx, readyAudioFiles, readyWordBoundaries, inFlightIndices);
    }

    /**
     * Tìm chỉ số của câu nhỏ nhất hiện đã có sẵn trong bộ đệm cache âm thanh (readyAudioFiles hoặc readyAudioBytes).
     *
     * @return Chỉ số câu nhỏ nhất đã cache xong, hoặc -1 nếu chưa có câu nào.
     */
    private int getFirstCachedChunkIndex() {
        int minIndex = Integer.MAX_VALUE;
        for (Integer idx : getReadyIndices()) {
            if (idx != null && idx < minIndex) {
                minIndex = idx;
            }
        }
        return minIndex == Integer.MAX_VALUE ? -1 : minIndex;
    }

    /**
     * Tìm chỉ số của câu xa nhất hiện đã có sẵn trong bộ đệm cache âm thanh (readyAudioFiles hoặc readyAudioBytes).
     *
     * @return Chỉ số câu lớn nhất đã cache xong, hoặc -1 nếu chưa có câu nào.
     */
    private int getLastCachedChunkIndex() {
        int maxIndex = -1;
        for (Integer idx : getReadyIndices()) {
            if (idx != null && idx > maxIndex) {
                maxIndex = idx;
            }
        }
        return maxIndex;
    }

    @Override
    public void load() {
        super.load();
        mainHandler = new Handler(Looper.getMainLooper());
        httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();

        cacheManager = new AudioCacheManager(getContext());
        Media3ReadAloudBridge.registerListener(this);
        player = new GaplessStreamPlayer(getContext(), new GaplessStreamPlayer.PlayerListener() {
            @Override
            public void onChunkStart(int chunkIndex) {
                currentPlayIndex = chunkIndex;
                JSObject chunkData = new JSObject();
                chunkData.put("chunkIndex", chunkIndex);
                notifyListeners("onChunkStart", chunkData);

                // Dọn dẹp sạch toàn bộ các câu quá khứ ngay lập tức để câu hiện tại luôn là câu đầu tiên của cache
                evictOldChunks(chunkIndex);

                String playText = (chunkIndex >= 0 && chunkIndex < currentChunks.size()) ? currentChunks.get(chunkIndex) : "";
                String snippet = RemoteLogger.formatSnippet(playText);

                // Lấy thông tin câu cache đầu tiên và câu xa nhất trong bộ đệm readyAudioFiles
                int firstCachedIdx = getFirstCachedChunkIndex();
                int lastCachedIdx = getLastCachedChunkIndex();
                String lastCachedSnippet = (lastCachedIdx >= 0 && lastCachedIdx < currentChunks.size())
                        ? RemoteLogger.formatSnippet(currentChunks.get(lastCachedIdx))
                        : "";

                // Đếm số câu gối đầu phía trước (ahead) đang sẵn sàng trong cache
                int aheadCount = 0;
                for (Integer idx : getReadyIndices()) {
                    if (idx != null && idx > chunkIndex) {
                        aheadCount++;
                    }
                }

                String cacheRangeStr = (firstCachedIdx >= 0 && lastCachedIdx >= 0)
                        ? "câu " + (firstCachedIdx + 1) + " -> " + (lastCachedIdx + 1) + "/" + currentChunks.size()
                        : "Chưa có";
                String cacheInfoStr = (lastCachedIdx >= 0)
                        ? " [Cache: " + cacheRangeStr + " (+" + aheadCount + " câu gối đầu) - \"" + lastCachedSnippet + "\"]"
                        : " [Cache: Chưa có]";

                String modeTag = "[" + currentBufferMode.toUpperCase(Locale.ROOT) + "]";
                String fullLogMessage = "[EdgeTTS:Stream]" + modeTag + " Đang đọc câu " + (chunkIndex + 1) + "/" + currentChunks.size()
                        + ": \"" + snippet + "\"" + cacheInfoStr;

                // 1. Luôn ghi log nội bộ Logcat thiết bị đầy đủ 100% các câu
                Log.d(TAG, fullLogMessage);

                // 2. Gửi RemoteLogger ở cấp độ câu phục vụ tracking, có cơ chế chống spam (tối thiểu 1.5s giữa các lần gửi, câu đầu/cuối luôn gửi)
                long now = System.currentTimeMillis();
                boolean isBoundaryChunk = (chunkIndex == 0 || chunkIndex == currentChunks.size() - 1);
                if (isBoundaryChunk || (now - lastChunkLogTime >= MIN_CHUNK_LOG_INTERVAL_MS)) {
                    lastChunkLogTime = now;
                    JSONObject playDetails = new JSONObject();
                    try {
                        playDetails.put("chunkIndex", chunkIndex);
                        playDetails.put("totalChunks", currentChunks.size());
                        playDetails.put("bufferMode", currentBufferMode);
                        if (currentChunks.size() > 0) {
                            int progressPct = (int) Math.round(((double) (chunkIndex + 1) / currentChunks.size()) * 100);
                            playDetails.put("progress", progressPct + "%");
                        }
                        playDetails.put("snippet", snippet);
                        playDetails.put("firstCachedIndex", firstCachedIdx);
                        playDetails.put("lastCachedIndex", lastCachedIdx);
                        if (lastCachedIdx >= 0) {
                            playDetails.put("lastCachedSnippet", lastCachedSnippet);
                        }
                        playDetails.put("aheadCachedCount", aheadCount);
                        playDetails.put("cachedChunksCount", getReadyIndices().size());
                    } catch (Exception ignored) {}
                    RemoteLogger.log("EdgeTTSNative_Stream", "info", fullLogMessage, null, playDetails);
                }

                // Cập nhật thông tin câu đọc và trạng thái phát lên thanh điều khiển Notification & Lock Screen
                StoriesAudioBridge.updatePlayback(
                        getContext(),
                        currentBookTitle,
                        currentChapterTitle,
                        playText,
                        true,
                        chunkIndex > 0,
                        chunkIndex < currentChunks.size() - 1,
                        chunkIndex,
                        currentChunks.size()
                );
            }

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                JSObject ev = new JSObject();
                ev.put("chunkIndex", chunkIndex);
                ev.put("charIndex", charIndex);
                ev.put("charLength", charLength);
                ev.put("text", text);
                notifyListeners("onWordBoundary", ev);
            }

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
                JSObject state = new JSObject();
                state.put("isPlaying", isPlaying);
                state.put("isPaused", isPaused);
                state.put("isBuffering", isBuffering);
                notifyListeners("onPlaybackStateChange", state);

                // Nếu đang trong tiến trình dừng hẳn luồng đọc (!isStreamingPlaying && !isPlaying),
                // ngắt ngay cập nhật Notification để tránh xung đột với lệnh dừng Service
                if (!isStreamingPlaying && !isPlaying) {
                    return;
                }

                // Đồng bộ trạng thái Play/Pause lên thanh thông báo và màn hình khóa
                int currentIdx = player != null ? player.getCurrentChunkIndex() : 0;
                String currentText = (currentIdx >= 0 && currentIdx < currentChunks.size()) ? currentChunks.get(currentIdx) : "";
                StoriesAudioBridge.updatePlayback(
                        getContext(),
                        currentBookTitle,
                        currentChapterTitle,
                        currentText,
                        isPlaying,
                        currentIdx > 0,
                        currentIdx < currentChunks.size() - 1,
                        currentIdx,
                        currentChunks.size()
                );
            }

            @Override
            public void onChunkCompleted(int completedIndex) {
                handleChunkCompleted(completedIndex);
            }

            @Override
            public void onAllCompleted() {
                // Handled in handleChunkCompleted
            }
        });

        player.setWordBoundariesSource(readyWordBoundaries);
        BreadcrumbTracker.add(TAG, "EdgeTTSNativePlugin loaded");
        Log.i(TAG, "EdgeTTSNativePlugin initialized successfully");
    }

    @PluginMethod
    public void setGatewayUrl(PluginCall call) {
        String url = call.getString("gatewayUrl", "");
        if (!url.isEmpty()) {
            currentGatewayUrl = url;
            RemoteLogger.setGatewayUrl(url);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        cacheManager.cleanCacheDir(true);
        readyAudioFiles.clear();
        readyAudioBytes.clear();
        readyWordBoundaries.clear();
        if (player != null) {
            player.clearCache();
        }
        BreadcrumbTracker.add(TAG, "Audio cache cleared");
        call.resolve();
    }

    // ==========================================
    // Single-shot Legacy synthesize Method
    // ==========================================

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
        if (!gatewayUrl.isEmpty()) {
            RemoteLogger.setGatewayUrl(gatewayUrl);
        }

        try {
            final long startTime = System.currentTimeMillis();
            BreadcrumbTracker.add(TAG, "Synthesize request: textLen=" + text.length() + ", voice=" + voice);
            String wssUrl = EdgeAuth.buildWebSocketUrl();
            Request request = EdgeAuth.buildWebSocketRequest(wssUrl);

            ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
            JSArray wordBoundaries = new JSArray();
            final String requestId = UUID.randomUUID().toString().replace("-", "");
            final boolean[] isResolved = {false};
            final String cleanSourceText = Normalizer.normalize(text, Normalizer.Form.NFC);
            final String foldedSourceText = cleanSourceText.toLowerCase(Locale.ROOT);
            final int[] searchOffset = {0};

            httpClient.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket webSocket, Response response) {
                    try {
                        // Ghi log Logcat nội bộ thiết bị khi kết nối WebSocket thành công
                        Log.d(TAG, "[EdgeTTS] WebSocket kết nối thành công tới máy chủ Bing Edge (requestId=" + requestId + "): \"" + RemoteLogger.formatSnippet(text) + "\"");

                        webSocket.send(EdgeAuth.buildSpeechConfigMessage());
                        webSocket.send(EdgeAuth.buildSsmlMessage(requestId, voice, rate, pitch, text));
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
                                                String rawWord = textData != null ? textData.optString("Text", "") : "";
                                                if (!rawWord.trim().isEmpty()) {
                                                    String normWord = Normalizer.normalize(rawWord.trim(), Normalizer.Form.NFC);
                                                    String cleanWord = normWord.toLowerCase(Locale.ROOT);
                                                    String stripped = cleanWord.replaceAll("^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$", "");

                                                    if (!stripped.isEmpty()) {
                                                        int charIndex = foldedSourceText.indexOf(cleanWord, searchOffset[0]);
                                                        int matchedLen = cleanWord.length();
                                                        if (charIndex < 0) {
                                                            charIndex = foldedSourceText.indexOf(stripped, searchOffset[0]);
                                                            matchedLen = stripped.length();
                                                        }

                                                        if (charIndex >= 0) {
                                                            searchOffset[0] = charIndex + matchedLen;
                                                            JSONObject wb = new JSONObject();
                                                            wb.put("text", rawWord);
                                                            wb.put("charIndex", charIndex);
                                                            wb.put("charLength", matchedLen);
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
                                    }
                                }
                            }
                        } else if (textMsg.contains("Path:turn.end")) {
                            long elapsed = System.currentTimeMillis() - startTime;
                            synchronized (isResolved) {
                                if (!isResolved[0]) {
                                    isResolved[0] = true;
                                    byte[] audioBytes = audioBuffer.toByteArray();
                                    if (audioBytes.length == 0) {
                                        JSONObject failDetails = new JSONObject();
                                        failDetails.put("voice", voice);
                                        failDetails.put("rate", rate);
                                        failDetails.put("elapsedMs", elapsed);
                                        failDetails.put("fullText", text);
                                        failDetails.put("bufferMode", currentBufferMode);
                                        RemoteLogger.log("EdgeTTSNative_Stream", "warn", "[EdgeTTS][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Không nhận được âm thanh từ máy chủ Edge (" + elapsed + "ms) - Nội dung: \"" + text + "\"", "NO_AUDIO", failDetails);
                                        call.reject("No audio received from Edge TTS", "NO_AUDIO");
                                    } else {
                                        // Ghi log Logcat nội bộ thiết bị khi hoàn tất tổng hợp đơn lẻ
                                        Log.d(TAG, "[EdgeTTS] Hoàn tất tổng hợp âm thanh từ Edge (" + elapsed + "ms, " + audioBytes.length + " bytes): \"" + RemoteLogger.formatSnippet(text) + "\"");

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
                        Log.e(TAG, "[EdgeTTS] Error handling message frame", ex);
                    }
                }

                @Override
                public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                    long elapsed = System.currentTimeMillis() - startTime;
                    String errorMsg = t != null ? t.getMessage() : "Unknown error";
                    int statusCode = response != null ? response.code() : 0;
                    JSONObject errDetails = new JSONObject();
                    try {
                        errDetails.put("voice", voice);
                        errDetails.put("rate", rate);
                        errDetails.put("textLength", text.length());
                        errDetails.put("elapsedMs", elapsed);
                        errDetails.put("statusCode", statusCode);
                        errDetails.put("fullText", text);
                        errDetails.put("bufferMode", currentBufferMode);
                    } catch (Exception ignored) {}
                    RemoteLogger.log("EdgeTTSNative_Stream", "error", "[EdgeTTS][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Kết nối Edge WebSocket thất bại (" + elapsed + "ms, code: " + statusCode + ") - Nội dung: \"" + text + "\"", errorMsg, errDetails);

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
            Log.e(TAG, "Unexpected error in synthesize", e);
            call.reject("Synthesis failed: " + e.getMessage(), "UNKNOWN_ERROR");
        }
    }

    // ==========================================
    // Native Streaming Ahead-Of-Time TTS Engine
    // ==========================================

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
        String bufferMode = call.getString("bufferMode", "file");
        currentBookTitle = call.getString("bookTitle", "Stories Reader");
        currentChapterTitle = call.getString("chapterTitle", "Chương đọc");

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

        if ("media3".equalsIgnoreCase(bufferMode)) {
            startMedia3Playback(call, chunksArray, startIndex, voice, rate, pitch);
            return;
        }

        final long sessionId;
        synchronized (this) {
            // Dừng luồng phát cũ và dọn dẹp cache trước khi khởi tạo phiên mới
            stopPlaybackInternal(false);
            // Đăng ký nhận sự kiện điều khiển từ thanh thông báo / màn hình khóa SAU KHI dừng luồng cũ
            StoriesAudioBridge.registerListener(this);

            // Bắt đầu một session id mới để cô lập phiên đọc này
            sessionId = ++streamingSessionId;

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
            currentPlayIndex = startIndex;
            currentVoice = voice;
            currentRate = rate;
            currentPitch = pitch;
            currentGatewayUrl = gatewayUrl;
            currentBufferMode = bufferMode;
            if (!gatewayUrl.isEmpty()) {
                RemoteLogger.setGatewayUrl(gatewayUrl);
            }
            isStreamingPlaying = true;
            readyAudioFiles.clear();
            readyAudioBytes.clear();
            readyWordBoundaries.clear();
            inFlightIndices.clear();
            activeSockets.clear();
            retryManager.reset();
        }

        player.acquireWakeLock();
        if (!isMemoryMode()) {
            cacheManager.cleanCacheDir(true);
        }
        player.reset();
        player.setWordBoundariesSource(readyWordBoundaries);

        JSObject startState = new JSObject();
        startState.put("isPlaying", true);
        startState.put("isPaused", false);
        startState.put("isBuffering", true);
        notifyListeners("onPlaybackStateChange", startState);

        String firstSentence = (startIndex >= 0 && startIndex < currentChunks.size()) ? currentChunks.get(startIndex) : "";
        JSONObject startDetails = new JSONObject();
        try {
            startDetails.put("startIndex", startIndex);
            startDetails.put("totalChunks", currentChunks.size());
            startDetails.put("voice", voice);
            startDetails.put("rate", rate);
            startDetails.put("bufferMode", currentBufferMode);
            startDetails.put("snippet", RemoteLogger.formatSnippet(firstSentence));
        } catch (Exception ignored) {}
        RemoteLogger.log("EdgeTTSNative_Stream", "info", "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Bắt đầu phát chương từ câu " + (startIndex + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(firstSentence) + "\"", null, startDetails);

        // Reset thời điểm log câu để câu đầu tiên luôn được gửi ngay lập tức
        lastChunkLogTime = 0;

        // Khởi động tải trước ưu tiên: Tải ngay câu bắt đầu và các câu kế tiếp song song (tối đa MAX_CONCURRENT_PREFETCH)
        for (int i = 0; i < MAX_CONCURRENT_PREFETCH && startIndex + i < currentChunks.size(); i++) {
            prefetchChunk(startIndex + i, sessionId);
        }

        call.resolve();
    }

    private void startMedia3Playback(
            PluginCall call,
            JSArray chunksArray,
            int startIndex,
            String voice,
            String rate,
            String pitch
    ) {
        stopPlaybackInternal(false);
        List<String> legacyChunks = parseChunks(chunksArray);
        List<ReadAloudUtterance> utterances = parseUtterances(call.getArray("utterances"));
        if (utterances.isEmpty()) utterances = ReadAloudRequestNormalizer.fromLegacyChunks(legacyChunks);
        if (utterances.isEmpty()) {
            call.reject("Utterances array cannot be empty", "INVALID_INPUT");
            return;
        }
        int safeStartIndex = Math.max(0, Math.min(startIndex, utterances.size() - 1));
        String sessionId = call.getString("sessionId", UUID.randomUUID().toString());
        currentBufferMode = "media3";
        currentVoice = voice;
        currentRate = rate;
        currentPitch = pitch;
        currentPlayIndex = safeStartIndex;
        currentChunks.clear();
        for (ReadAloudUtterance utterance : utterances) currentChunks.add(utterance.getText());
        isStreamingPlaying = true;
        isMedia3Active = true;
        Media3ReadAloudBridge.registerListener(this);
        Media3ReadAloudBridge.start(
                getContext(),
                new ReadAloudSessionRequest(
                        sessionId,
                        utterances,
                        safeStartIndex,
                        voice,
                        rate,
                        pitch,
                        currentBookTitle,
                        currentChapterTitle
                )
        );
        call.resolve();
    }

    private List<String> parseChunks(JSArray chunksArray) {
        List<String> chunks = new ArrayList<>();
        for (int index = 0; index < chunksArray.length(); index++) {
            String text = chunksArray.optString(index, "");
            chunks.add(text);
        }
        return chunks;
    }

    private List<ReadAloudUtterance> parseUtterances(JSArray utterancesArray) {
        if (utterancesArray == null || utterancesArray.length() == 0) return Collections.emptyList();
        List<ReadAloudUtterance> utterances = new ArrayList<>();
        for (int index = 0; index < utterancesArray.length(); index++) {
            JSONObject item = utterancesArray.optJSONObject(index);
            if (item == null) continue;
            String text = item.optString("text", "").trim();
            if (text.isEmpty()) continue;
            utterances.add(new ReadAloudUtterance(
                    item.optString("id", "utterance-" + index),
                    item.optInt("paragraphIndex", index),
                    item.optInt("sourceStart", 0),
                    item.optInt("sourceLength", text.length()),
                    text,
                    item.optInt("sourceChunkIndex", index)
            ));
        }
        return utterances;
    }

    private void prefetchChunk(int index) {
        prefetchChunk(index, streamingSessionId);
    }

    private void prefetchChunk(int index, long sessionId) {
        if (index < 0 || index >= currentChunks.size() || !isStreamingPlaying || sessionId != streamingSessionId) return;
        if (hasReadyAudio(index) || inFlightIndices.contains(index)) return;

        inFlightIndices.add(index);
        String text = currentChunks.get(index);
        if (text == null || text.trim().isEmpty()) {
            inFlightIndices.remove(index);
            return;
        }

        prefetchExecutor.submit(() -> {
            if (sessionId != streamingSessionId || !isStreamingPlaying) {
                inFlightIndices.remove(index);
                return;
            }

            try {
                String wssUrl = EdgeAuth.buildWebSocketUrl();
                Request request = EdgeAuth.buildWebSocketRequest(wssUrl);

                ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
                JSONArray wordBoundaries = new JSONArray();
                String requestId = UUID.randomUUID().toString().replace("-", "");
                String cleanSourceText = Normalizer.normalize(text, Normalizer.Form.NFC);
                String foldedSourceText = cleanSourceText.toLowerCase(Locale.ROOT);
                int[] searchOffset = {0};
                final long fetchStartTime = System.currentTimeMillis();

                WebSocket webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
                    @Override
                    public void onOpen(WebSocket webSocket, Response response) {
                        if (sessionId != streamingSessionId || !isStreamingPlaying) {
                            webSocket.close(1000, "Aborted");
                            inFlightIndices.remove(index);
                            activeSockets.remove(index);
                            return;
                        }

                        try {
                            // Ghi log Logcat nội bộ thiết bị khi bắt đầu kết nối tải audio câu
                            Log.d(TAG, "[EdgeTTS:Stream] Đang kết nối tải audio câu " + (index + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(text) + "\"");

                            webSocket.send(EdgeAuth.buildSpeechConfigMessage());
                            webSocket.send(EdgeAuth.buildSsmlMessage(requestId, currentVoice, currentRate, currentPitch, cleanSourceText));
                        } catch (Exception ex) {
                            webSocket.close(1001, "Error");
                            inFlightIndices.remove(index);
                            activeSockets.remove(index);
                            handlePrefetchFailure(index, text, ex.getMessage(), sessionId);
                        }
                    }

                    @Override
                    public void onMessage(WebSocket webSocket, ByteString bytes) {
                        if (sessionId != streamingSessionId || !isStreamingPlaying) return;
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
                        if (sessionId != streamingSessionId || !isStreamingPlaying) return;
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
                                                    String rawWord = textData != null ? textData.optString("Text", "") : "";
                                                    if (!rawWord.trim().isEmpty()) {
                                                        String normWord = Normalizer.normalize(rawWord.trim(), Normalizer.Form.NFC);
                                                        String cleanWord = normWord.toLowerCase(Locale.ROOT);
                                                        String stripped = cleanWord.replaceAll("^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$", "");

                                                        if (!stripped.isEmpty()) {
                                                            int charIndex = foldedSourceText.indexOf(cleanWord, searchOffset[0]);
                                                            int matchedLen = cleanWord.length();
                                                            if (charIndex < 0) {
                                                                charIndex = foldedSourceText.indexOf(stripped, searchOffset[0]);
                                                                matchedLen = stripped.length();
                                                            }
                                                            if (charIndex < 0 && searchOffset[0] > 0) {
                                                                charIndex = foldedSourceText.indexOf(stripped, Math.max(0, searchOffset[0] - 6));
                                                                matchedLen = stripped.length();
                                                            }

                                                            if (charIndex >= 0) {
                                                                searchOffset[0] = charIndex + matchedLen;
                                                                JSONObject wb = new JSONObject();
                                                                wb.put("text", rawWord);
                                                                wb.put("charIndex", charIndex);
                                                                wb.put("charLength", matchedLen);
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
                                        }
                                    }
                                }
                            } else if (textMsg.contains("Path:turn.end")) {
                                byte[] audioBytes = audioBuffer.toByteArray();
                                if (sessionId != streamingSessionId || !isStreamingPlaying) {
                                    inFlightIndices.remove(index);
                                    activeSockets.remove(index);
                                    webSocket.close(1000, "Aborted");
                                    return;
                                }

                                if (audioBytes.length == 0) {
                                    inFlightIndices.remove(index);
                                    activeSockets.remove(index);
                                    webSocket.close(1000, "Empty audio");
                                    handlePrefetchFailure(index, text, "Không nhận được âm thanh từ máy chủ Edge TTS", sessionId);
                                    return;
                                }

                                if (isMemoryMode()) {
                                    readyAudioBytes.put(index, audioBytes);
                                    readyWordBoundaries.put(index, wordBoundaries);
                                    long elapsed = System.currentTimeMillis() - fetchStartTime;

                                    Log.d(TAG, "[EdgeTTS:Memory] Đã nạp xong RAM câu " + (index + 1) + "/" + currentChunks.size() + " (" + audioBytes.length + " bytes, " + wordBoundaries.length() + " từ, " + elapsed + "ms): \"" + RemoteLogger.formatSnippet(text) + "\"");

                                    retryManager.recordSuccess(index);
                                    inFlightIndices.remove(index);
                                    activeSockets.remove(index);
                                    webSocket.close(1000, "Done");

                                    getBridge().getActivity().runOnUiThread(() -> onChunkAudioReady(index, sessionId));
                                    return;
                                }

                                File chunkFile = cacheManager.getChunkFile(index);
                                try (FileOutputStream fos = new FileOutputStream(chunkFile)) {
                                    fos.write(audioBytes);
                                }

                                // Nếu trong quá trình ghi file phiên phát đã bị hủy thì xóa file ngay lập tức
                                if (sessionId != streamingSessionId || !isStreamingPlaying) {
                                    if (chunkFile.exists()) {
                                        chunkFile.delete();
                                    }
                                    inFlightIndices.remove(index);
                                    activeSockets.remove(index);
                                    webSocket.close(1000, "Aborted");
                                    return;
                                }

                                readyAudioFiles.put(index, chunkFile);
                                readyWordBoundaries.put(index, wordBoundaries);
                                long elapsed = System.currentTimeMillis() - fetchStartTime;

                                // Ghi log Logcat nội bộ thiết bị khi nạp xong audio câu, tránh gửi HTTP RemoteLogger gây spam
                                Log.d(TAG, "[EdgeTTS:Stream] Đã nạp xong audio câu " + (index + 1) + "/" + currentChunks.size() + " (" + audioBytes.length + " bytes, " + wordBoundaries.length() + " từ, " + elapsed + "ms): \"" + RemoteLogger.formatSnippet(text) + "\"");

                                // Xóa bộ đếm retry khi nạp thành công
                                retryManager.recordSuccess(index);

                                // Dọn dẹp cờ inFlight trước khi gọi onChunkAudioReady để maintainRollingBuffer thấy slot trống
                                inFlightIndices.remove(index);
                                activeSockets.remove(index);
                                webSocket.close(1000, "Done");

                                getBridge().getActivity().runOnUiThread(() -> onChunkAudioReady(index, sessionId));
                            }
                        } catch (Exception ex) {
                            Log.e(TAG, "[EdgeTTS:Stream] Lỗi lưu cache audio câu " + index, ex);
                            inFlightIndices.remove(index);
                            activeSockets.remove(index);
                            handlePrefetchFailure(index, text, ex.getMessage(), sessionId);
                        }
                    }

                    @Override
                    public void onClosing(WebSocket webSocket, int code, String reason) {
                        inFlightIndices.remove(index);
                        activeSockets.remove(index);
                    }

                    @Override
                    public void onClosed(WebSocket webSocket, int code, String reason) {
                        inFlightIndices.remove(index);
                        activeSockets.remove(index);
                    }

                    @Override
                    public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                        String errMsg = (t != null ? t.getMessage() : "Unknown");
                        inFlightIndices.remove(index);
                        activeSockets.remove(index);
                        handlePrefetchFailure(index, text, errMsg, sessionId);
                    }
                });

                activeSockets.put(index, webSocket);
            } catch (Exception ex) {
                inFlightIndices.remove(index);
                activeSockets.remove(index);
                handlePrefetchFailure(index, text, ex.getMessage(), sessionId);
            }
        });
    }

    /**
     * Tự động thử lại khi tải audio câu gặp sự cố (Linear Backoff Retry):
     * Nếu lỗi mạng (Connection reset, timeout), tự động thử lại tối đa 3 lần sau 500ms, 1000ms, 1500ms.
     * Nếu thất bại cả 3 lần và câu này là câu đang chờ phát, tự động skip sang câu tiếp theo để tránh đứng app.
     */
    private void handlePrefetchFailure(int index, String text, String errMsg, long sessionId) {
        if (!isStreamingPlaying || sessionId != streamingSessionId) return;

        JSONObject failDetails = new JSONObject();
        try {
            failDetails.put("chunkIndex", index);
            failDetails.put("totalChunks", currentChunks.size());
            failDetails.put("snippet", RemoteLogger.formatSnippet(text));
            failDetails.put("error", errMsg);
            failDetails.put("bufferMode", currentBufferMode);
        } catch (Exception ignored) {}

        if (retryManager.canRetry(index)) {
            int attempt = retryManager.recordFailure(index);
            long delayMs = retryManager.getDelayMs(index);

            // Ghi cảnh báo Logcat nội bộ khi tự động thử lại, tránh spam remote log do gián đoạn mạng tạm thời
            Log.w(TAG, "[EdgeTTS:Stream] Lỗi tải audio câu " + (index + 1) + "/" + currentChunks.size()
                    + " (" + errMsg + "), tự động thử lại lần " + attempt + "/" + PrefetchRetryManager.DEFAULT_MAX_RETRIES + " sau " + delayMs + "ms...");

            mainHandler.postDelayed(() -> {
                if (isStreamingPlaying && sessionId == streamingSessionId && !hasReadyAudio(index)) {
                    prefetchChunk(index, sessionId);
                }
            }, delayMs);
        } else {
            RemoteLogger.log("EdgeTTSNative_Stream", "error",
                    "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Thất bại tải audio câu " + (index + 1) + "/" + currentChunks.size()
                            + " sau " + PrefetchRetryManager.DEFAULT_MAX_RETRIES + " lần thử: " + errMsg + " - Nội dung: \"" + RemoteLogger.formatSnippet(text) + "\"",
                    errMsg, failDetails);

            // Tự động bỏ qua câu lỗi nếu người dùng đang chờ câu này phát để không bị treo vĩnh viễn ở trạng thái Buffering
            if (index == currentPlayIndex && !player.hasCurrentPlayer()) {
                RemoteLogger.log("EdgeTTSNative_Stream", "warn",
                        "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Tự động bỏ qua câu lỗi " + (index + 1) + " để tiếp tục phát câu " + (index + 2) + "/" + currentChunks.size(),
                        null, failDetails);
                int next = index + 1;
                if (next < currentChunks.size()) {
                    seekToChunkInternal(next);
                } else {
                    stopPlaybackInternal(false);
                    notifyListeners("onPlaybackComplete", new JSObject());
                }
            }
        }
    }

    private void onChunkAudioReady(int index, long sessionId) {
        if (!isStreamingPlaying || sessionId != streamingSessionId) return;

        // Nếu là câu hiện tại cần đọc và player chưa phát: Khởi động phát ngay (tránh bế tắc logic khi player.currentChunkIndex = -1)
        if (index == currentPlayIndex && !player.hasCurrentPlayer()) {
            playChunkAudio(index);
        } else if (index == currentPlayIndex + 1 && player.hasCurrentPlayer() && !player.hasNextPlayer()) {
            prepareNextAudio(index);
            String nextText = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
            // Ghi log Logcat nội bộ khi chuẩn bị sẵn sàng gapless cho câu tiếp theo
            Log.d(TAG, "[EdgeTTS:Stream] Đã chuẩn bị gapless câu tiếp theo " + (index + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(nextText) + "\"");
        }

        maintainRollingBuffer();
    }

    private void handleChunkCompleted(int completedIndex) {
        if (!isStreamingPlaying) return;

        int nextIdx = completedIndex + 1;
        currentPlayIndex = nextIdx;
        if (nextIdx < currentChunks.size()) {
            // Nếu GaplessStreamPlayer đã tự động chuyển sang nextPlayer (0ms gapless transition)
            if (player.hasCurrentPlayer() && player.getCurrentChunkIndex() == nextIdx) {
                maintainRollingBuffer();
                return;
            }

            JSObject state = new JSObject();
            state.put("isPlaying", true);
            state.put("isPaused", false);
            state.put("isBuffering", true);
            notifyListeners("onPlaybackStateChange", state);

            if (hasReadyAudio(nextIdx)) {
                playChunkAudio(nextIdx);
            } else {
                cancelPendingPrefetches(nextIdx);
                prefetchChunk(nextIdx);
            }
            maintainRollingBuffer();
        } else {
            JSONObject allDoneDetails = new JSONObject();
            try {
                allDoneDetails.put("totalChunks", currentChunks.size());
                allDoneDetails.put("bufferMode", currentBufferMode);
            } catch (Exception ignored) {}
            RemoteLogger.log("EdgeTTSNative_Stream", "info", "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Hoàn tất đọc hết toàn bộ chương (" + currentChunks.size() + " câu)", null, allDoneDetails);

            stopPlaybackInternal(false);
            notifyListeners("onPlaybackComplete", new JSObject());
        }
    }

    private void maintainRollingBuffer() {
        if (!isStreamingPlaying || player.isPaused()) return;

        int currentIdx = (player != null && player.hasCurrentPlayer()) ? player.getCurrentChunkIndex() : currentPlayIndex;
        evictOldChunks(currentIdx);

        // 1. Strict Priority: if currentPlayIndex is not yet ready, fetch it first
        if (!hasReadyAudio(currentPlayIndex) && currentPlayIndex >= 0 && currentPlayIndex < currentChunks.size()) {
            cancelPendingPrefetches(currentPlayIndex);
            prefetchChunk(currentPlayIndex);
            return;
        }

        // 2. Prepare nextPlayer gapless transition if nextIdx is in cache
        int nextIdx = currentIdx + 1;
        if (nextIdx < currentChunks.size() && hasReadyAudio(nextIdx) && !player.hasNextPlayer() && player.hasCurrentPlayer()) {
            prepareNextAudio(nextIdx);
        }

        // 3. Continuous Rolling Buffer:
        // Đảm bảo các câu từ currentIdx + 1 đến currentIdx + BUFFER_LOOKAHEAD đều được nạp sẵn.
        // Cho phép tối đa MAX_CONCURRENT_PREFETCH (2 task) cùng tải song song để lấp đầy bộ đệm gối đầu mà không nghẽn mạng.
        int maxLookahead = Math.min(currentChunks.size() - 1, currentIdx + AudioCacheManager.BUFFER_LOOKAHEAD);
        for (int i = currentIdx + 1; i <= maxLookahead; i++) {
            if (inFlightIndices.size() >= MAX_CONCURRENT_PREFETCH) {
                break;
            }
            if (!hasReadyAudio(i) && !inFlightIndices.contains(i)) {
                prefetchChunk(i);
            }
        }
    }

    private void cancelPendingPrefetches(int keepIndex) {
        for (Map.Entry<Integer, WebSocket> entry : activeSockets.entrySet()) {
            int idx = entry.getKey();
            if (idx != keepIndex) {
                try {
                    entry.getValue().cancel();
                } catch (Exception ignored) {}
                activeSockets.remove(idx);
                inFlightIndices.remove(idx);
            }
        }
    }

    @PluginMethod
    public void pausePlayback(PluginCall call) {
        if (isMedia3Active) {
            Media3ReadAloudBridge.pause(getContext());
            call.resolve();
            return;
        }
        player.pause();
        int currentIdx = player.getCurrentChunkIndex();
        String pausedText = (currentIdx >= 0 && currentIdx < currentChunks.size()) ? currentChunks.get(currentIdx) : "";
        JSONObject pauseDetails = new JSONObject();
        try {
            pauseDetails.put("chunkIndex", currentIdx);
            pauseDetails.put("totalChunks", currentChunks.size());
            pauseDetails.put("bufferMode", currentBufferMode);
            pauseDetails.put("snippet", RemoteLogger.formatSnippet(pausedText));
        } catch (Exception ignored) {}
        RemoteLogger.log("EdgeTTSNative_Stream", "info", "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Tạm dừng đọc ở câu " + (currentIdx + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(pausedText) + "\"", null, pauseDetails);
        call.resolve();
    }

    @PluginMethod
    public void resumePlayback(PluginCall call) {
        if (isMedia3Active) {
            Media3ReadAloudBridge.resume(getContext());
            call.resolve();
            return;
        }
        player.resume();
        int currentIdx = player.getCurrentChunkIndex();
        String resumeText = (currentIdx >= 0 && currentIdx < currentChunks.size()) ? currentChunks.get(currentIdx) : "";
        JSONObject resumeDetails = new JSONObject();
        try {
            resumeDetails.put("chunkIndex", currentIdx);
            resumeDetails.put("totalChunks", currentChunks.size());
            resumeDetails.put("bufferMode", currentBufferMode);
            resumeDetails.put("snippet", RemoteLogger.formatSnippet(resumeText));
        } catch (Exception ignored) {}
        RemoteLogger.log("EdgeTTSNative_Stream", "info", "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Tiếp tục đọc câu " + (currentIdx + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(resumeText) + "\"", null, resumeDetails);
        maintainRollingBuffer();
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        stopPlaybackInternal(true);
        call.resolve();
    }

    /**
     * Chuyển đến vị trí câu chỉ định (seek):
     * Dùng chung cho cả lệnh từ Web và lệnh từ nút Next / Previous trên Notification / Lock Screen.
     */
    public void seekToChunkInternal(int targetIndex) {
        if (targetIndex < 0 || targetIndex >= currentChunks.size()) return;

        final long sessionId;
        synchronized (this) {
            sessionId = ++streamingSessionId;
            currentPlayIndex = targetIndex;
            player.reset();
            player.setWordBoundariesSource(readyWordBoundaries);
            cancelPendingPrefetches(targetIndex);
            retryManager.reset();
        }

        JSObject state = new JSObject();
        state.put("isPlaying", true);
        state.put("isPaused", false);
        state.put("isBuffering", true);
        notifyListeners("onPlaybackStateChange", state);

        if (hasReadyAudio(targetIndex)) {
            playChunkAudio(targetIndex);
        } else {
            prefetchChunk(targetIndex, sessionId);
        }
        maintainRollingBuffer();
    }

    @PluginMethod
    public void seekToChunk(PluginCall call) {
        int targetIndex = call.getInt("chunkIndex", 0);
        if (targetIndex < 0 || targetIndex >= currentChunks.size()) {
            call.reject("Index out of bounds", "INVALID_INDEX");
            return;
        }

        if (isMedia3Active) {
            Media3ReadAloudBridge.seek(getContext(), targetIndex);
            call.resolve();
            return;
        }

        seekToChunkInternal(targetIndex);
        call.resolve();
    }

    /**
     * Dừng phát hoàn toàn phiên đọc hiện tại:
     * Dọn dẹp sạch sẽ toàn bộ cache file âm thanh trên đĩa và trong bộ nhớ RAM,
     * vô hiệu hóa toàn bộ prefetch đang chạy để sẵn sàng cho một flow đọc hoàn toàn mới.
     *
     * @param emitEvent Có phát sự kiện onPlaybackStateChange hay không
     */
    private synchronized void stopPlaybackInternal(boolean emitEvent) {
        boolean wasActive = isStreamingPlaying
                || (player != null && (player.isPlayingSafely() || player.isPaused()))
                || (!currentChunks.isEmpty() && player != null && player.getCurrentChunkIndex() >= 0);

        int currentIdx = (player != null) ? player.getCurrentChunkIndex() : -1;
        int total = currentChunks.size();

        if (isMedia3Active) {
            Media3ReadAloudBridge.stop(getContext());
            Media3ReadAloudBridge.unregisterListener(this);
            isMedia3Active = false;
        }

        // Tăng streamingSessionId để vô hiệu hóa ngay lập tức toàn bộ các task tải trước đang chờ trong ThreadPool
        streamingSessionId++;
        isStreamingPlaying = false;
        currentPlayIndex = 0;
        lastChunkLogTime = 0;

        cancelPendingPrefetches(-1);
        activeSockets.clear();
        inFlightIndices.clear();

        if (player != null) {
            player.clearCache();
        }
        retryManager.reset();

        // Hủy đăng ký listener và thu hồi Notification trên thanh thông báo / màn hình khóa
        StoriesAudioBridge.unregisterListener(this);
        StoriesAudioBridge.stopPlayback(getContext());

        // Dọn dẹp sạch sẽ bộ nhớ đệm RAM và xóa toàn bộ file âm thanh đã tải trên đĩa để bắt đầu flow mới
        readyAudioFiles.clear();
        readyAudioBytes.clear();
        readyWordBoundaries.clear();
        if (cacheManager != null && !isMemoryMode()) {
            cacheManager.cleanCacheDir(true);
        }

        if (emitEvent && wasActive) {
            JSObject state = new JSObject();
            state.put("isPlaying", false);
            state.put("isPaused", false);
            state.put("isBuffering", false);
            notifyListeners("onPlaybackStateChange", state);

            // Chỉ ghi log remote telemetry khi thực sự có phiên đọc đang hoạt động và câu đọc hợp lệ
            if (total > 0 && currentIdx >= 0) {
                JSONObject stopDetails = new JSONObject();
                try {
                    stopDetails.put("lastChunkIndex", currentIdx);
                    stopDetails.put("totalChunks", total);
                    stopDetails.put("bufferMode", currentBufferMode);
                } catch (Exception ignored) {}
                RemoteLogger.log("EdgeTTSNative_Stream", "info", "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Dừng đọc chương và dọn dẹp cache tại câu " + (currentIdx + 1) + "/" + total, null, stopDetails);
            }
        }

        currentChunks.clear();
    }

    // ==========================================
    // Callbacks điều khiển từ Notification / Lock Screen (StoriesAudioBridge.AudioControlListener)
    // ==========================================

    @Override
    public void onPlayRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null && player.isPaused()) {
                    player.resume();
                    maintainRollingBuffer();
                }
            });
        }
    }

    @Override
    public void onPauseRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null && player.isPlayingSafely()) {
                    player.pause();
                }
            });
        }
    }

    @Override
    public void onNextRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null) {
                    int currentIdx = player.hasCurrentPlayer() ? player.getCurrentChunkIndex() : currentPlayIndex;
                    int next = currentIdx + 1;
                    if (next < currentChunks.size()) {
                        seekToChunkInternal(next);
                    }
                }
            });
        }
    }

    @Override
    public void onPreviousRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null) {
                    int currentIdx = player.hasCurrentPlayer() ? player.getCurrentChunkIndex() : currentPlayIndex;
                    int prev = currentIdx - 1;
                    if (prev >= 0) {
                        seekToChunkInternal(prev);
                    }
                }
            });
        }
    }

    @Override
    public void onStopRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                stopPlaybackInternal(true);
            });
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (isMedia3Active) {
            Media3ReadAloudBridge.unregisterListener(this);
            player.clearCache();
            cacheManager.cleanCacheDir(true);
            prefetchExecutor.shutdownNow();
            super.handleOnDestroy();
            return;
        }
        stopPlaybackInternal(false);
        cacheManager.cleanCacheDir(true);
        try {
            prefetchExecutor.shutdownNow();
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }

    @Override
    public void onSnapshot(PlaybackSnapshot snapshot) {
        boolean isTerminal = snapshot.getState() == PlaybackSnapshot.State.IDLE
                || snapshot.getState() == PlaybackSnapshot.State.COMPLETED
                || snapshot.getState() == PlaybackSnapshot.State.ERROR;
        isMedia3Active = !isTerminal;
        if (isMedia3Active) currentBufferMode = "media3";

        JSObject event = snapshotToJs(snapshot);
        notifyListeners("onPlaybackSnapshot", event);

        JSObject legacyState = new JSObject();
        legacyState.put("sessionId", snapshot.getSessionId());
        legacyState.put("isPlaying", snapshot.getState() == PlaybackSnapshot.State.PLAYING);
        legacyState.put("isPaused", snapshot.getState() == PlaybackSnapshot.State.PAUSED);
        legacyState.put("isBuffering", snapshot.getState() == PlaybackSnapshot.State.CONNECTING || snapshot.getState() == PlaybackSnapshot.State.BUFFERING);
        notifyListeners("onPlaybackStateChange", legacyState);
    }

    @Override
    public void onUtteranceStart(String sessionId, int utteranceIndex, ReadAloudUtterance utterance) {
        currentPlayIndex = utteranceIndex;
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        event.put("chunkIndex", utterance.getSourceChunkIndex());
        event.put("utteranceIndex", utteranceIndex);
        event.put("paragraphIndex", utterance.getParagraphIndex());
        event.put("sourceStart", utterance.getSourceStart());
        event.put("sourceLength", utterance.getSourceLength());
        notifyListeners("onChunkStart", event);
    }

    @Override
    public void onWordBoundary(String sessionId, int utteranceIndex, ReadAloudUtterance utterance, WordBoundary boundary) {
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        event.put("chunkIndex", utterance.getSourceChunkIndex());
        event.put("utteranceIndex", utteranceIndex);
        event.put("paragraphIndex", utterance.getParagraphIndex());
        event.put("sourceStart", utterance.getSourceStart());
        event.put("sourceLength", utterance.getSourceLength());
        event.put("charIndex", boundary.getCharIndex());
        event.put("charLength", boundary.getCharLength());
        event.put("text", boundary.getText());
        notifyListeners("onWordBoundary", event);
    }

    @Override
    public void onCompleted(String sessionId) {
        isMedia3Active = false;
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        notifyListeners("onPlaybackComplete", event);
    }

    @Override
    public void onError(String sessionId, int utteranceIndex, String code, String message) {
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        event.put("chunkIndex", utteranceIndex);
        event.put("code", code);
        event.put("message", message);
        notifyListeners("onError", event);
    }

    @PluginMethod
    public void getPlaybackSnapshot(PluginCall call) {
        call.resolve(snapshotToJs(Media3ReadAloudBridge.getLatestSnapshot()));
    }

    private JSObject snapshotToJs(PlaybackSnapshot snapshot) {
        JSObject event = new JSObject();
        event.put("sessionId", snapshot.getSessionId());
        event.put("state", snapshot.getState().name());
        event.put("utteranceIndex", snapshot.getUtteranceIndex());
        event.put("positionMs", snapshot.getPositionMs());
        event.put("bufferedDurationMs", snapshot.getBufferedDurationMs());
        event.put("rebufferCount", snapshot.getRebufferCount());
        event.put("firstAudioLatencyMs", snapshot.getFirstAudioLatencyMs());
        event.put("lastBufferingDurationMs", snapshot.getLastBufferingDurationMs());
        if (snapshot.getErrorCode() != null) event.put("errorCode", snapshot.getErrorCode());
        return event;
    }
}
