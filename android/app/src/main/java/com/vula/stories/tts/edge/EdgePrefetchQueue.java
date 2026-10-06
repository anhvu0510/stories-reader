package com.vula.stories.tts.edge;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.vula.stories.player.PrefetchRetryManager;
import com.vula.stories.player.source.AudioSource;
import com.vula.stories.player.source.FileAudioSource;
import com.vula.stories.player.source.MemoryAudioSource;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import okhttp3.WebSocket;

/**
 * Quản lý hàng đợi tải trước (Prefetch Queue) cho luồng đọc âm thanh Edge TTS.
 * Đóng gói quy trình:
 * - Tải trước cuốn chiếu (lookahead 1-2 câu).
 * - Giới hạn số lượng kết nối đồng thời (Max In-Flight = 2).
 * - Lưu trữ kết quả vào RAM (MemoryAudioSource) hoặc Tệp đĩa (FileAudioSource).
 * - Tự động thử lại khi lỗi mạng (Linear Backoff qua PrefetchRetryManager).
 */
public class EdgePrefetchQueue {

    private static final String TAG = "EdgePrefetchQueue";
    public static final int MAX_IN_FLIGHT = 2;
    public static final int DEFAULT_LOOKAHEAD = 2;

    public interface PrefetchListener {
        void onChunkReady(int index, AudioSource source);
        void onChunkFailed(int index, String reason);
    }

    private final EdgeWebSocketClient client;
    private final AudioCacheManager cacheManager;
    private final PrefetchRetryManager retryManager;
    private final Handler mainHandler;

    private List<String> chunks = Collections.emptyList();
    private String voice = "";
    private String rate = "default";
    private String pitch = "default";
    private String bufferMode = "file";
    private PrefetchListener listener;

    private final Map<Integer, AudioSource> readySources = new ConcurrentHashMap<>();
    private final Map<Integer, JSONArray> wordBoundariesSource = new ConcurrentHashMap<>();
    private final Map<Integer, WebSocket> activeSockets = new ConcurrentHashMap<>();
    private final Set<Integer> inFlightIndices = Collections.newSetFromMap(new ConcurrentHashMap<>());

    public EdgePrefetchQueue(Context context) {
        this(new EdgeWebSocketClient(), new AudioCacheManager(context), new PrefetchRetryManager());
    }

