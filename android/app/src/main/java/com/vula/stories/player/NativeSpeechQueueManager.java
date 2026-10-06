package com.vula.stories.player;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

/**
 * Deep Module quản lý hàng đợi phát âm thanh trực tiếp (Direct Native Speech Queue):
 * 
 * Kiến trúc & Nguyên lý cốt lõi:
 * 1. Thay vì ghi file .wav thô ra đĩa qua synthesizeToFile rồi đoán mò mốc thời gian,
 *    module này sử dụng trực tiếp hàng đợi native của Android TextToSpeech (QUEUE_ADD).
 * 2. Tận dụng sự kiện thời gian thực UtteranceProgressListener.onRangeStart do chính
 *    Speech Engine trên điện thoại phát ra khi loa đọc từng từ, loại bỏ hoàn toàn độ trễ (0ms latency).
 * 3. Hỗ trợ đầy đủ các lệnh điều khiển phát (Play, Pause, Resume, Stop, Seek) và đồng bộ
 *    với thanh trạng thái hệ thống qua StoriesAudioBridge.
 */
public class NativeSpeechQueueManager {

    private static final String TAG = "NativeSpeechQueue";
    public static final String UTTERANCE_PREFIX = "speech_chunk_";

    // Số lượng câu tối đa được nạp vào hàng đợi native mỗi lượt (cuốn chiếu rolling queue)
    public static final int QUEUE_LOOKAHEAD = 5;

