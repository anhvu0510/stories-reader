package com.vula.stories.player;

import android.content.Context;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.Map;

/**
 * Robust gapless dual-player engine for audio streaming.
 * Handles MediaPlayer lifecycles, setNextMediaPlayer transitions, WakeLock, and 25ms word boundary tracking.
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
    private PlayerListener listener;

    private PowerManager.WakeLock wakeLock = null;
    private MediaPlayer currentPlayer = null;
    private MediaPlayer nextPlayer = null;
    private int currentChunkIndex = -1;
    private int nextChunkIndex = -1;
    private boolean isPlaying = false;
    private boolean isPaused = false;

    private Runnable wordBoundaryTicker = null;
    private int lastWordBoundaryCharIndex = -1;

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
                wakeLock.acquire(45 * 60 * 1000L); // 45 min timeout
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire wake lock: " + e.getMessage());
        }
    }

    public synchronized void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not release wake lock: " + e.getMessage());
        }
    }

    public boolean isPlayingSafely() {
        if (currentPlayer == null) return false;
        try {
            return currentPlayer.isPlaying();
        } catch (Exception ignored) {
            return false;
        }
    }

    public void safeReleasePlayer(MediaPlayer mp) {
        if (mp == null) return;
        try {
            mp.setOnCompletionListener(null);
            mp.setOnPreparedListener(null);
            mp.setOnErrorListener(null);
            if (mp.isPlaying()) {
                mp.stop();
            }
        } catch (Exception ignored) {}
        try {
            mp.reset();
            mp.release();
        } catch (Exception ignored) {}
    }

    public synchronized void start(int index, File audioFile) {
        if (audioFile == null || !audioFile.exists()) return;

        if (currentPlayer != null) {
            MediaPlayer old = currentPlayer;
            currentPlayer = null;
            safeReleasePlayer(old);
        }

        try {
            MediaPlayer player = new MediaPlayer();
            player.setDataSource(audioFile.getAbsolutePath());
            player.setOnPreparedListener(mp -> {
                if (!isPlaying) {
                    safeReleasePlayer(mp);
                    return;
                }
                currentPlayer = mp;
                currentChunkIndex = index;
                lastWordBoundaryCharIndex = -1;

                try {
                    mp.start();
                } catch (Exception ex) {
                    Log.e(TAG, "Error starting MediaPlayer for chunk " + index, ex);
                    safeReleasePlayer(mp);
                    currentPlayer = null;
                    mainHandler.post(() -> handleChunkCompletion(mp));
                    return;
                }

                if (listener != null) {
                    listener.onChunkStart(index);
                    listener.onPlaybackStateChange(true, false, false);
                }

                startWordBoundaryTicker();
            });

            player.setOnCompletionListener(mp -> mainHandler.post(() -> handleChunkCompletion(mp)));
            player.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer error: what=" + what + ", extra=" + extra);
                mainHandler.post(() -> handleChunkCompletion(mp));
                return true;
            });

            isPlaying = true;
            isPaused = false;
            player.prepareAsync();
        } catch (Exception ex) {
            Log.e(TAG, "Error configuring player for chunk " + index, ex);
        }
    }

    public synchronized void prepareNext(int nextIndex, File nextFile) {
        if (!isPlaying || nextPlayer != null || currentPlayer == null) return;
        if (nextFile == null || !nextFile.exists()) return;

        try {
            MediaPlayer next = new MediaPlayer();
            next.setDataSource(nextFile.getAbsolutePath());
            next.setOnPreparedListener(mp -> {
                if (!isPlaying || currentPlayer == null) {
                    safeReleasePlayer(mp);
                    return;
                }
                nextPlayer = mp;
                nextChunkIndex = nextIndex;
                try {
                    currentPlayer.setNextMediaPlayer(nextPlayer);
                    Log.d(TAG, "Gapless connection ready for chunk " + nextIndex);
                } catch (Exception ex) {
                    Log.w(TAG, "Failed setNextMediaPlayer: " + ex.getMessage());
                }
            });
            next.setOnCompletionListener(mp -> mainHandler.post(() -> handleChunkCompletion(mp)));
            next.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "Next MediaPlayer error: what=" + what + ", extra=" + extra);
                if (nextPlayer == mp) {
                    nextPlayer = null;
                    nextChunkIndex = -1;
                }
                safeReleasePlayer(mp);
                return true;
            });
            next.prepareAsync();
        } catch (Exception ex) {
            Log.w(TAG, "Error preparing next player: " + ex.getMessage());
        }
    }

    private void handleChunkCompletion(MediaPlayer completedPlayer) {
        if (!isPlaying) {
            safeReleasePlayer(completedPlayer);
            return;
        }
        stopWordBoundaryTicker();

        int completedIdx = currentChunkIndex;
        if (currentPlayer == completedPlayer) {
            currentPlayer = null;
        }
        safeReleasePlayer(completedPlayer);

        if (nextPlayer != null) {
            currentPlayer = nextPlayer;
            currentChunkIndex = nextChunkIndex;
            nextPlayer = null;
            nextChunkIndex = -1;
            lastWordBoundaryCharIndex = -1;

            if (listener != null) {
                listener.onChunkStart(currentChunkIndex);
            }
            startWordBoundaryTicker();
            if (listener != null) {
                listener.onChunkCompleted(completedIdx);
            }
        } else {
            if (listener != null) {
                listener.onChunkCompleted(completedIdx);
            }
        }
    }

    public synchronized void pause() {
        if (isPlayingSafely()) {
            try {
                currentPlayer.pause();
                isPaused = true;
                stopWordBoundaryTicker();
                if (listener != null) {
                    listener.onPlaybackStateChange(false, true, false);
                }
            } catch (Exception ex) {
                Log.w(TAG, "Error pausing player: " + ex.getMessage());
            }
        }
    }

    public synchronized void resume() {
        if (currentPlayer != null && isPaused) {
            try {
                currentPlayer.start();
                isPaused = false;
                startWordBoundaryTicker();
                if (listener != null) {
                    listener.onPlaybackStateChange(true, false, false);
                }
            } catch (Exception ex) {
                Log.w(TAG, "Error resuming player: " + ex.getMessage());
            }
        }
    }

    public synchronized void stop() {
        isPlaying = false;
        isPaused = false;
        stopWordBoundaryTicker();

        if (currentPlayer != null) {
            MediaPlayer p = currentPlayer;
            currentPlayer = null;
            safeReleasePlayer(p);
        }
        if (nextPlayer != null) {
            MediaPlayer np = nextPlayer;
            nextPlayer = null;
            nextChunkIndex = -1;
            safeReleasePlayer(np);
        }
        releaseWakeLock();
    }

    public synchronized void reset() {
        stop();
        currentChunkIndex = -1;
        nextChunkIndex = -1;
        lastWordBoundaryCharIndex = -1;
    }

    private Map<Integer, JSONArray> wordBoundariesSource = null;

    public void setWordBoundariesSource(Map<Integer, JSONArray> source) {
        this.wordBoundariesSource = source;
    }

    private void startWordBoundaryTicker() {
        stopWordBoundaryTicker();
        wordBoundaryTicker = new Runnable() {
            @Override
            public void run() {
                if (isPlaying && isPlayingSafely() && wordBoundariesSource != null) {
                    try {
                        int posMs = currentPlayer.getCurrentPosition();
                        double posSec = (double) posMs / 1000.0;
                        JSONArray boundaries = wordBoundariesSource.get(currentChunkIndex);
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
                                if (charIdx >= 0 && charIdx > lastWordBoundaryCharIndex) {
                                    lastWordBoundaryCharIndex = charIdx;
                                    if (listener != null) {
                                        listener.onWordBoundary(
                                                currentChunkIndex,
                                                charIdx,
                                                activeWb.optInt("charLength", 1),
                                                activeWb.optString("text", "")
                                        );
                                    }
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                    if (isPlaying) {
                        mainHandler.postDelayed(this, 25);
                    }
                }
            }
        };
        mainHandler.postDelayed(wordBoundaryTicker, 25);
    }

    private void stopWordBoundaryTicker() {
        if (wordBoundaryTicker != null) {
            mainHandler.removeCallbacks(wordBoundaryTicker);
            wordBoundaryTicker = null;
        }
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
        return currentPlayer != null;
    }

    public boolean hasNextPlayer() {
        return nextPlayer != null;
    }
}
