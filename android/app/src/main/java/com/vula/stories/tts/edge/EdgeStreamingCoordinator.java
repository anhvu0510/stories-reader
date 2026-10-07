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

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Điều phối viên phiên phát streaming Edge TTS (Deep Module).
 * Quản lý vòng đời phát âm thanh, nạp trước (lookahead), dọn dẹp cache cuốn chiếu,
 * và đồng bộ thông báo / màn hình khóa qua StoriesAudioBridge.
 */
public class EdgeStreamingCoordinator implements StoriesAudioBridge.AudioControlListener {

    private static final String TAG = "EdgeStreamingCoord";
    private static final long MIN_CHUNK_LOG_INTERVAL_MS = 1500;
    private static final int BUFFER_LOOKAHEAD = AudioCacheManager.BUFFER_LOOKAHEAD;

    public interface PlaybackEventListener {
        void onChunkStart(int chunkIndex);
        void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text);
        void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering);
        void onPlaybackComplete();
        default void onPlaybackError(int index, String message) {}
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
    private long streamingSessionId = 0;
    private long lastChunkLogTime = 0;
    private boolean awaitingSpeechRetry = false;

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
            public void onPlaybackError(int chunkIndex, String message) {
                failCurrentChunk(chunkIndex, message);
            }

            @Override
            public void onAllCompleted() {
                // Đã được xử lý trong handleChunkCompleted
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
        if (!"memory".equalsIgnoreCase(currentBufferMode)) {
            cacheManager.cleanCacheDir(true);
        }
        player.reset();
        player.setWordBoundariesSource(prefetchQueue.getWordBoundariesSource());

        if (eventListener != null) {
            eventListener.onPlaybackStateChange(true, false, true);
        }

        logStreamStart(startIndex, voice, rate);

        prefetchQueue.startFetch(currentPlayIndex);
        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    private void logStreamStart(int startIndex, String voice, String rate) {
        String firstSentence = (startIndex >= 0 && startIndex < currentChunks.size()) ? currentChunks.get(startIndex) : "";
        JSONObject startDetails = new JSONObject();
        try {
            startDetails.put("startIndex", startIndex);
            startDetails.put("totalChunks", currentChunks.size());
            startDetails.put("voice", voice);
            startDetails.put("rate", rate);
            startDetails.put("bufferMode", currentBufferMode);
            startDetails.put("snippet", RemoteLogger.formatSnippet(firstSentence));
        } catch (Exception e) {
            Log.w(TAG, "Lỗi đóng gói startDetails telemetry: " + e.getMessage());
        }
        RemoteLogger.log("EdgeTTSNative_Stream", "info",
                "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Bắt đầu phát chương từ câu "
                        + (startIndex + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(firstSentence) + "\"",
                null, startDetails);
    }

    private EdgePrefetchQueue.PrefetchListener createPrefetchListener(final long sessionId) {
        return new EdgePrefetchQueue.PrefetchListener() {
            @Override
            public void onChunkReady(int index, AudioSource source) {
                onAudioSourceReady(index, source, sessionId);
            }

            @Override
            public void onChunkFailed(int index, String reason) {
                onAudioSourceFailed(index, reason, sessionId);
            }
        };
    }

    private synchronized void onAudioSourceReady(int index, AudioSource source, long sessionId) {
        if (!isStreamingPlaying || awaitingSpeechRetry || sessionId != streamingSessionId) {
            return;
        }

        if (index == currentPlayIndex && !player.hasCurrentPlayer()) {
            player.start(index, source);
        } else if (index == currentPlayIndex + 1 && player.hasCurrentPlayer() && !player.hasNextPlayer()) {
            player.prepareNext(index, source);
        }

        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    private synchronized void onAudioSourceFailed(int index, String reason, long sessionId) {
        if (!isStreamingPlaying || sessionId != streamingSessionId) {
            return;
        }
        Log.w(TAG, "Tải audio câu " + index + " thất bại: " + reason);
        String text = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
        JSONObject failDetails = new JSONObject();
        try {
            failDetails.put("chunkIndex", index);
            failDetails.put("totalChunks", currentChunks.size());
            failDetails.put("bufferMode", currentBufferMode);
            failDetails.put("snippet", RemoteLogger.formatSnippet(text));
            failDetails.put("error", reason);
        } catch (Exception e) {
            Log.w(TAG, "Lỗi đóng gói failDetails telemetry: " + e.getMessage());
        }
        RemoteLogger.log("EdgeTTSNative_Stream", "error",
                "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Thất bại tải audio câu "
                        + (index + 1) + "/" + currentChunks.size() + " sau nhiều lần thử: " + reason
                        + " - Nội dung: \"" + RemoteLogger.formatSnippet(text) + "\"",
                reason, failDetails);

        if (index == currentPlayIndex && !player.hasCurrentPlayer()) {
            failCurrentChunk(index, reason);
        }
    }

    private void failCurrentChunk(int index, String error) {
        awaitingSpeechRetry = true;
        player.reset();
        prefetchQueue.cancelAll();
        if (eventListener != null) {
            eventListener.onPlaybackStateChange(false, true, false);
            eventListener.onPlaybackError(index, error);
        }
    }

    private void handlePlayerChunkStart(int chunkIndex) {
        currentPlayIndex = chunkIndex;
        if (eventListener != null) {
            eventListener.onChunkStart(chunkIndex);
        }

        // Dọn dẹp sạch toàn bộ các câu quá khứ ngay lập tức để câu hiện tại luôn là câu đầu tiên của cache
        prefetchQueue.evictOldChunks(chunkIndex);

        String playText = (chunkIndex >= 0 && chunkIndex < currentChunks.size()) ? currentChunks.get(chunkIndex) : "";
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, playText, true,
                chunkIndex > 0, chunkIndex < currentChunks.size() - 1, chunkIndex, currentChunks.size()
        );

        logChunkProgress(chunkIndex, playText);
        prefetchQueue.prefetchAhead(chunkIndex, BUFFER_LOOKAHEAD);
    }

    private void logChunkProgress(int chunkIndex, String playText) {
        String snippet = RemoteLogger.formatSnippet(playText);
        int firstCachedIdx = prefetchQueue.getFirstCachedChunkIndex();
        int lastCachedIdx = prefetchQueue.getLastCachedChunkIndex();
        String lastCachedSnippet = (lastCachedIdx >= 0 && lastCachedIdx < currentChunks.size())
                ? RemoteLogger.formatSnippet(currentChunks.get(lastCachedIdx))
                : "";
        int aheadCount = prefetchQueue.getAheadCachedCount(chunkIndex);

        String cacheRangeStr = (firstCachedIdx >= 0 && lastCachedIdx >= 0)
                ? "câu " + (firstCachedIdx + 1) + " -> " + (lastCachedIdx + 1) + "/" + currentChunks.size()
                : "Chưa có";
        String cacheInfoStr = (lastCachedIdx >= 0)
                ? " [Cache: " + cacheRangeStr + " (+" + aheadCount + " câu gối đầu) - \"" + lastCachedSnippet + "\"]"
                : " [Cache: Chưa có]";

        String modeTag = "[" + currentBufferMode.toUpperCase(Locale.ROOT) + "]";
        String fullLogMessage = "[EdgeTTS:Stream]" + modeTag + " Đang đọc câu " + (chunkIndex + 1) + "/" + currentChunks.size()
                + ": \"" + snippet + "\"" + cacheInfoStr;

        Log.d(TAG, fullLogMessage);

        long now = System.currentTimeMillis();
        boolean isBoundary = (chunkIndex == 0 || chunkIndex == currentChunks.size() - 1);
        if (isBoundary || (now - lastChunkLogTime >= MIN_CHUNK_LOG_INTERVAL_MS)) {
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
                playDetails.put("cachedChunksCount", prefetchQueue.getCachedChunksCount());
            } catch (Exception e) {
                Log.w(TAG, "Lỗi đóng gói playDetails telemetry: " + e.getMessage());
            }
            RemoteLogger.log("EdgeTTSNative_Stream", "info", fullLogMessage, null, playDetails);
        }
    }

    private void handlePlayerStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
        if (eventListener != null) {
            eventListener.onPlaybackStateChange(isPlaying, isPaused, isBuffering);
        }
        if (!isStreamingPlaying && !isPlaying) {
            return;
        }
        int idx = player.getCurrentChunkIndex();
        String text = (idx >= 0 && idx < currentChunks.size()) ? currentChunks.get(idx) : "";
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, text, isPlaying,
                idx > 0, idx < currentChunks.size() - 1, idx, currentChunks.size()
        );
    }

    private void handleChunkCompleted(int completedIndex) {
        if (!isStreamingPlaying) {
            return;
        }
        int nextIndex = completedIndex + 1;
        currentPlayIndex = nextIndex;

        if (nextIndex < currentChunks.size()) {
            if (player.hasCurrentPlayer() && player.getCurrentChunkIndex() == nextIndex) {
                prefetchQueue.prefetchAhead(nextIndex, BUFFER_LOOKAHEAD);
                return;
            }
            if (eventListener != null) {
                eventListener.onPlaybackStateChange(true, false, true);
            }
            AudioSource nextSource = prefetchQueue.getAudioSource(nextIndex);
            if (nextSource != null && nextSource.isValid()) {
                player.start(nextIndex, nextSource);
            } else {
                prefetchQueue.startFetch(nextIndex);
            }
            prefetchQueue.prefetchAhead(nextIndex, BUFFER_LOOKAHEAD);
            return;
        }

        JSONObject allDoneDetails = new JSONObject();
        try {
            allDoneDetails.put("totalChunks", currentChunks.size());
            allDoneDetails.put("bufferMode", currentBufferMode);
        } catch (Exception e) {
            Log.w(TAG, "Lỗi đóng gói allDoneDetails telemetry: " + e.getMessage());
        }
        RemoteLogger.log("EdgeTTSNative_Stream", "info",
                "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Hoàn tất đọc hết toàn bộ chương ("
                        + currentChunks.size() + " câu)", null, allDoneDetails);

        stop(false);
        if (eventListener != null) {
            eventListener.onPlaybackComplete();
        }
    }

    public synchronized void seek(int targetIndex) {
        if (targetIndex < 0 || targetIndex >= currentChunks.size()) {
            return;
        }
        // Seeking keeps the same chapter cache and its in-flight synthesis callbacks.
        // GaplessStreamPlayer.reset() invalidates only the old playback callbacks.
        awaitingSpeechRetry = false;
        currentPlayIndex = targetIndex;
        player.reset();
        player.setWordBoundariesSource(prefetchQueue.getWordBoundariesSource());

        if (eventListener != null) {
            eventListener.onPlaybackStateChange(true, false, true);
        }

        AudioSource source = prefetchQueue.getAudioSource(targetIndex);
        if (source != null && source.isValid()) {
            player.start(targetIndex, source);
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
        int currentIdx = (player != null) ? player.getCurrentChunkIndex() : -1;
        String pausedText = (currentIdx >= 0 && currentIdx < currentChunks.size()) ? currentChunks.get(currentIdx) : "";
        JSONObject pauseDetails = new JSONObject();
        try {
            pauseDetails.put("chunkIndex", currentIdx);
            pauseDetails.put("totalChunks", currentChunks.size());
            pauseDetails.put("bufferMode", currentBufferMode);
            pauseDetails.put("snippet", RemoteLogger.formatSnippet(pausedText));
        } catch (Exception e) {
            Log.w(TAG, "Lỗi đóng gói pauseDetails telemetry: " + e.getMessage());
        }
        RemoteLogger.log("EdgeTTSNative_Stream", "info",
                "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Tạm dừng đọc ở câu "
                        + (currentIdx + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(pausedText) + "\"",
                null, pauseDetails);
    }

    public void resume() {
        if (awaitingSpeechRetry) {
            seek(currentPlayIndex);
            return;
        }
        if (media3Adapter != null && media3Adapter.isMedia3Active()) {
            media3Adapter.resume(context);
            return;
        }
        player.resume();
        int currentIdx = (player != null) ? player.getCurrentChunkIndex() : -1;
        String resumeText = (currentIdx >= 0 && currentIdx < currentChunks.size()) ? currentChunks.get(currentIdx) : "";
        JSONObject resumeDetails = new JSONObject();
        try {
            resumeDetails.put("chunkIndex", currentIdx);
            resumeDetails.put("totalChunks", currentChunks.size());
            resumeDetails.put("bufferMode", currentBufferMode);
            resumeDetails.put("snippet", RemoteLogger.formatSnippet(resumeText));
        } catch (Exception e) {
            Log.w(TAG, "Lỗi đóng gói resumeDetails telemetry: " + e.getMessage());
        }
        RemoteLogger.log("EdgeTTSNative_Stream", "info",
                "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Tiếp tục đọc câu "
                        + (currentIdx + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(resumeText) + "\"",
                null, resumeDetails);
        prefetchQueue.prefetchAhead(currentPlayIndex, BUFFER_LOOKAHEAD);
    }

    public synchronized void stop(boolean emitEvent) {
        boolean wasActive = isStreamingPlaying || (player != null && (player.isPlayingSafely() || player.isPaused()));
        int currentIdx = (player != null) ? player.getCurrentChunkIndex() : -1;
        int total = currentChunks.size();

        if (media3Adapter != null && media3Adapter.isMedia3Active()) {
            media3Adapter.stop(context);
        }
        streamingSessionId++;
        isStreamingPlaying = false;
        awaitingSpeechRetry = false;
        currentPlayIndex = 0;
        player.releaseWakeLock();
        player.reset();
        prefetchQueue.cancelAll();
        StoriesAudioBridge.unregisterListener(this);
        StoriesAudioBridge.stopPlayback(context);

        if (!"memory".equalsIgnoreCase(currentBufferMode)) {
            cacheManager.cleanCacheDir(true);
        }

        if (emitEvent && wasActive) {
            if (total > 0 && currentIdx >= 0) {
                JSONObject stopDetails = new JSONObject();
                try {
                    stopDetails.put("lastChunkIndex", currentIdx);
                    stopDetails.put("totalChunks", total);
                    stopDetails.put("bufferMode", currentBufferMode);
                } catch (Exception e) {
                    Log.w(TAG, "Lỗi đóng gói stopDetails telemetry: " + e.getMessage());
                }
                RemoteLogger.log("EdgeTTSNative_Stream", "info",
                        "[EdgeTTS:Stream][" + currentBufferMode.toUpperCase(Locale.ROOT) + "] Dừng đọc chương và dọn dẹp cache tại câu "
                                + (currentIdx + 1) + "/" + total, null, stopDetails);
            }
            if (eventListener != null) {
                eventListener.onPlaybackStateChange(false, false, false);
            }
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
