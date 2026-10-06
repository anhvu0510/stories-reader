package com.vula.stories.player.source;

import android.media.MediaPlayer;

import java.io.IOException;

/**
 * Giao diện trừu tượng hóa nguồn cấp âm thanh cho MediaPlayer.
 * Cho phép xử lý thống nhất cả âm thanh từ tệp đĩa (File) và âm thanh trong bộ nhớ RAM (byte[]).
 */
public interface AudioSource {
    /**
     * Áp dụng nguồn dữ liệu vào MediaPlayer.
     */
    void applyTo(MediaPlayer player) throws IOException;

    /**
     * Kiểm tra tính hợp lệ và sẵn sàng của nguồn dữ liệu trước khi khởi tạo.
     */
    boolean isValid();
}
