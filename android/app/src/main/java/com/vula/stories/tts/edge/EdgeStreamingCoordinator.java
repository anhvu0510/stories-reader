package com.vula.stories.tts.edge;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.RemoteLogger;
import com.vula.stories.player.GaplessStreamPlayer;
import com.vula.stories.player.StoriesAudioBridge;
import com.vula.stories.player.media3.Media3PlaybackAdapter;
import com.vula.stories.player.source.AudioSource;
import com.vula.stories.tts.edge.segment.ClauseSegment;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Điều phối viên phiên phát streaming Edge TTS (Deep Module).
 * Tích hợp thuật toán Adaptive Clause Pipelining:
 * - Chia câu thành các phân đoạn nhỏ để phát ngay lập tức (TTFA < 300ms).
 * - Nối âm thanh các phân đoạn bằng 0ms gapless transition.
 * - Bảo toàn chỉ số câu (chunkIndex) và ranh giới từ (word boundary) cho UI.
 */
public class EdgeStreamingCoordinator implements StoriesAudioBridge.AudioControlListener {

    private static final String TAG = "EdgeStreamingCoord";
    private static final long MIN_CHUNK_LOG_INTERVAL_MS = 1500;
    private static final int BUFFER_LOOKAHEAD = 2;

    public interface PlaybackEventListener {
        void onChunkStart(int chunkIndex);
        void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text);
        void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering);
        void onPlaybackComplete();
    }

    private final Context context;
    private final Handler mainHandler;
    private final AudioCacheManager cacheManager;
    private final GaplessStreamPlayer player;
    private final EdgePrefetchQueue prefetchQueue;
    private final Media3PlaybackAdapter media3Adapter;
    private final PlaybackEventListener eventListener;

    private final List<String> currentChunks = new ArrayList<>();
    private String currentVoice = "vi-VN-HoaiMyNeural";
    private String currentRate = "+0%";
    private String currentPitch = "+0Hz";
    private String currentBufferMode = "file";
    private String currentBookTitle = "Stories Reader";
    private String currentChapterTitle = "Chương đọc";

    private boolean isStreamingPlaying = false;
    private int currentPlayIndex = 0;
    private int currentSegmentIndex = 0;
    private long streamingSessionId = 0;
    private long lastChunkLogTime = 0;

    public EdgeStreamingCoordinator(
            Context context,
            AudioCacheManager cacheManager,
            EdgePrefetchQueue prefetchQueue,
            Media3PlaybackAdapter media3Adapter,
            PlaybackEventListener eventListener
    ) {
        this.context = context.getApplicationContext();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.cacheManager = cacheManager;
        this.prefetchQueue = prefetchQueue;
        this.media3Adapter = media3Adapter;
        this.eventListener = eventListener;
        this.player = new GaplessStreamPlayer(this.context, createPlayerListener());
        this.player.setWordBoundariesSource(prefetchQueue.getWordBoundariesSource());
    }

    private GaplessStreamPlayer.PlayerListener createPlayerListener() {
        return new GaplessStreamPlayer.PlayerListener() {
            @Override
            public void onChunkStart(int chunkIndex) {
                handlePlayerChunkStart(chunkIndex);
            }

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                if (eventListener != null) {
                    eventListener.onWordBoundary(chunkIndex, charIndex, charLength, text);
                }
            }

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
                handlePlayerStateChange(isPlaying, isPaused, isBuffering);
            }

            @Override
            public void onChunkCompleted(int completedIndex) {
                handleChunkCompleted(completedIndex);
            }

            @Override
            public void onAllCompleted() {
                // Đã xử lý trong handleChunkCompleted
            }
        };
    }

    public synchronized void startStreaming(
            List<String> chunks,
            int startIndex,
            String voice,
            String rate,
            String pitch,
            String bufferMode,
            String bookTitle,
            String chapterTitle
    ) {
        stop(false);
        StoriesAudioBridge.registerListener(this);

        final long sessionId = ++streamingSessionId;
        currentChunks.clear();
        if (chunks != null) {
            currentChunks.addAll(chunks);
        }
        currentPlayIndex = Math.max(0, Math.min(startIndex, currentChunks.size() - 1));
        currentSegmentIndex = 0;
        currentVoice = voice;
        currentRate = rate;
        currentPitch = pitch;
        currentBufferMode = (bufferMode != null) ? bufferMode : "file";
        currentBookTitle = (bookTitle != null) ? bookTitle : "Stories Reader";
        currentChapterTitle = (chapterTitle != null) ? chapterTitle : "Chương đọc";
        isStreamingPlaying = true;
        lastChunkLogTime = 0;

        prefetchQueue.configure(currentChunks, voice, rate, pitch, currentBufferMode, createPrefetchListener(sessionId));
        player.acquireWakeLock();
        player.reset();
        player.setWordBoundariesSource(prefetchQueue.getWordBoundariesSource());

        if (eventListener != null) {
            eventListener.onPlaybackStateChange(true, false, true);
        }

        // Tải ưu tiên phân đoạn đầu tiên của câu bắt đầu (TTFA < 300ms)
        prefetchQueue.startFetch(currentPlayIndex);
        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    private EdgePrefetchQueue.PrefetchListener createPrefetchListener(final long sessionId) {
        return new EdgePrefetchQueue.PrefetchListener() {
            @Override
            public void onSegmentReady(ClauseSegment segment, AudioSource source) {
                onAudioSourceReady(segment, source, sessionId);
            }

            @Override
            public void onSegmentFailed(ClauseSegment segment, String reason) {
                onAudioSourceFailed(segment, reason, sessionId);
            }
        };
    }

    private synchronized void onAudioSourceReady(ClauseSegment segment, AudioSource source, long sessionId) {
        if (!isStreamingPlaying || sessionId != streamingSessionId) {
            return;
        }

        boolean isTargetCurrent = (segment.parentChunkIndex == currentPlayIndex && segment.segmentIndex == currentSegmentIndex);
        if (isTargetCurrent && !player.hasCurrentPlayer()) {
            player.start(segment.parentChunkIndex, source);
            prepareNextSubSegment(segment);
            return;
        }

        ClauseSegment activeSeg = getCurrentClauseSegment();
        ClauseSegment nextNeeded = prefetchQueue.getNextSegment(activeSeg);
        boolean isNextTarget = (nextNeeded != null && nextNeeded.parentChunkIndex == segment.parentChunkIndex
                && nextNeeded.segmentIndex == segment.segmentIndex);

        if (isNextTarget && player.hasCurrentPlayer() && !player.hasNextPlayer()) {
            player.prepareNext(segment.parentChunkIndex, source);
        }

        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    private ClauseSegment getCurrentClauseSegment() {
        List<ClauseSegment> segs = prefetchQueue.getSegments(currentPlayIndex);
        if (currentSegmentIndex >= 0 && currentSegmentIndex < segs.size()) {
            return segs.get(currentSegmentIndex);
        }
        return prefetchQueue.getFirstSegment(currentPlayIndex);
    }

    private void prepareNextSubSegment(ClauseSegment current) {
        ClauseSegment next = prefetchQueue.getNextSegment(current);
        if (next == null || !prefetchQueue.isSegmentReady(next) || player.hasNextPlayer()) {
            return;
        }
        AudioSource nextSource = prefetchQueue.getSegmentAudioSource(next);
        if (nextSource != null && nextSource.isValid()) {
            player.prepareNext(next.parentChunkIndex, nextSource);
        }
    }

    private synchronized void onAudioSourceFailed(ClauseSegment segment, String reason, long sessionId) {
        if (!isStreamingPlaying || sessionId != streamingSessionId) {
            return;
        }
        Log.w(TAG, "Tải phân đoạn " + segment.parentChunkIndex + ":" + segment.segmentIndex + " thất bại: " + reason);

        boolean isTargetCurrent = (segment.parentChunkIndex == currentPlayIndex && segment.segmentIndex == currentSegmentIndex);
        if (isTargetCurrent && !player.hasCurrentPlayer()) {
            int nextIndex = segment.parentChunkIndex + 1;
            if (nextIndex < currentChunks.size()) {
                seek(nextIndex);
                return;
            }
            stop(false);
            if (eventListener != null) {
                eventListener.onPlaybackComplete();
            }
        }
    }

    private void handlePlayerChunkStart(int chunkIndex) {
        // Chỉ thông báo onChunkStart cho Web UI khi phân đoạn đầu tiên của câu bắt đầu đọc
        if (currentSegmentIndex == 0 && eventListener != null) {
            eventListener.onChunkStart(chunkIndex);
        }

        String playText = (chunkIndex >= 0 && chunkIndex < currentChunks.size()) ? currentChunks.get(chunkIndex) : "";
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, playText, true,
                chunkIndex > 0, chunkIndex < currentChunks.size() - 1, chunkIndex, currentChunks.size()
        );

        if (currentSegmentIndex == 0) {
            logChunkProgress(chunkIndex, playText);
        }
        prefetchQueue.prefetchAhead(chunkIndex, BUFFER_LOOKAHEAD);
    }

    private void logChunkProgress(int chunkIndex, String playText) {
        long now = System.currentTimeMillis();
        boolean isBoundary = (chunkIndex == 0 || chunkIndex == currentChunks.size() - 1);
        if (!isBoundary && (now - lastChunkLogTime < MIN_CHUNK_LOG_INTERVAL_MS)) {
            return;
        }
        lastChunkLogTime = now;
        String snippet = RemoteLogger.formatSnippet(playText);
        String msg = "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Đang đọc câu "
                + (chunkIndex + 1) + "/" + currentChunks.size() + ": \"" + snippet + "\"";
        Log.d(TAG, msg);
    }

    private void handlePlayerStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
        if (eventListener != null) {
            eventListener.onPlaybackStateChange(isPlaying, isPaused, isBuffering);
        }
        if (!isStreamingPlaying && !isPlaying) {
            return;
        }
        int idx = currentPlayIndex;
        String text = (idx >= 0 && idx < currentChunks.size()) ? currentChunks.get(idx) : "";
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, text, isPlaying,
                idx > 0, idx < currentChunks.size() - 1, idx, currentChunks.size()
        );
    }

    private void handleChunkCompleted(int completedChunkIndex) {
        if (!isStreamingPlaying) {
            return;
        }

        List<ClauseSegment> segs = prefetchQueue.getSegments(currentPlayIndex);

        // 1. Nếu câu hiện tại còn phân đoạn con tiếp theo
        if (currentSegmentIndex + 1 < segs.size()) {
            currentSegmentIndex++;
            ClauseSegment nextSeg = segs.get(currentSegmentIndex);
            advanceToSubSegment(nextSeg);
            return;
        }

        // 2. Đã đọc hết toàn bộ phân đoạn của câu hiện tại -> Chuyển sang câu tiếp theo
        int nextChunkIndex = currentPlayIndex + 1;
        currentPlayIndex = nextChunkIndex;
        currentSegmentIndex = 0;

        if (nextChunkIndex < currentChunks.size()) {
            advanceToNextChunk(nextChunkIndex);
            return;
        }

        stop(false);
        if (eventListener != null) {
            eventListener.onPlaybackComplete();
        }
    }

    private void advanceToSubSegment(ClauseSegment nextSeg) {
        if (player.hasCurrentPlayer()) {
            // GaplessStreamPlayer đã tự động chuyển 0ms sang nextPlayer
            prepareNextSubSegment(nextSeg);
            prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
            return;
        }

        if (eventListener != null) {
            eventListener.onPlaybackStateChange(true, false, true);
        }
        AudioSource source = prefetchQueue.getSegmentAudioSource(nextSeg);
        if (source != null && source.isValid()) {
            player.start(currentPlayIndex, source);
            prepareNextSubSegment(nextSeg);
        } else {
            prefetchQueue.startFetch(nextSeg);
        }
        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    private void advanceToNextChunk(int nextChunkIndex) {
        ClauseSegment firstSeg = prefetchQueue.getFirstSegment(nextChunkIndex);
        if (player.hasCurrentPlayer()) {
            // Đã chuyển 0ms sang nextPlayer của câu tiếp theo
            if (firstSeg != null) {
                prepareNextSubSegment(firstSeg);
            }
            prefetchQueue.prefetchAhead(nextChunkIndex, BUFFER_LOOKAHEAD);
            return;
        }

        if (eventListener != null) {
            eventListener.onPlaybackStateChange(true, false, true);
        }
        AudioSource nextSource = prefetchQueue.getAudioSource(nextChunkIndex);
        if (nextSource != null && nextSource.isValid() && firstSeg != null) {
            player.start(nextChunkIndex, nextSource);
            prepareNextSubSegment(firstSeg);
        } else {
            prefetchQueue.startFetch(nextChunkIndex);
        }
        prefetchQueue.prefetchAhead(nextChunkIndex, BUFFER_LOOKAHEAD);
    }

    public synchronized void seek(int targetIndex) {
        if (targetIndex < 0 || targetIndex >= currentChunks.size()) {
            return;
        }
        streamingSessionId++;
        currentPlayIndex = targetIndex;
        currentSegmentIndex = 0;
        player.reset();
        player.setWordBoundariesSource(prefetchQueue.getWordBoundariesSource());

        if (eventListener != null) {
            eventListener.onPlaybackStateChange(true, false, true);
        }

        ClauseSegment first = prefetchQueue.getFirstSegment(targetIndex);
        AudioSource source = prefetchQueue.getAudioSource(targetIndex);
        if (source != null && source.isValid() && first != null) {
            player.start(targetIndex, source);
            prepareNextSubSegment(first);
        } else {
            prefetchQueue.startFetch(targetIndex);
        }
        prefetchQueue.prefetchAhead(targetIndex, BUFFER_LOOKAHEAD);
    }

    public void pause() {
        if (media3Adapter != null && media3Adapter.isMedia3Active()) {
            media3Adapter.pause(context);
            return;
        }
        player.pause();
    }

    public void resume() {
        if (media3Adapter != null && media3Adapter.isMedia3Active()) {
            media3Adapter.resume(context);
            return;
        }
        player.resume();
        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    public synchronized void stop(boolean emitEvent) {
        if (media3Adapter != null && media3Adapter.isMedia3Active()) {
            media3Adapter.stop(context);
        }
        streamingSessionId++;
        isStreamingPlaying = false;
        currentPlayIndex = 0;
        currentSegmentIndex = 0;
        player.releaseWakeLock();
        player.reset();
        prefetchQueue.cancelAll();
        StoriesAudioBridge.unregisterListener(this);
        StoriesAudioBridge.stopPlayback(context);

        if (emitEvent && eventListener != null) {
            eventListener.onPlaybackStateChange(false, false, false);
        }
    }

    public void clearCache() {
        cacheManager.cleanCacheDir(true);
        prefetchQueue.clear();
        player.clearCache();
        BreadcrumbTracker.add(TAG, "Audio cache cleared");
    }

    public void destroy() {
        stop(false);
        clearCache();
    }

    public int getCurrentPlayIndex() {
        return currentPlayIndex;
    }

    public boolean isStreamingPlaying() {
        return isStreamingPlaying;
    }

    public Media3PlaybackAdapter getMedia3Adapter() {
        return media3Adapter;
    }

    // AudioControlListener delegates
    @Override
    public void onPlayRequested() {
        mainHandler.post(this::resume);
    }

    @Override
    public void onPauseRequested() {
        mainHandler.post(this::pause);
    }

    @Override
    public void onNextRequested() {
        mainHandler.post(() -> seek(currentPlayIndex + 1));
    }

    @Override
    public void onPreviousRequested() {
        mainHandler.post(() -> seek(currentPlayIndex - 1));
    }

    @Override
    public void onStopRequested() {
        mainHandler.post(() -> stop(true));
    }
}
