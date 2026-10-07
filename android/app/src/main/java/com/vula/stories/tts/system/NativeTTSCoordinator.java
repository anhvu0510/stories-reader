package com.vula.stories.tts.system;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.RemoteLogger;
import com.vula.stories.player.NativeSpeechQueueManager;
import com.vula.stories.player.StoriesAudioBridge;

import org.json.JSONObject;

import java.util.List;

/**
 * Điều phối viên phát âm thanh Native TTS (Deep Module).
 * Kết nối AndroidSpeechEngine với NativeSpeechQueueManager, quản lý WakeLock,
 * hàng đợi đơn/đa câu và đồng bộ thông báo / màn hình khóa qua StoriesAudioBridge.
 */
public class NativeTTSCoordinator implements StoriesAudioBridge.AudioControlListener {

    private static final String TAG = "NativeTTSCoordinator";
    private static final long MIN_CHUNK_LOG_INTERVAL_MS = 1500;

    public interface PlaybackEventListener {
        void onChunkStart(int chunkIndex);
        void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text);
        void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering);
        void onPlaybackComplete();

        void onUtteranceStart(String utteranceId);
        void onUtteranceDone(String utteranceId);
        void onUtteranceError(String utteranceId, String error);
        void onUtteranceRangeStart(String utteranceId, int start, int end);
    }

    public interface SpeakCallback {
        void onDone(String utteranceId);
        void onError(String utteranceId, String error);
    }

    private final Context context;
    private final Handler mainHandler;
    private final AndroidSpeechEngine speechEngine;
    private final NativeSpeechQueueManager queueManager;
    private final PlaybackEventListener eventListener;

    private PowerManager.WakeLock wakeLock = null;
    private String currentBookTitle = "Stories Reader";
    private String currentChapterTitle = "Chương đọc";
    private String currentVoice = null;
    private Float currentRate = 1.0f;
    private Float currentPitch = 1.0f;

    private volatile boolean isStreamingPlaying = false;
    private int currentPlayIndex = 0;
    private long lastChunkLogTime = 0;
    private SpeakCallback currentSpeakCallback = null;

    public NativeTTSCoordinator(
            Context context,
            AndroidSpeechEngine speechEngine,
            PlaybackEventListener eventListener
    ) {
        this.context = context.getApplicationContext();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.speechEngine = speechEngine;
        this.eventListener = eventListener;
        this.queueManager = new NativeSpeechQueueManager();

        setupQueueManagerListener();
        setupUtteranceListener();
    }

    private void setupQueueManagerListener() {
        queueManager.setListener(new NativeSpeechQueueManager.SpeechStreamListener() {
            @Override
            public void onChunkStart(int chunkIndex) {
                handleChunkStart(chunkIndex);
            }

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                if (eventListener != null) {
                    eventListener.onWordBoundary(chunkIndex, charIndex, charLength, text);
                }
            }

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
                handlePlaybackStateChange(isPlaying, isPaused, isBuffering);
            }

            @Override
            public void onChunkCompleted(int completedIndex) {
                // Đã đọc xong câu
            }

            @Override
            public void onChunkError(int chunkIndex, String message) {
                if (eventListener != null) eventListener.onUtteranceError(
                        NativeSpeechQueueManager.buildUtteranceId(chunkIndex), message);
            }

            @Override
            public void onAllCompleted() {
                handleAllCompleted();
            }
        });
    }

    private void setupUtteranceListener() {
        speechEngine.setProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleChunkStart(utteranceId));
                    return;
                }
                if (eventListener != null) {
                    eventListener.onUtteranceStart(utteranceId);
                }
            }

            @Override
            public void onDone(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleChunkDone(utteranceId));
                    return;
                }
                if (eventListener != null) {
                    eventListener.onUtteranceDone(utteranceId);
                }
                synchronized (NativeTTSCoordinator.this) {
                    if (currentSpeakCallback != null) {
                        currentSpeakCallback.onDone(utteranceId);
                        currentSpeakCallback = null;
                    }
                }
                releaseWakeLock();
            }

            @Override
            public void onError(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleChunkError(
                            utteranceId, speechEngine.getRawTts(), buildSpeechParams()
                    ));
                    return;
                }
                if (eventListener != null) {
                    eventListener.onUtteranceError(utteranceId, "Playback failed for " + utteranceId);
                }
                synchronized (NativeTTSCoordinator.this) {
                    if (currentSpeakCallback != null) {
                        currentSpeakCallback.onError(utteranceId, "Playback failed for " + utteranceId);
                        currentSpeakCallback = null;
                    }
                }
                releaseWakeLock();
            }

            @Override
            public void onRangeStart(String utteranceId, int start, int end, int frame) {
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleRangeStart(utteranceId, start, end));
                    return;
                }
                if (eventListener != null) {
                    eventListener.onUtteranceRangeStart(utteranceId, start, end);
                }
            }
        });
    }

    private Bundle buildSpeechParams() {
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_STREAM, String.valueOf(android.media.AudioManager.STREAM_MUSIC));
        return params;
    }

    public void speak(
            String text,
            String voice,
            Float rate,
            Float pitch,
            String utteranceId,
            SpeakCallback callback
    ) {
        speechEngine.applyVoiceSettings(voice, rate, pitch);
        synchronized (this) {
            currentSpeakCallback = callback;
        }
        acquireWakeLock();

        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
        int result = speechEngine.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
        if (result != TextToSpeech.SUCCESS) {
            synchronized (this) {
                currentSpeakCallback = null;
            }
            releaseWakeLock();
            if (callback != null) {
                callback.onError(utteranceId, "TTS speak failed with code: " + result);
            }
        }
    }

    public void playChapter(
            List<String> chunks,
            int startIndex,
            String voice,
            Float rate,
            Float pitch,
            String bookTitle,
            String chapterTitle
    ) {
        stop(false);
        StoriesAudioBridge.registerListener(this);

        this.currentVoice = voice;
        this.currentRate = rate;
        this.currentPitch = pitch;
        this.currentBookTitle = (bookTitle != null) ? bookTitle : "Stories Reader";
        this.currentChapterTitle = (chapterTitle != null) ? chapterTitle : "Chương đọc";
        this.isStreamingPlaying = true;
        this.lastChunkLogTime = 0;

        speechEngine.applyVoiceSettings(voice, rate, pitch);
        acquireWakeLock();

        queueManager.setChunks(chunks, startIndex);
        queueManager.startSpeaking(speechEngine.getRawTts(), startIndex, buildSpeechParams());
    }

    private void handleChunkStart(int chunkIndex) {
        currentPlayIndex = chunkIndex;
        if (eventListener != null) {
            eventListener.onChunkStart(chunkIndex);
        }

        String playText = queueManager.getCurrentText();
        int total = queueManager.getTotalChunks();
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, playText, true,
                chunkIndex > 0, chunkIndex < total - 1, chunkIndex, total
        );

        logChunk(chunkIndex, playText, total);
        queueManager.maintainQueue(speechEngine.getRawTts(), buildSpeechParams());
    }

    private void logChunk(int chunkIndex, String playText, int total) {
        String snippet = RemoteLogger.formatSnippet(playText);
        Log.d(TAG, "[NativeTTS:Direct] Đang đọc câu " + (chunkIndex + 1) + "/" + total + ": \"" + snippet + "\"");

        long now = System.currentTimeMillis();
        boolean isBoundary = (chunkIndex == 0 || (total > 0 && chunkIndex == total - 1));
        if (isBoundary || (now - lastChunkLogTime >= MIN_CHUNK_LOG_INTERVAL_MS)) {
            lastChunkLogTime = now;
            JSONObject playDetails = new JSONObject();
            try {
                playDetails.put("chunkIndex", chunkIndex);
                playDetails.put("totalChunks", total);
                if (total > 0) {
                    int progressPct = (int) Math.round(((double) (chunkIndex + 1) / total) * 100);
                    playDetails.put("progress", progressPct + "%");
                }
                playDetails.put("snippet", snippet);
            } catch (Exception e) {
                Log.w(TAG, "Lỗi đóng gói playDetails log: " + e.getMessage());
            }
            RemoteLogger.log("NativeTTS_Stream", "info",
                    "[NativeTTS:Direct] Đang đọc câu " + (chunkIndex + 1) + "/" + total + ": \"" + snippet + "\"",
                    null, playDetails);
        }
    }

    private void handlePlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
        if (eventListener != null) {
            eventListener.onPlaybackStateChange(isPlaying, isPaused, isBuffering);
        }
        if (!isStreamingPlaying && !isPlaying) {
            return;
        }
        int idx = queueManager.getCurrentChunkIndex();
        String text = queueManager.getCurrentText();
        int total = queueManager.getTotalChunks();
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, text, isPlaying,
                idx > 0, idx < total - 1, idx, total
        );
    }

    private void handleAllCompleted() {
        if (eventListener != null) {
            eventListener.onPlaybackComplete();
        }
        StoriesAudioBridge.stopPlayback(context);
        releaseWakeLock();
    }

    public void pause() {
        queueManager.notifyPaused();
        speechEngine.stop();
        int idx = queueManager.getCurrentChunkIndex();
        int total = queueManager.getTotalChunks();
        StoriesAudioBridge.updatePlayback(
                context, currentBookTitle, currentChapterTitle, queueManager.getCurrentText(), false,
                idx > 0, idx < total - 1, idx, total
        );
    }

    public void resume() {
        speechEngine.applyVoiceSettings(currentVoice, currentRate, currentPitch);
        queueManager.startSpeaking(speechEngine.getRawTts(), queueManager.getCurrentChunkIndex(), buildSpeechParams());
    }

    public void stop(boolean emitEvent) {
        isStreamingPlaying = false;
        lastChunkLogTime = 0;
        queueManager.notifyStopped();
        speechEngine.stop();
        StoriesAudioBridge.unregisterListener(this);
        StoriesAudioBridge.stopPlayback(context);
        releaseWakeLock();

        synchronized (this) {
            if (currentSpeakCallback != null) {
                currentSpeakCallback.onDone("");
                currentSpeakCallback = null;
            }
        }

        if (emitEvent && eventListener != null) {
            eventListener.onPlaybackStateChange(false, false, false);
        }
    }

    public void seek(int chunkIndex) {
        if (chunkIndex < 0 || chunkIndex >= queueManager.getTotalChunks()) {
            return;
        }
        currentPlayIndex = chunkIndex;
        speechEngine.stop();
        speechEngine.applyVoiceSettings(currentVoice, currentRate, currentPitch);
        queueManager.startSpeaking(speechEngine.getRawTts(), chunkIndex, buildSpeechParams());
    }

    public synchronized void acquireWakeLock() {
        try {
            if (wakeLock == null && context != null) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "stories:NativeTTSWakeLock");
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(20 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Không thể giữ wakelock: " + e.getMessage());
        }
    }

    public synchronized void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Không thể nhả wakelock: " + e.getMessage());
        }
    }

    public void destroy() {
        stop(false);
        speechEngine.shutdown();
    }

    public NativeSpeechQueueManager getQueueManager() {
        return queueManager;
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
        mainHandler.post(() -> seek(queueManager.getCurrentChunkIndex() + 1));
    }

    @Override
    public void onPreviousRequested() {
        mainHandler.post(() -> seek(queueManager.getCurrentChunkIndex() - 1));
    }

    @Override
    public void onStopRequested() {
        mainHandler.post(() -> stop(true));
    }
}
