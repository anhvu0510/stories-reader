package com.vula.stories.player.source;

import android.media.MediaPlayer;

import com.vula.stories.player.ByteArrayMediaDataSource;

import java.io.IOException;

/**
 * Nguồn cấp âm thanh trực tiếp từ mảng byte trong bộ nhớ RAM qua ByteArrayMediaDataSource.
 * Tối ưu hóa đọc trực tiếp không cần ghi đĩa (0ms I/O).
 */
public class MemoryAudioSource implements AudioSource {

    private final byte[] bytes;

    public MemoryAudioSource(byte[] bytes) {
        this.bytes = bytes;
    }

    @Override
    public void applyTo(MediaPlayer player) throws IOException {
        if (player == null || bytes == null) {
            return;
        }
        player.setDataSource(new ByteArrayMediaDataSource(bytes));
    }

    @Override
    public boolean isValid() {
        return bytes != null && bytes.length > 0;
    }

    public byte[] getBytes() {
        return bytes;
    }
}
