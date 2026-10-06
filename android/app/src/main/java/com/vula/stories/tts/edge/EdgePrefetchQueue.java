package com.vula.stories.tts.edge;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.vula.stories.player.PrefetchRetryManager;
import com.vula.stories.player.source.AudioSource;
import com.vula.stories.player.source.FileAudioSource;
import com.vula.stories.player.source.MemoryAudioSource;
import com.vula.stories.tts.edge.segment.ClauseSegment;
import com.vula.stories.tts.edge.segment.ClauseSegmenter;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import okhttp3.WebSocket;

/**
 * Hàng đợi tải trước thích ứng theo phân đoạn (Adaptive Clause Prefetch Queue).
 * Đóng gói quy trình:
 * - Tự động phân đoạn câu dài qua ClauseSegmenter để giảm TTFA < 300ms.
 * - Tải trước cuốn chiếu gối đầu các phân đoạn (Clause Segments) và câu tiếp theo.
 * - Ánh xạ tự động vị trí ranh giới từ vựng (Word Boundary Offset Mapping) bảo toàn 100% UI.
 * - Thử lại tự động qua PrefetchRetryManager khi gặp sự cố mạng.
 */
public class EdgePrefetchQueue {

    private static final String TAG = "EdgePrefetchQueue";
    public static final int MAX_IN_FLIGHT = 2;
    public static final int DEFAULT_LOOKAHEAD = 2;

    public static class SegmentKey {
        public final int chunkIndex;
        public final int segmentIndex;

        public SegmentKey(int chunkIndex, int segmentIndex) {
            this.chunkIndex = chunkIndex;
            this.segmentIndex = segmentIndex;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            SegmentKey that = (SegmentKey) o;
            return chunkIndex == that.chunkIndex && segmentIndex == that.segmentIndex;
        }

        @Override
        public int hashCode() {
            return Objects.hash(chunkIndex, segmentIndex);
        }

        @Override
        public String toString() {
            return chunkIndex + ":" + segmentIndex;
        }
    }

    public interface PrefetchListener {
        void onSegmentReady(ClauseSegment segment, AudioSource source);
        void onSegmentFailed(ClauseSegment segment, String reason);
    }

    private final EdgeWebSocketClient client;
    private final AudioCacheManager cacheManager;
    private final PrefetchRetryManager retryManager;
    private final Handler mainHandler;

    private List<String> chunks = Collections.emptyList();
    private final Map<Integer, List<ClauseSegment>> segmentsCache = new ConcurrentHashMap<>();
    private String voice = "";
    private String rate = "default";
    private String pitch = "default";
    private String bufferMode = "file";
    private PrefetchListener listener;

    private final Map<SegmentKey, AudioSource> readySources = new ConcurrentHashMap<>();
    private final Map<Integer, JSONArray> wordBoundariesSource = new ConcurrentHashMap<>();
    private final Map<SegmentKey, WebSocket> activeSockets = new ConcurrentHashMap<>();
    private final Set<SegmentKey> inFlightSegments = Collections.newSetFromMap(new ConcurrentHashMap<>());

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
        this.chunks = (chunks != null) ? chunks : Collections.emptyList();
        this.voice = voice;
        this.rate = rate;
        this.pitch = pitch;
        this.bufferMode = (bufferMode != null && !bufferMode.trim().isEmpty()) ? bufferMode : "file";
        this.listener = listener;

