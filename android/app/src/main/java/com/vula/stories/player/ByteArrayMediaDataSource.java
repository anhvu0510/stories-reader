package com.vula.stories.player;

import android.media.MediaDataSource;
import java.io.IOException;

/**
 * In-memory MediaDataSource wrapping raw audio bytes for zero-IO playback via MediaPlayer.
 * Thread-safe and compatible with Android API 23+.
 */
public class ByteArrayMediaDataSource extends MediaDataSource {
    private final byte[] data;

    public ByteArrayMediaDataSource(byte[] data) {
        this.data = data != null ? data : new byte[0];
    }

    @Override
    public synchronized int readAt(long position, byte[] buffer, int offset, int size) throws IOException {
        if (position >= data.length) {
            return -1; // Hết dữ liệu (End of Stream)
        }
        if (position + size > data.length) {
            size = (int) (data.length - position);
        }
        System.arraycopy(data, (int) position, buffer, offset, size);
        return size;
    }

    @Override
    public synchronized long getSize() throws IOException {
        return data.length;
    }

    @Override
    public synchronized void close() throws IOException {
        // Không giữ file descriptor hoặc socket, không cần giải phóng tài nguyên hệ thống
    }
}
