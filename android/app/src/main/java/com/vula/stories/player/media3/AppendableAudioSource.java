package com.vula.stories.player.media3;

import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

public final class AppendableAudioSource {
    private static final long READ_WAIT_MS = 250L;

    private final Object lock = new Object();
    private static final class AudioBuffer extends ByteArrayOutputStream {
        int copy(long position, byte[] target, int offset, int length) {
            int readLength = Math.min(length, count - (int) position);
            System.arraycopy(buf, (int) position, target, offset, readLength);
            return readLength;
        }
    }

    private final AudioBuffer buffer = new AudioBuffer();
    private boolean completed;
    private IOException failure;

    public void append(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return;
        synchronized (lock) {
            if (completed) return;
            buffer.write(bytes, 0, bytes.length);
            lock.notifyAll();
        }
    }

    public void complete() {
        synchronized (lock) {
            completed = true;
            lock.notifyAll();
        }
    }

    public void fail(IOException error) {
        synchronized (lock) {
            failure = error;
            completed = true;
            lock.notifyAll();
        }
    }

    public int size() {
        synchronized (lock) {
            return buffer.size();
        }
    }

    public long remainingLength(long position) {
        synchronized (lock) {
            return completed ? Math.max(0L, buffer.size() - position) : C.LENGTH_UNSET;
        }
    }

    public boolean isCompleted() {
        synchronized (lock) {
            return completed;
        }
    }

    public IOException getFailure() {
        synchronized (lock) {
            return failure;
        }
    }

    public byte[] snapshot() {
        synchronized (lock) {
            return buffer.toByteArray();
        }
    }

    public DataSource.Factory factory() {
        return Reader::new;
    }

    private final class Reader extends BaseDataSource {
        private long position;
        private boolean opened;

        private Reader() {
            super(false);
        }

        @Override
        public long open(DataSpec dataSpec) {
            position = dataSpec.position;
            opened = true;
            transferStarted(dataSpec);
            return remainingLength(position);
        }

        @Override
        public int read(byte[] target, int offset, int length) throws IOException {
            if (length == 0) return 0;
            synchronized (lock) {
                awaitBytes();
                if (failure != null) throw failure;
                if (position >= buffer.size() && completed) return C.RESULT_END_OF_INPUT;
                int readLength = buffer.copy(position, target, offset, length);
                position += readLength;
                bytesTransferred(readLength);
                return readLength;
            }
        }

        private void awaitBytes() throws IOException {
            while (position >= buffer.size() && !completed && failure == null) {
                try {
                    lock.wait(READ_WAIT_MS);
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Progressive audio read interrupted", error);
                }
            }
        }

        @Nullable
        @Override
        public Uri getUri() {
            return Uri.parse("memory://stories-edge-audio");
        }

        @Override
        public void close() {
            if (!opened) return;
            opened = false;
            transferEnded();
        }
    }
}