        preCalculateSegments();
    }

    private void preCalculateSegments() {
        segmentsCache.clear();
        for (int i = 0; i < chunks.size(); i++) {
            List<ClauseSegment> segs = ClauseSegmenter.segment(i, chunks.get(i));
            segmentsCache.put(i, segs);
        }
    }

    public List<ClauseSegment> getSegments(int chunkIndex) {
        List<ClauseSegment> cached = segmentsCache.get(chunkIndex);
        if (cached != null) {
            return cached;
        }
        if (chunkIndex < 0 || chunkIndex >= chunks.size()) {
            return Collections.emptyList();
        }
        List<ClauseSegment> created = ClauseSegmenter.segment(chunkIndex, chunks.get(chunkIndex));
        segmentsCache.put(chunkIndex, created);
        return created;
    }

    public ClauseSegment getFirstSegment(int chunkIndex) {
        List<ClauseSegment> segs = getSegments(chunkIndex);
        return segs.isEmpty() ? null : segs.get(0);
    }

    public ClauseSegment getNextSegment(ClauseSegment current) {
        if (current == null) {
            return null;
        }
        List<ClauseSegment> segs = getSegments(current.parentChunkIndex);
        int nextIdx = current.segmentIndex + 1;
        if (nextIdx < segs.size()) {
            return segs.get(nextIdx);
        }
        return getFirstSegment(current.parentChunkIndex + 1);
    }

    public synchronized void prefetchAhead(int currentChunkIndex, int lookaheadCount) {
        if (chunks.isEmpty() || currentChunkIndex < 0) {
            return;
        }

        // 1. Ưu tiên tải nốt các phân đoạn còn lại của câu hiện tại
        List<ClauseSegment> currentSegs = getSegments(currentChunkIndex);
        for (ClauseSegment seg : currentSegs) {
            if (inFlightSegments.size() >= MAX_IN_FLIGHT) {
                return;
            }
            if (!isSegmentReady(seg)) {
                startFetch(seg);
            }
        }

        // 2. Tải trước các câu tiếp theo theo lookahead
        int count = Math.max(1, lookaheadCount);
        for (int step = 1; step <= count; step++) {
            int targetChunk = currentChunkIndex + step;
            if (targetChunk >= chunks.size()) {
                break;
            }
            List<ClauseSegment> targetSegs = getSegments(targetChunk);
            for (ClauseSegment seg : targetSegs) {
                if (inFlightSegments.size() >= MAX_IN_FLIGHT) {
                    return;
                }
                if (!isSegmentReady(seg)) {
                    startFetch(seg);
                }
            }
        }
    }

    public synchronized void startFetch(int chunkIndex) {
        ClauseSegment first = getFirstSegment(chunkIndex);
        if (first != null) {
            startFetch(first);
        }
    }

    public synchronized void startFetch(ClauseSegment segment) {
        if (segment == null) {
            return;
        }
        SegmentKey key = new SegmentKey(segment.parentChunkIndex, segment.segmentIndex);
        if (readySources.containsKey(key) || inFlightSegments.contains(key)) {
            return;
        }

        boolean isMemoryMode = "memory".equalsIgnoreCase(bufferMode);
        if (!isMemoryMode) {
            File cachedFile = cacheManager.getSegmentFile(segment.parentChunkIndex, segment.segmentIndex);
            if (cachedFile != null && cachedFile.exists() && cachedFile.length() > 0) {
                AudioSource fileSource = new FileAudioSource(cachedFile);
                readySources.put(key, fileSource);
                notifyReady(segment, fileSource);
                return;
            }
        }

        inFlightSegments.add(key);
        fetchFromNetwork(segment, key, isMemoryMode);
    }

    private void fetchFromNetwork(ClauseSegment segment, SegmentKey key, boolean isMemoryMode) {
        WebSocket ws = client.synthesize(segment.text, voice, rate, pitch, new EdgeWebSocketClient.SynthesisListener() {
            @Override
            public void onOpen() {
                // Đã mở kết nối WebSocket
            }

            @Override
            public void onAudioChunk(byte[] chunk) {
                // Nhận chunk âm thanh
            }

            @Override
            public void onWordBoundary(JSONObject boundary) {
                handleWordBoundary(segment, boundary);
            }

            @Override
            public void onComplete(byte[] fullAudio) {
                activeSockets.remove(key);
                inFlightSegments.remove(key);
                retryManager.recordSuccess(segment.parentChunkIndex);

                AudioSource source = createAndSaveSource(segment, fullAudio, isMemoryMode);
                if (source != null) {
                    readySources.put(key, source);
                    notifyReady(segment, source);
                }
            }

            @Override
            public void onFailure(int statusCode, String message, Throwable cause) {
                activeSockets.remove(key);
                inFlightSegments.remove(key);
                handleFetchFailure(segment, message);
            }
        });

        if (ws != null) {
            activeSockets.put(key, ws);
        }
    }

    private void handleWordBoundary(ClauseSegment segment, JSONObject boundary) {
        if (boundary == null) {
            return;
        }
        JSONArray boundaries = wordBoundariesSource.get(segment.parentChunkIndex);
        if (boundaries == null) {
            boundaries = new JSONArray();
            wordBoundariesSource.put(segment.parentChunkIndex, boundaries);
        }

        try {
            JSONObject adjusted = new JSONObject();
            int localCharIndex = boundary.optInt("charIndex", 0);
            adjusted.put("charIndex", segment.startOffset + localCharIndex);
            adjusted.put("charLength", boundary.optInt("charLength", 0));
            adjusted.put("text", boundary.optString("text", ""));
            adjusted.put("offset", boundary.optLong("offset", 0));
            adjusted.put("duration", boundary.optLong("duration", 0));

            synchronized (boundaries) {
                boundaries.put(adjusted);
            }
        } catch (Exception ex) {
            Log.w(TAG, "Lỗi ánh xạ word boundary: " + ex.getMessage());
        }
    }

    private AudioSource createAndSaveSource(ClauseSegment segment, byte[] fullAudio, boolean isMemoryMode) {
        if (fullAudio == null || fullAudio.length == 0) {
            return null;
        }
        if (isMemoryMode) {
            return new MemoryAudioSource(fullAudio);
        }

        File cacheFile = cacheManager.getSegmentFile(segment.parentChunkIndex, segment.segmentIndex);
        if (cacheFile == null) {
            return new MemoryAudioSource(fullAudio);
        }

        try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
            fos.write(fullAudio);
            fos.flush();
            return new FileAudioSource(cacheFile);
        } catch (Exception ex) {
            Log.w(TAG, "Lỗi ghi tệp cache phân đoạn, fallback về RAM: " + ex.getMessage());
            return new MemoryAudioSource(fullAudio);
        }
    }

    private void handleFetchFailure(ClauseSegment segment, String reason) {
        if (retryManager.canRetry(segment.parentChunkIndex)) {
            retryManager.recordFailure(segment.parentChunkIndex);
            long delay = retryManager.getDelayMs(segment.parentChunkIndex);
            Log.d(TAG, "Thử lại tải phân đoạn " + segment.parentChunkIndex + ":" + segment.segmentIndex + " sau " + delay + "ms...");
            mainHandler.postDelayed(() -> startFetch(segment), delay);
            return;
        }

        Log.w(TAG, "Hết số lần thử lại phân đoạn " + segment.parentChunkIndex + ":" + segment.segmentIndex + ": " + reason);
        if (listener != null) {
            mainHandler.post(() -> listener.onSegmentFailed(segment, reason));
        }
    }

    private void notifyReady(ClauseSegment segment, AudioSource source) {
        if (listener != null) {
            mainHandler.post(() -> listener.onSegmentReady(segment, source));
        }
    }

    public AudioSource getSegmentAudioSource(ClauseSegment segment) {
        if (segment == null) {
            return null;
        }
        return readySources.get(new SegmentKey(segment.parentChunkIndex, segment.segmentIndex));
    }

    public AudioSource getAudioSource(int chunkIndex) {
        return getSegmentAudioSource(getFirstSegment(chunkIndex));
    }

    public boolean isSegmentReady(ClauseSegment segment) {
        if (segment == null) {
            return false;
        }
        return readySources.containsKey(new SegmentKey(segment.parentChunkIndex, segment.segmentIndex));
    }

    public boolean isChunkReady(int chunkIndex) {
        return isSegmentReady(getFirstSegment(chunkIndex));
    }

    public Map<Integer, JSONArray> getWordBoundariesSource() {
        return wordBoundariesSource;
    }

    public synchronized void cancelAll() {
        for (Map.Entry<SegmentKey, WebSocket> entry : activeSockets.entrySet()) {
            try {
                entry.getValue().close(1000, "Hủy tải trước");
            } catch (Exception e) {
                Log.w(TAG, "Lỗi đóng WebSocket phân đoạn " + entry.getKey() + ": " + e.getMessage());
            }
        }
        activeSockets.clear();
        inFlightSegments.clear();
    }

    public synchronized void clear() {
        cancelAll();
        readySources.clear();
        wordBoundariesSource.clear();
        segmentsCache.clear();
        chunks = Collections.emptyList();
    }
}