    public EdgePrefetchQueue(EdgeWebSocketClient client, AudioCacheManager cacheManager, PrefetchRetryManager retryManager) {
        this.client = client;
        this.cacheManager = cacheManager;
        this.retryManager = retryManager;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public synchronized void configure(
            List<String> chunks,
            String voice,
            String rate,
            String pitch,
            String bufferMode,
            PrefetchListener listener
    ) {
        cancelAll();
        clear();
        this.chunks = chunks != null ? chunks : Collections.emptyList();
        this.voice = voice;
        this.rate = rate;
        this.pitch = pitch;
        this.bufferMode = (bufferMode != null && !bufferMode.trim().isEmpty()) ? bufferMode : "file";
        this.listener = listener;
    }

    /**
     * Kích hoạt tải trước các câu tiếp theo theo số lượng chỉ định.
     */
    public synchronized void prefetchAhead(int currentIndex, int lookaheadCount) {
        if (chunks.isEmpty() || currentIndex < 0) {
            return;
        }

        int count = Math.max(1, lookaheadCount);
        for (int step = 1; step <= count; step++) {
            int targetIndex = currentIndex + step;
            if (targetIndex >= chunks.size()) {
                break;
            }
            if (inFlightIndices.size() >= MAX_IN_FLIGHT) {
                break;
            }
            startFetch(targetIndex);
        }
    }

    /**
     * Tải hoặc tổng hợp một câu cụ thể.
     */
    public synchronized void startFetch(int index) {
        if (index < 0 || index >= chunks.size()) {
            return;
        }
        if (readySources.containsKey(index) || inFlightIndices.contains(index)) {
            return;
        }

        // Kiểm tra nếu câu đã có sẵn trên tệp đĩa cache (chế độ File)
        boolean isMemoryMode = "memory".equalsIgnoreCase(bufferMode);
        if (!isMemoryMode) {
            File cachedFile = cacheManager.getChunkFile(index);
            if (cachedFile != null && cachedFile.exists() && cachedFile.length() > 0) {
                AudioSource fileSource = new FileAudioSource(cachedFile);
                readySources.put(index, fileSource);
                notifyReady(index, fileSource);
                return;
            }
        }

        inFlightIndices.add(index);
        String text = chunks.get(index);
        JSONArray boundaries = new JSONArray();
        wordBoundariesSource.put(index, boundaries);

        WebSocket ws = client.synthesize(text, voice, rate, pitch, new EdgeWebSocketClient.SynthesisListener() {
            @Override
            public void onOpen() {
                // Đã kết nối WebSocket thành công
            }

            @Override
            public void onAudioChunk(byte[] chunk) {
                // Nhận từng mảng byte âm thanh
            }

            @Override
            public void onWordBoundary(JSONObject boundary) {
                if (boundary != null) {
                    synchronized (boundaries) {
                        boundaries.put(boundary);
                    }
                }
            }

            @Override
            public void onComplete(byte[] fullAudio) {
                activeSockets.remove(index);
                inFlightIndices.remove(index);
                retryManager.recordSuccess(index);

                AudioSource source = createAndSaveSource(index, fullAudio, isMemoryMode);
                if (source != null) {
                    readySources.put(index, source);
                    notifyReady(index, source);
                }
            }

            @Override
            public void onFailure(int statusCode, String message, Throwable cause) {
                activeSockets.remove(index);
                inFlightIndices.remove(index);
                handleFetchFailure(index, message);
            }
        });

        if (ws != null) {
            activeSockets.put(index, ws);
        }
    }

    private AudioSource createAndSaveSource(int index, byte[] fullAudio, boolean isMemoryMode) {
        if (fullAudio == null || fullAudio.length == 0) {
            return null;
        }

        if (isMemoryMode) {
            return new MemoryAudioSource(fullAudio);
        }

        File cacheFile = cacheManager.getChunkFile(index);
        if (cacheFile == null) {
            return new MemoryAudioSource(fullAudio);
        }

        try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
            fos.write(fullAudio);
            fos.flush();
            return new FileAudioSource(cacheFile);
        } catch (Exception ex) {
            Log.w(TAG, "Lỗi khi ghi tệp cache cho câu " + index + ", fallback về RAM: " + ex.getMessage());
            return new MemoryAudioSource(fullAudio);
        }
    }

    private void handleFetchFailure(int index, String reason) {
        if (retryManager.canRetry(index)) {
            retryManager.recordFailure(index);
            long delay = retryManager.getDelayMs(index);
            Log.d(TAG, "Thử lại tải câu " + index + " sau " + delay + "ms...");
            mainHandler.postDelayed(() -> startFetch(index), delay);
            return;
        }

        Log.w(TAG, "Hết số lần thử lại câu " + index + ": " + reason);
        if (listener != null) {
            mainHandler.post(() -> listener.onChunkFailed(index, reason));
        }
    }

    private void notifyReady(int index, AudioSource source) {
        if (listener != null) {
            mainHandler.post(() -> listener.onChunkReady(index, source));
        }
    }

    public AudioSource getAudioSource(int index) {
        return readySources.get(index);
    }

    public boolean isChunkReady(int index) {
        return readySources.containsKey(index);
    }

    public Map<Integer, JSONArray> getWordBoundariesSource() {
        return wordBoundariesSource;
    }

    public synchronized void cancelAll() {
        for (Map.Entry<Integer, WebSocket> entry : activeSockets.entrySet()) {
            try {
                entry.getValue().close(1000, "Hủy tải trước");
            } catch (Exception e) {
                Log.w(TAG, "Lỗi đóng WebSocket câu " + entry.getKey() + ": " + e.getMessage());
            }
        }
        activeSockets.clear();
        inFlightIndices.clear();
    }

    public synchronized void clear() {
        cancelAll();
        readySources.clear();
        wordBoundariesSource.clear();
        chunks = Collections.emptyList();
    }
}
