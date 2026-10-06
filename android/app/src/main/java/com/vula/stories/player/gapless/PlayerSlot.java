package com.vula.stories.player.gapless;

import android.media.MediaPlayer;
import android.util.Log;

import com.vula.stories.player.source.AudioSource;

/**
 * Đóng gói và quản lý vòng đời một instance MediaPlayer (Deep Module).
 * Phụ trách chuẩn bị bất đồng bộ, phát, tạm dừng và chuyển giao gapless an toàn.
 */
public class PlayerSlot {

    private static final String TAG = "PlayerSlot";

    public interface SlotCallback {
        void onPrepared(PlayerSlot slot);
        void onCompleted(PlayerSlot slot);
        void onError(PlayerSlot slot, int what, int extra);
    }

    private MediaPlayer player;
    private int chunkIndex = -1;
    private boolean isPrepared = false;
    private SlotCallback callback;

    public synchronized void prepare(int chunkIndex, AudioSource source, SlotCallback callback) {
        release();
        if (source == null || !source.isValid()) {
            return;
        }

        this.chunkIndex = chunkIndex;
        this.callback = callback;
        this.isPrepared = false;

        try {
            player = new MediaPlayer();
            source.applyTo(player);

            player.setOnPreparedListener(mp -> {
                synchronized (PlayerSlot.this) {
                    isPrepared = true;
                    if (this.callback != null) {
                        this.callback.onPrepared(PlayerSlot.this);
                    }
                }
            });

            player.setOnCompletionListener(mp -> {
                synchronized (PlayerSlot.this) {
                    if (this.callback != null) {
                        this.callback.onCompleted(PlayerSlot.this);
                    }
                }
            });

            player.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer slot lỗi: what=" + what + ", extra=" + extra);
                synchronized (PlayerSlot.this) {
                    if (this.callback != null) {
                        this.callback.onError(PlayerSlot.this, what, extra);
                    }
                }
                return true;
            });

            player.prepareAsync();
        } catch (Exception ex) {
            Log.e(TAG, "Lỗi khởi tạo MediaPlayer slot cho câu " + chunkIndex, ex);
            release();
        }
    }

    public synchronized boolean start() {
        if (player == null || !isPrepared) {
            return false;
        }
        try {
            player.start();
            return true;
        } catch (Exception ex) {
            Log.e(TAG, "Lỗi bắt đầu phát MediaPlayer slot: " + ex.getMessage());
            return false;
        }
    }

    public synchronized void pause() {
        if (player == null || !isPlayingSafely()) {
            return;
        }
        try {
            player.pause();
        } catch (Exception ex) {
            Log.w(TAG, "Lỗi tạm dừng slot: " + ex.getMessage());
        }
    }

    public synchronized boolean isPlayingSafely() {
        if (player == null || !isPrepared) {
            return false;
        }
        try {
            return player.isPlaying();
        } catch (IllegalStateException ex) {
            Log.d(TAG, "MediaPlayer slot ở trạng thái không hợp lệ: " + ex.getMessage());
            return false;
        }
    }

    public synchronized void setNextSlot(PlayerSlot nextSlot) {
        if (player == null || nextSlot == null || nextSlot.player == null) {
            return;
        }
        try {
            player.setNextMediaPlayer(nextSlot.player);
            Log.d(TAG, "Đã kết nối gapless sang slot câu " + nextSlot.getChunkIndex());
        } catch (Exception ex) {
            Log.w(TAG, "Thất bại khi gán setNextMediaPlayer: " + ex.getMessage());
        }
    }

    public synchronized int getCurrentPosition() {
        if (player == null || !isPrepared) {
            return 0;
        }
        try {
            return player.getCurrentPosition();
        } catch (Exception ex) {
            return 0;
        }
    }

    public synchronized int getDuration() {
        if (player == null || !isPrepared) {
            return 0;
        }
        try {
            return player.getDuration();
        } catch (Exception ex) {
            return 0;
        }
    }

    public synchronized void release() {
        if (player == null) {
            return;
        }
        try {
            player.setOnCompletionListener(null);
            player.setOnPreparedListener(null);
            player.setOnErrorListener(null);
            if (player.isPlaying()) {
                player.stop();
            }
            player.reset();
            player.release();
        } catch (Exception ex) {
            Log.d(TAG, "Thu hồi slot an toàn: " + ex.getMessage());
        } finally {
            player = null;
            isPrepared = false;
            chunkIndex = -1;
            callback = null;
        }
    }

    public int getChunkIndex() {
        return chunkIndex;
    }

    public boolean isPrepared() {
        return isPrepared;
    }

    public boolean hasPlayer() {
        return player != null;
    }
}
