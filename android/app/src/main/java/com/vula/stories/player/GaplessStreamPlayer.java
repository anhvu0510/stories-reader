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
 * Handles MediaPlayer lifecycles, setNextMediaPlayer transitions, WakeLock, and 20ms word boundary tracking.
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
    private MediaPlayer preparingCurrentPlayer = null;
    private MediaPlayer preparingNextPlayer = null;
    private int currentChunkIndex = -1;
    private int nextChunkIndex = -1;
    private boolean isPlaying = false;
    private boolean isPaused = false;

    // Quản lý phiên phát (Session ID) để cô lập hoàn toàn các callback bất đồng bộ của luồng chuẩn bị trước đó
    private long currentSessionId = 0;

    private Runnable wordBoundaryTicker = null;
    private int lastWordBoundaryIndex = -1;

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

    /**
     * Bắt đầu phát âm thanh cho câu chỉ định.
     * Tự động tăng mã phiên để vô hiệu hóa mọi callback bất đồng bộ của luồng chuẩn bị cũ.
     *
     * @param index     Chỉ số câu cần phát
     * @param audioFile File âm thanh từ bộ nhớ đệm
     */
    public synchronized void start(int index, File audioFile) {
        if (audioFile == null || !audioFile.exists()) return;

        // Tăng mã phiên để vô hiệu hóa toàn bộ callback bất đồng bộ của luồng chuẩn bị trước đó
        final long sessionId = ++currentSessionId;

        // Thu hồi triệt để các trình phát đang chuẩn bị dở dang để tránh xung đột tài nguyên
        if (preparingCurrentPlayer != null) {
            safeReleasePlayer(preparingCurrentPlayer);
            preparingCurrentPlayer = null;
        }
        if (preparingNextPlayer != null) {
            safeReleasePlayer(preparingNextPlayer);
            preparingNextPlayer = null;
        }
        if (currentPlayer != null) {
            MediaPlayer old = currentPlayer;
            currentPlayer = null;
            safeReleasePlayer(old);
        }
        if (nextPlayer != null) {
            MediaPlayer oldNext = nextPlayer;
            nextPlayer = null;
            nextChunkIndex = -1;
            safeReleasePlayer(oldNext);
        }

        try {
            // Thiết lập trạng thái và chỉ số chunk ngay từ đầu để tránh bế tắc logic (deadlock) khi truy vấn bất đồng bộ
            currentChunkIndex = index;
            isPlaying = true;
            isPaused = false;

            MediaPlayer player = new MediaPlayer();
            preparingCurrentPlayer = player;
            player.setDataSource(audioFile.getAbsolutePath());
            player.setOnPreparedListener(mp -> {
                synchronized (GaplessStreamPlayer.this) {
                    if (sessionId != currentSessionId || !isPlaying) {
                        safeReleasePlayer(mp);
                        if (preparingCurrentPlayer == mp) {
                            preparingCurrentPlayer = null;
                        }
                        return;
                    }

                    if (preparingCurrentPlayer == mp) {
                        preparingCurrentPlayer = null;
                    }
                    currentPlayer = mp;
                    currentChunkIndex = index;
                    lastWordBoundaryIndex = -1;

                    try {
                        mp.start();
                    } catch (Exception ex) {
                        Log.e(TAG, "Error starting MediaPlayer for chunk " + index, ex);
                        safeReleasePlayer(mp);
                        currentPlayer = null;
                        mainHandler.post(() -> handleChunkCompletion(mp, sessionId));
                        return;
                    }

                    if (listener != null) {
                        listener.onChunkStart(index);
                        listener.onPlaybackStateChange(true, false, false);
                    }

                    startWordBoundaryTicker();
                }
            });

            player.setOnCompletionListener(mp -> mainHandler.post(() -> handleChunkCompletion(mp, sessionId)));
            player.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer error: what=" + what + ", extra=" + extra);
                mainHandler.post(() -> handleChunkCompletion(mp, sessionId));
                return true;
            });

            isPlaying = true;
            isPaused = false;
            player.prepareAsync();
        } catch (Exception ex) {
            Log.e(TAG, "Error configuring player for chunk " + index, ex);
            if (preparingCurrentPlayer != null) {
                safeReleasePlayer(preparingCurrentPlayer);
                preparingCurrentPlayer = null;
            }
        }
    }

    /**
     * Chuẩn bị trước câu tiếp theo để chuyển tiếp liền mạch 0ms (gapless).
     *
     * @param nextIndex Chỉ số câu tiếp theo
     * @param nextFile  File âm thanh của câu tiếp theo
     */
    public synchronized void prepareNext(int nextIndex, File nextFile) {
        if (!isPlaying || nextPlayer != null || currentPlayer == null) return;
        if (nextFile == null || !nextFile.exists()) return;

        if (preparingNextPlayer != null) {
            safeReleasePlayer(preparingNextPlayer);
            preparingNextPlayer = null;
        }

        final long sessionId = currentSessionId;

        try {
            MediaPlayer next = new MediaPlayer();
            preparingNextPlayer = next;
            next.setDataSource(nextFile.getAbsolutePath());
            next.setOnPreparedListener(mp -> {
                synchronized (GaplessStreamPlayer.this) {
                    if (sessionId != currentSessionId || !isPlaying || currentPlayer == null) {
                        safeReleasePlayer(mp);
                        if (preparingNextPlayer == mp) {
                            preparingNextPlayer = null;
                        }
                        return;
                    }

                    if (preparingNextPlayer == mp) {
                        preparingNextPlayer = null;
                    }
                    nextPlayer = mp;
                    nextChunkIndex = nextIndex;
                    try {
                        currentPlayer.setNextMediaPlayer(nextPlayer);
                        Log.d(TAG, "Gapless connection ready for chunk " + nextIndex);
                    } catch (Exception ex) {
                        Log.w(TAG, "Failed setNextMediaPlayer: " + ex.getMessage());
                    }
                }
            });
            next.setOnCompletionListener(mp -> mainHandler.post(() -> handleChunkCompletion(mp, sessionId)));
            next.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "Next MediaPlayer error: what=" + what + ", extra=" + extra);
                synchronized (GaplessStreamPlayer.this) {
                    if (sessionId == currentSessionId) {
                        if (preparingNextPlayer == mp) {
                            preparingNextPlayer = null;
                        }
                        if (nextPlayer == mp) {
                            nextPlayer = null;
                            nextChunkIndex = -1;
                        }
                    }
                }
                safeReleasePlayer(mp);
                return true;
            });
            next.prepareAsync();
        } catch (Exception ex) {
            Log.w(TAG, "Error preparing next player: " + ex.getMessage());
            if (preparingNextPlayer != null) {
                safeReleasePlayer(preparingNextPlayer);
                preparingNextPlayer = null;
            }
        }
    }

    /**
     * Bắt đầu phát âm thanh từ bộ đệm RAM (in-memory) bằng ByteArrayMediaDataSource.
     * Hoàn toàn không ghi đĩa, tối ưu 0ms I/O.
     *
     * @param index      Chỉ số câu cần phát
     * @param audioBytes Mảng byte âm thanh thô trong RAM
     */
    public synchronized void start(int index, byte[] audioBytes) {
        if (audioBytes == null || audioBytes.length == 0) return;

        final long sessionId = ++currentSessionId;

        if (preparingCurrentPlayer != null) {
            safeReleasePlayer(preparingCurrentPlayer);
            preparingCurrentPlayer = null;
        }
        if (preparingNextPlayer != null) {
            safeReleasePlayer(preparingNextPlayer);
            preparingNextPlayer = null;
        }
        if (currentPlayer != null) {
            MediaPlayer old = currentPlayer;
            currentPlayer = null;
            safeReleasePlayer(old);
        }
        if (nextPlayer != null) {
            MediaPlayer oldNext = nextPlayer;
            nextPlayer = null;
            nextChunkIndex = -1;
            safeReleasePlayer(oldNext);
        }

        try {
            currentChunkIndex = index;
            isPlaying = true;
            isPaused = false;

            MediaPlayer player = new MediaPlayer();
            preparingCurrentPlayer = player;
            player.setDataSource(new ByteArrayMediaDataSource(audioBytes));
            player.setOnPreparedListener(mp -> {
                synchronized (GaplessStreamPlayer.this) {
                    if (sessionId != currentSessionId || !isPlaying) {
                        safeReleasePlayer(mp);
                        if (preparingCurrentPlayer == mp) {
                            preparingCurrentPlayer = null;
                        }
                        return;
                    }

                    if (preparingCurrentPlayer == mp) {
                        preparingCurrentPlayer = null;
                    }
                    currentPlayer = mp;
                    currentChunkIndex = index;
                    lastWordBoundaryIndex = -1;

                    try {
                        mp.start();
                    } catch (Exception ex) {
                        Log.e(TAG, "Error starting in-memory MediaPlayer for chunk " + index, ex);
                        safeReleasePlayer(mp);
                        currentPlayer = null;
                        mainHandler.post(() -> handleChunkCompletion(mp, sessionId));
                        return;
                    }

                    if (listener != null) {
                        listener.onChunkStart(index);
                        listener.onPlaybackStateChange(true, false, false);
                    }

                    startWordBoundaryTicker();
                }
            });

            player.setOnCompletionListener(mp -> mainHandler.post(() -> handleChunkCompletion(mp, sessionId)));
            player.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer in-memory error: what=" + what + ", extra=" + extra);
                mainHandler.post(() -> handleChunkCompletion(mp, sessionId));
                return true;
            });

            isPlaying = true;
            isPaused = false;
            player.prepareAsync();
        } catch (Exception ex) {
            Log.e(TAG, "Error configuring in-memory player for chunk " + index, ex);
            if (preparingCurrentPlayer != null) {
                safeReleasePlayer(preparingCurrentPlayer);
                preparingCurrentPlayer = null;
            }
        }
    }

    /**
     * Chuẩn bị trước câu tiếp theo từ bộ nhớ RAM để chuyển tiếp gapless 0ms.
     *
     * @param nextIndex      Chỉ số câu tiếp theo
     * @param nextAudioBytes Mảng byte âm thanh của câu tiếp theo trong RAM
     */
    public synchronized void prepareNext(int nextIndex, byte[] nextAudioBytes) {
        if (!isPlaying || nextPlayer != null || currentPlayer == null) return;
        if (nextAudioBytes == null || nextAudioBytes.length == 0) return;

        if (preparingNextPlayer != null) {
            safeReleasePlayer(preparingNextPlayer);
            preparingNextPlayer = null;
        }

        final long sessionId = currentSessionId;

        try {
            MediaPlayer next = new MediaPlayer();
            preparingNextPlayer = next;
            next.setDataSource(new ByteArrayMediaDataSource(nextAudioBytes));
            next.setOnPreparedListener(mp -> {
                synchronized (GaplessStreamPlayer.this) {
                    if (sessionId != currentSessionId || !isPlaying || currentPlayer == null) {
                        safeReleasePlayer(mp);
                        if (preparingNextPlayer == mp) {
                            preparingNextPlayer = null;
                        }
                        return;
                    }

                    if (preparingNextPlayer == mp) {
                        preparingNextPlayer = null;
                    }
                    nextPlayer = mp;
                    nextChunkIndex = nextIndex;
                    try {
                        currentPlayer.setNextMediaPlayer(nextPlayer);
                        Log.d(TAG, "Gapless connection ready (in-memory) for chunk " + nextIndex);
                    } catch (Exception ex) {
                        Log.w(TAG, "Failed setNextMediaPlayer (in-memory): " + ex.getMessage());
                    }
                }
            });
            next.setOnCompletionListener(mp -> mainHandler.post(() -> handleChunkCompletion(mp, sessionId)));
            next.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "Next in-memory MediaPlayer error: what=" + what + ", extra=" + extra);
                synchronized (GaplessStreamPlayer.this) {
                    if (sessionId == currentSessionId) {
                        if (preparingNextPlayer == mp) {
                            preparingNextPlayer = null;
                        }
                        if (nextPlayer == mp) {
                            nextPlayer = null;
                            nextChunkIndex = -1;
                        }
                    }
                }
                safeReleasePlayer(mp);
                return true;
            });
            next.prepareAsync();
        } catch (Exception ex) {
            Log.w(TAG, "Error preparing in-memory next player: " + ex.getMessage());
            if (preparingNextPlayer != null) {
                safeReleasePlayer(preparingNextPlayer);
                preparingNextPlayer = null;
            }
        }
    }

    /**
     * Xử lý khi một câu hoàn tất phát xong, chuyển sang câu tiếp theo liền mạch nếu có.
     *
     * @param completedPlayer MediaPlayer vừa hoàn thành
     * @param sessionId       Mã phiên tương ứng
     */
    private synchronized void handleChunkCompletion(MediaPlayer completedPlayer, long sessionId) {
        if (sessionId != currentSessionId || !isPlaying) {
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
            lastWordBoundaryIndex = -1;

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

    public synchronized void pause() {
        if (!isPlayingSafely()) return;
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

    public synchronized void resume() {
        if (currentPlayer == null || !isPaused) return;
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

    /**
     * Dừng phát ngay lập tức, vô hiệu hóa toàn bộ callback bất đồng bộ và thu hồi tài nguyên MediaPlayer.
     */
    public synchronized void stop() {
        // Tăng mã phiên để vô hiệu hóa toàn bộ callback bất đồng bộ đang chờ trong hàng đợi
        currentSessionId++;
        isPlaying = false;
        isPaused = false;
        stopWordBoundaryTicker();
        lastWordBoundaryIndex = -1;

        if (preparingCurrentPlayer != null) {
            MediaPlayer p = preparingCurrentPlayer;
            preparingCurrentPlayer = null;
            safeReleasePlayer(p);
        }
        if (preparingNextPlayer != null) {
            MediaPlayer p = preparingNextPlayer;
            preparingNextPlayer = null;
            safeReleasePlayer(p);
        }
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

    /**
     * Đặt lại hoàn toàn trạng thái trình phát, xóa sạch bộ nhớ tạm và các tham chiếu dữ liệu.
     */
    public synchronized void reset() {
        stop();
        currentChunkIndex = -1;
        nextChunkIndex = -1;
        lastWordBoundaryIndex = -1;
        wordBoundariesSource = null;
        mainHandler.removeCallbacksAndMessages(null);
    }

    /**
     * Dọn dẹp toàn bộ bộ nhớ tạm, giải phóng tài nguyên và reset trạng thái chuẩn bị cho flow đọc mới.
     */
    public synchronized void clearCache() {
        reset();
    }

    private Map<Integer, JSONArray> wordBoundariesSource = null;

    public void setWordBoundariesSource(Map<Integer, JSONArray> source) {
        this.wordBoundariesSource = source;
    }

    private void checkWordBoundary() {
        if (!isPlaying || !isPlayingSafely() || wordBoundariesSource == null) return;
        try {
            int posMs = currentPlayer != null ? currentPlayer.getCurrentPosition() : 0;
            double posSec = (double) posMs / 1000.0;

            JSONArray boundaries = wordBoundariesSource.get(currentChunkIndex);
            if (boundaries == null || boundaries.length() == 0) return;

            JSONObject activeWb = null;
            int activeIdx = -1;
            for (int i = 0; i < boundaries.length(); i++) {
                JSONObject wb = boundaries.optJSONObject(i);
                if (wb == null) continue;
                double startSec = wb.optDouble("startSeconds", 0);
                if (posSec < startSec) break;
                activeWb = wb;
                activeIdx = i;
            }

            // Nếu vừa bắt đầu câu (lastWordBoundaryIndex < 0), lập tức lấy từ đầu tiên (index 0)
            // để hiển thị ngay highlight dòng và chữ đầu tiên, triệt tiêu hoàn toàn độ trễ khi chuyển câu/đoạn
            if (activeWb == null && lastWordBoundaryIndex < 0) {
                activeWb = boundaries.optJSONObject(0);
                activeIdx = 0;
            }

            if (activeWb == null || activeIdx <= lastWordBoundaryIndex) return;

            lastWordBoundaryIndex = activeIdx;
            int charIdx = activeWb.optInt("charIndex", -1);
            if (charIdx >= 0 && listener != null) {
                listener.onWordBoundary(
                        currentChunkIndex,
                        charIdx,
                        activeWb.optInt("charLength", 1),
                        activeWb.optString("text", "")
                );
            }
        } catch (Exception ignored) {}
    }

    private void startWordBoundaryTicker() {
        stopWordBoundaryTicker();
        checkWordBoundary(); // Chạy ngay lập tức lần đầu (0ms) để highlight ngay từ đầu câu

        wordBoundaryTicker = new Runnable() {
            @Override
            public void run() {
                if (!isPlaying || !isPlayingSafely() || wordBoundariesSource == null) return;
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