    public interface SpeechStreamListener {
        void onChunkStart(int chunkIndex);
        void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text);
        void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering);
        void onChunkCompleted(int chunkIndex);
        void onAllCompleted();
    }

    private final List<String> chunks = new ArrayList<>();
    private SpeechStreamListener listener = null;
    private int currentChunkIndex = 0;
    private volatile boolean isPlaying = false;
    private volatile boolean isPaused = false;

    public NativeSpeechQueueManager() {}

    public synchronized void setListener(SpeechStreamListener listener) {
        this.listener = listener;
    }

    /**
     * Thiết lập danh sách các câu cần đọc và vị trí câu bắt đầu.
     */
    public synchronized void setChunks(List<String> newChunks, int startIndex) {
        this.chunks.clear();
        if (newChunks != null) {
            this.chunks.addAll(newChunks);
        }
        this.currentChunkIndex = Math.max(0, Math.min(startIndex, Math.max(0, this.chunks.size() - 1)));
    }

    /**
     * Sinh mã UtteranceId định danh cho câu văn.
     */
    public static String buildUtteranceId(int chunkIndex) {
        return UTTERANCE_PREFIX + chunkIndex;
    }

    /**
     * Giải mã chỉ số câu (chunkIndex) từ mã UtteranceId.
     */
    public static int parseChunkIndex(String utteranceId) {
        if (utteranceId != null && utteranceId.startsWith(UTTERANCE_PREFIX)) {
            try {
                return Integer.parseInt(utteranceId.substring(UTTERANCE_PREFIX.length()));
            } catch (NumberFormatException e) {
                Log.w(TAG, "Không thể phân giải chunkIndex từ utteranceId: " + utteranceId);
            }
        }
        return -1;
    }

    /**
     * Nạp các câu văn vào hàng đợi Android TextToSpeech:
     * - Câu đầu tiên sử dụng QUEUE_FLUSH để ngắt câu cũ và phát ngay lập tức.
     * - Các câu tiếp theo trong phạm vi lookahead sử dụng QUEUE_ADD để gối đầu gapless.
     */
    public synchronized void startSpeaking(TextToSpeech tts, int startIndex, Bundle params) {
        if (tts == null || chunks.isEmpty()) return;

        int validStart = Math.max(0, Math.min(startIndex, chunks.size() - 1));
        currentChunkIndex = validStart;
        isPlaying = true;
        isPaused = false;

        // Phát câu khởi đầu (QUEUE_FLUSH)
        String firstText = chunks.get(validStart);
        tts.speak(firstText, TextToSpeech.QUEUE_FLUSH, params, buildUtteranceId(validStart));

        // Nạp trước các câu gối đầu tiếp theo (QUEUE_ADD)
        int maxAhead = Math.min(chunks.size() - 1, validStart + QUEUE_LOOKAHEAD);
        for (int i = validStart + 1; i <= maxAhead; i++) {
            String nextText = chunks.get(i);
            tts.speak(nextText, TextToSpeech.QUEUE_ADD, params, buildUtteranceId(i));
        }

        if (listener != null) {
            listener.onPlaybackStateChange(true, false, false);
        }
    }

    /**
     * Nạp bổ sung cuốn chiếu (rolling prefetch) thêm các câu kế tiếp khi tiến trình đọc tiến tới.
     */
    public synchronized void maintainQueue(TextToSpeech tts, Bundle params) {
        if (tts == null || !isPlaying || chunks.isEmpty()) return;

        int targetLookahead = Math.min(chunks.size() - 1, currentChunkIndex + QUEUE_LOOKAHEAD);
        for (int i = currentChunkIndex + 1; i <= targetLookahead; i++) {
            String aheadText = chunks.get(i);
            tts.speak(aheadText, TextToSpeech.QUEUE_ADD, params, buildUtteranceId(i));
        }
    }

    /**
     * Xử lý khi bắt đầu đọc một câu văn (onStart callback từ TextToSpeech).
     */
    public synchronized void handleChunkStart(String utteranceId) {
        int index = parseChunkIndex(utteranceId);
        if (index >= 0) {
            currentChunkIndex = index;
            isPlaying = true;
            isPaused = false;

            if (listener != null) {
                listener.onChunkStart(index);
                listener.onPlaybackStateChange(true, false, false);
            }
        }
    }

    /**
     * Xử lý khi đọc đến từng từ cụ thể trong câu (onRangeStart callback thời gian thực).
     */
    public synchronized void handleRangeStart(String utteranceId, int start, int end) {
        int index = parseChunkIndex(utteranceId);
        if (index < 0 || index >= chunks.size()) {
            return;
        }
        String text = chunks.get(index);
        if (start < 0 || end > text.length() || start >= end) {
            return;
        }
        if (listener != null) {
            listener.onWordBoundary(index, start, end - start, text.substring(start, end));
        }
    }

    /**
     * Xử lý khi đọc xong một câu văn (onDone callback).
     */
    public synchronized void handleChunkDone(String utteranceId) {
        int index = parseChunkIndex(utteranceId);
        if (index < 0) {
            return;
        }
        if (listener != null) {
            listener.onChunkCompleted(index);
        }

        // Kiểm tra xem đã đọc hết toàn bộ chương sách chưa
        if (index < chunks.size() - 1) {
            return;
        }
        isPlaying = false;
        isPaused = false;
        if (listener != null) {
            listener.onAllCompleted();
            listener.onPlaybackStateChange(false, false, false);
        }
    }

    /**
     * Xử lý khi một câu đọc bị lỗi (onError callback). Tự động chuyển câu kế tiếp.
     */
    public synchronized void handleChunkError(String utteranceId, TextToSpeech tts, Bundle params) {
        int index = parseChunkIndex(utteranceId);
        if (index < 0) {
            return;
        }
        Log.w(TAG, "Chunk error on " + utteranceId + ", skipping to next chunk");
        if (listener != null) {
            listener.onChunkCompleted(index);
        }
        if (index < chunks.size() - 1 && isPlaying) {
            startSpeaking(tts, index + 1, params);
            return;
        }
        if (index >= chunks.size() - 1) {
            isPlaying = false;
            isPaused = false;
            if (listener != null) {
                listener.onAllCompleted();
                listener.onPlaybackStateChange(false, false, false);
            }
        }
    }

    public synchronized void notifyPaused() {
        isPlaying = false;
        isPaused = true;
        if (listener != null) {
            listener.onPlaybackStateChange(false, true, false);
        }
    }

    public synchronized void notifyResumed() {
        isPlaying = true;
        isPaused = false;
        if (listener != null) {
            listener.onPlaybackStateChange(true, false, false);
        }
    }

    public synchronized void notifyStopped() {
        isPlaying = false;
        isPaused = false;
        if (listener != null) {
            listener.onPlaybackStateChange(false, false, false);
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

    public int getTotalChunks() {
        return chunks.size();
    }

    public String getCurrentText() {
        if (currentChunkIndex >= 0 && currentChunkIndex < chunks.size()) {
            return chunks.get(currentChunkIndex);
        }
        return "";
    }
}
