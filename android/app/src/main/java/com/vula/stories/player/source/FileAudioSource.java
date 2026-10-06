package com.vula.stories.player.source;

import android.media.MediaPlayer;

import java.io.File;
import java.io.IOException;

/**
 * Nguồn cấp âm thanh từ tệp lưu trữ trên bộ nhớ đệm thiết bị.
 */
public class FileAudioSource implements AudioSource {

    private final File file;

    public FileAudioSource(File file) {
        this.file = file;
    }

    @Override
    public void applyTo(MediaPlayer player) throws IOException {
        if (player == null || file == null) {
            return;
        }
        player.setDataSource(file.getAbsolutePath());
    }

    @Override
    public boolean isValid() {
        return file != null && file.exists() && file.length() > 0;
    }

    public File getFile() {
        return file;
    }
}
