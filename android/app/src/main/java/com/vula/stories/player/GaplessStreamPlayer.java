package com.vula.stories.player;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import com.vula.stories.player.gapless.PlayerSlot;
import com.vula.stories.player.source.AudioSource;
import com.vula.stories.player.source.FileAudioSource;
import com.vula.stories.player.source.MemoryAudioSource;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.List;
import java.util.Map;

/**
 * Trình phát âm thanh chuyển tiếp không ngắt quãng (Gapless Stream Player).
 * Điều phối hai PlayerSlot (currentSlot & nextSlot) để đạt 0ms chuyển tiếp giữa các câu,
 * duy trì WakeLock và theo dõi ranh giới từ ngữ (WordBoundaryTracker).
 */
public class GaplessStreamPlayer {

    private static final String TAG = "GaplessStreamPlayer";

    public interface PlayerListener {
        void onChunkStart(int chunkIndex);
        void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text);
        void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering);
        void onChunkCompleted(int completedIndex);
        void onAllCompleted();
    }

    private final Context context;
    private final Handler mainHandler;
    private final PlayerListener listener;
    private final WordBoundaryTracker wordBoundaryTracker = new WordBoundaryTracker();

    private PowerManager.WakeLock wakeLock = null;
    private PlayerSlot currentSlot = new PlayerSlot();
    private PlayerSlot nextSlot = new PlayerSlot();
    private PlayerSlot preparingCurrentSlot = null;
    private PlayerSlot preparingNextSlot = null;

    private int currentChunkIndex = -1;
    private boolean isPlaying = false;
    private boolean isPaused = false;
    private long currentSessionId = 0;

    private Runnable wordBoundaryTicker = null;
    private Map<Integer, JSONArray> wordBoundariesSource = null;

    public GaplessStreamPlayer(Context context, PlayerListener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public synchronized void acquireWakeLock() {
        try {
            if (wakeLock == null && context != null) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "stories:GaplessStreamWakeLock");
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(45 * 60 * 1000L);
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

    public synchronized void start(int index, AudioSource source) {
        if (source == null || !source.isValid()) {
            return;
        }

        final long sessionId = ++currentSessionId;
        cleanupPreparingSlots();
        currentSlot.release();
        nextSlot.release();

        currentChunkIndex = index;
        isPlaying = true;
        isPaused = false;

        PlayerSlot slot = new PlayerSlot();
        preparingCurrentSlot = slot;
        slot.prepare(index, source, new PlayerSlot.SlotCallback() {
            @Override
            public void onPrepared(PlayerSlot preparedSlot) {
                handleCurrentSlotPrepared(preparedSlot, index, sessionId);
            }

            @Override
            public void onCompleted(PlayerSlot completedSlot) {
                mainHandler.post(() -> handleChunkCompletion(completedSlot, sessionId));
            }

            @Override
            public void onError(PlayerSlot errorSlot, int what, int extra) {
                mainHandler.post(() -> handleChunkCompletion(errorSlot, sessionId));
            }
        });
    }

    private synchronized void handleCurrentSlotPrepared(PlayerSlot slot, int index, long sessionId) {
        if (sessionId != currentSessionId || !isPlaying) {
            slot.release();
            return;
        }

        preparingCurrentSlot = null;
        currentSlot = slot;
        currentChunkIndex = index;
        wordBoundaryTracker.reset();

        boolean started = currentSlot.start();
        if (!started) {
            currentSlot.release();
            mainHandler.post(() -> handleChunkCompletion(slot, sessionId));
            return;
        }

        if (listener != null) {
            listener.onChunkStart(index);
            listener.onPlaybackStateChange(true, false, false);
        }
        startWordBoundaryTicker();
    }

    public synchronized void prepareNext(int nextIndex, AudioSource source) {
        if (!isPlaying || nextSlot.hasPlayer() || !currentSlot.hasPlayer()) {
            return;
        }
        if (source == null || !source.isValid()) {
            return;
        }

        if (preparingNextSlot != null) {
            preparingNextSlot.release();
        }

        final long sessionId = currentSessionId;
        PlayerSlot slot = new PlayerSlot();
        preparingNextSlot = slot;

        slot.prepare(nextIndex, source, new PlayerSlot.SlotCallback() {
            @Override
            public void onPrepared(PlayerSlot preparedSlot) {
                handleNextSlotPrepared(preparedSlot, nextIndex, sessionId);
            }

            @Override
            public void onCompleted(PlayerSlot completedSlot) {
                mainHandler.post(() -> handleChunkCompletion(completedSlot, sessionId));
            }

            @Override
            public void onError(PlayerSlot errorSlot, int what, int extra) {
                errorSlot.release();
                preparingNextSlot = null;
            }
        });
    }

    private synchronized void handleNextSlotPrepared(PlayerSlot slot, int nextIndex, long sessionId) {
        if (sessionId != currentSessionId || !isPlaying || !currentSlot.hasPlayer()) {
            slot.release();
            return;
        }

        preparingNextSlot = null;
        nextSlot = slot;
        currentSlot.setNextSlot(nextSlot);
    }

    private synchronized void handleChunkCompletion(PlayerSlot completedSlot, long sessionId) {
        if (sessionId != currentSessionId || !isPlaying) {
            completedSlot.release();
            return;
        }
        stopWordBoundaryTicker();

        int completedIdx = currentChunkIndex;
        drainRemainingWordBoundaries(completedIdx);

        completedSlot.release();

        if (nextSlot.isPrepared()) {
            currentSlot = nextSlot;
            currentChunkIndex = nextSlot.getChunkIndex();
            nextSlot = new PlayerSlot();
            wordBoundaryTracker.reset();

            if (listener != null) {
                listener.onChunkStart(currentChunkIndex);
            }
            startWordBoundaryTicker();
            if (listener != null) {
                listener.onChunkCompleted(completedIdx);
            }
            return;
        }

        if (listener != null) {
            listener.onChunkCompleted(completedIdx);
        }
    }

    private void drainRemainingWordBoundaries(int completedIdx) {
        JSONArray boundaries = wordBoundariesSource != null ? wordBoundariesSource.get(completedIdx) : null;
        List<JSONObject> remaining = wordBoundaryTracker.drainRemainingBoundaries(boundaries);
        for (JSONObject wb : remaining) {
            int charIdx = wb.optInt("charIndex", -1);
            if (charIdx >= 0 && listener != null) {
                listener.onWordBoundary(
                        completedIdx, charIdx, wb.optInt("charLength", 1), wb.optString("text", "")
                );
            }
        }
    }

    private void cleanupPreparingSlots() {
        if (preparingCurrentSlot != null) {
            preparingCurrentSlot.release();
            preparingCurrentSlot = null;
        }
        if (preparingNextSlot != null) {
            preparingNextSlot.release();
            preparingNextSlot = null;
        }
    }

    public synchronized void pause() {
        if (!isPlayingSafely()) {
            return;
        }
        currentSlot.pause();
        isPaused = true;
        stopWordBoundaryTicker();
        if (listener != null) {
            listener.onPlaybackStateChange(false, true, false);
        }
    }

    public synchronized void resume() {
        if (!currentSlot.hasPlayer() || !isPaused) {
            return;
        }
        currentSlot.start();
        isPaused = false;
        startWordBoundaryTicker();
        if (listener != null) {
            listener.onPlaybackStateChange(true, false, false);
        }
    }

    public synchronized void stop() {
        currentSessionId++;
        isPlaying = false;
        isPaused = false;
        stopWordBoundaryTicker();
        wordBoundaryTracker.reset();
        cleanupPreparingSlots();
        currentSlot.release();
        nextSlot.release();
        releaseWakeLock();
    }

    public synchronized void reset() {
        stop();
        currentChunkIndex = -1;
        wordBoundariesSource = null;
        mainHandler.removeCallbacksAndMessages(null);
    }

    public synchronized void clearCache() {
        reset();
    }

    public void setWordBoundariesSource(Map<Integer, JSONArray> source) {
        this.wordBoundariesSource = source;
    }

    private void checkWordBoundary() {
        if (!isPlaying || !isPlayingSafely() || wordBoundariesSource == null) {
            return;
        }
        int posMs = currentSlot.getCurrentPosition();
        int durationMs = currentSlot.getDuration();
        JSONArray boundaries = wordBoundariesSource.get(currentChunkIndex);
        JSONObject emitWb = wordBoundaryTracker.findNextBoundary(posMs, durationMs, boundaries);
        if (emitWb == null) {
            return;
        }
        int charIdx = emitWb.optInt("charIndex", -1);
        if (charIdx >= 0 && listener != null) {
            listener.onWordBoundary(
                    currentChunkIndex, charIdx, emitWb.optInt("charLength", 1), emitWb.optString("text", "")
            );
        }
    }

    private void startWordBoundaryTicker() {
        stopWordBoundaryTicker();
        checkWordBoundary();
        wordBoundaryTicker = new Runnable() {
            @Override
            public void run() {
                if (!isPlaying || !isPlayingSafely() || wordBoundariesSource == null) {
                    return;
                }
                checkWordBoundary();
                if (isPlaying) {
                    mainHandler.postDelayed(this, 20);
                }
            }
        };
        mainHandler.postDelayed(wordBoundaryTicker, 20);
    }

    private void stopWordBoundaryTicker() {
        if (wordBoundaryTicker != null) {
            mainHandler.removeCallbacks(wordBoundaryTicker);
            wordBoundaryTicker = null;
        }
    }

    // Helper overloads cho tương thích ngược
    public synchronized void start(int index, File audioFile) {
        start(index, new FileAudioSource(audioFile));
    }

    public synchronized void start(int index, byte[] audioBytes) {
        start(index, new MemoryAudioSource(audioBytes));
    }

    public synchronized void prepareNext(int nextIndex, File nextFile) {
        prepareNext(nextIndex, new FileAudioSource(nextFile));
    }

    public synchronized void prepareNext(int nextIndex, byte[] nextAudioBytes) {
        prepareNext(nextIndex, new MemoryAudioSource(nextAudioBytes));
    }

    public boolean isPlayingSafely() {
        return currentSlot.isPlayingSafely();
    }

    public int getCurrentChunkIndex() {
        return currentChunkIndex;
    }

    public boolean isPlaying() {
        return isPlaying;
    }

    public boolean isPaused() {
        return isPaused;
    }

    public boolean hasCurrentPlayer() {
        return currentSlot.hasPlayer();
    }

    public boolean hasNextPlayer() {
        return nextSlot.hasPlayer();
    }
}
