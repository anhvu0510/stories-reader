package com.vula.stories.tts.edge;

import java.nio.charset.StandardCharsets;

import okio.ByteString;

/**
 * Trích xuất dữ liệu âm thanh thô từ khung tin nhị phân (Binary Frame) của Edge TTS WebSocket.
 * Khung tin của Bing Edge chứa 2 byte chỉ định độ dài header dạng Big-Endian,
 * tiếp theo là chuỗi UTF-8 header (chứa "Path:audio"), và sau cùng là luồng byte MP3 âm thanh.
 */
public final class EdgeAudioFrameExtractor {

    private static final String HEADER_PATH_AUDIO = "Path:audio";

    private EdgeAudioFrameExtractor() {
        // Lớp tiện ích tĩnh, ngăn khởi tạo
    }

    /**
     * Trích xuất mảng byte âm thanh từ frame nhị phân WebSocket.
     * Sử dụng Flat Guard Clauses, trả về null nếu frame không chứa âm thanh hoặc không hợp lệ.
     */
    public static byte[] extractAudioBytes(ByteString payload) {
        if (payload == null) {
            return null;
        }

        byte[] data = payload.toByteArray();
        if (data.length <= 2) {
            return null;
        }

        int headerLen = ((data[0] & 0xFF) << 8) | (data[1] & 0xFF);
        if (data.length <= 2 + headerLen) {
            return null;
        }

        String headers = new String(data, 2, headerLen, StandardCharsets.UTF_8);
        if (!headers.contains(HEADER_PATH_AUDIO)) {
            return null;
        }

        int audioOffset = 2 + headerLen;
        int audioLen = data.length - audioOffset;
        if (audioLen <= 0) {
            return null;
        }

        byte[] audio = new byte[audioLen];
        System.arraycopy(data, audioOffset, audio, 0, audioLen);
        return audio;
    }
}
