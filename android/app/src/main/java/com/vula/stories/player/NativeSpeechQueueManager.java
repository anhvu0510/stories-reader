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
        default void onChunkError(int chunkIndex, String message) {}
    }

    private final List<String> chunks = new ArrayList<>();
    private SpeechStreamListener listener = null;
    private int currentChunkIndex = 0;
    private volatile boolean isPlaying = false;
    private volatile boolean isPaused = false;
    private long generation = 0;
    private int lastQueuedIndex = -1;
    private int spokenOffset;
    private int resumedChunkIndex = -1;
    private int resumedOffset;

    public NativeSpeechQueueManager() {}

    public synchronized void setListener(SpeechStreamListener listener) {
        this.listener = listener;
    }

    /**
     * Thiết lập danh sách các câu cần đọc và vị trí câu bắt đầu.
     */
    public synchronized void setChunks(List<String> newChunks, int startIndex) {
        generation += 1;
        this.chunks.clear();
        if (newChunks != null) {
            this.chunks.addAll(newChunks);
        }
        this.currentChunkIndex = Math.max(0, Math.min(startIndex, Math.max(0, this.chunks.size() - 1)));
        spokenOffset = 0;
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
        if (utteranceId == null || !utteranceId.startsWith(UTTERANCE_PREFIX)) return -1;
        try {
            String index = utteranceId.substring(UTTERANCE_PREFIX.length()).split("_g", 2)[0];
            return Integer.parseInt(index);
        } catch (NumberFormatException error) {
            Log.w(TAG, "Invalid speech utterance id: " + utteranceId);
            return -1;
        }
    }

    private String activeUtteranceId(int index) {
        return buildUtteranceId(index) + "_g" + generation;
    }

    private int activeChunkIndex(String id) {
        int index = parseChunkIndex(id);
        if (!isPlaying || index < 0 || index >= chunks.size()) return -1;
        return activeUtteranceId(index).equals(id) ? index : -1;
    }

    /**
     * Nạp các câu văn vào hàng đợi Android TextToSpeech:
     * - Câu đầu tiên sử dụng QUEUE_FLUSH để ngắt câu cũ và phát ngay lập tức.
     * - Các câu tiếp theo trong phạm vi lookahead sử dụng QUEUE_ADD để gối đầu gapless.
     */
    public synchronized void startSpeaking(TextToSpeech tts, int startIndex, Bundle params) {
        startSpeakingFrom(tts, startIndex, 0, params);
    }

    public synchronized void startSpeaking(TextToSpeech tts, int startIndex, int offset, Bundle params) {
        startSpeakingFrom(tts, startIndex, offset, params);
    }

    public synchronized void resumeSpeaking(TextToSpeech tts, Bundle params) {
        if (!isPaused) return;
        startSpeakingFrom(tts, currentChunkIndex, spokenOffset, params);
    }

    private void startSpeakingFrom(TextToSpeech tts, int startIndex, int offset, Bundle params) {
        if (tts == null || chunks.isEmpty()) return;

        int validStart = Math.max(0, Math.min(startIndex, chunks.size() - 1));
        generation += 1;
        currentChunkIndex = validStart;
        spokenOffset = Math.max(0, Math.min(offset, chunks.get(validStart).length()));
        resumedChunkIndex = validStart;
        resumedOffset = spokenOffset;
        isPlaying = true;
        isPaused = false;

        // Phát câu khởi đầu (QUEUE_FLUSH)
        String firstText = chunks.get(validStart).substring(spokenOffset);
        lastQueuedIndex = validStart;
        int result = tts.speak(firstText, TextToSpeech.QUEUE_FLUSH, params, activeUtteranceId(validStart));
        if (result != TextToSpeech.SUCCESS) {
            handleChunkError(activeUtteranceId(validStart), tts, params);
            return;
        }
        maintainQueue(tts, params);
        if (!isPlaying) return;

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
        for (int i = lastQueuedIndex + 1; i <= targetLookahead; i++) {
            String aheadText = chunks.get(i);
            int result = tts.speak(aheadText, TextToSpeech.QUEUE_ADD, params, activeUtteranceId(i));
            if (result != TextToSpeech.SUCCESS) {
                handleChunkError(activeUtteranceId(i), tts, params);
                return;
            }
            lastQueuedIndex = i;
        }
    }

    /**
     * Xử lý khi bắt đầu đọc một câu văn (onStart callback từ TextToSpeech).
     */
    public synchronized void handleChunkStart(String utteranceId) {
        int index = activeChunkIndex(utteranceId);
        if (index < currentChunkIndex || index < 0) return;
        if (index != currentChunkIndex) spokenOffset = 0;
        currentChunkIndex = index;
        if (listener != null) {
            listener.onChunkStart(index);
            listener.onPlaybackStateChange(true, false, false);
        }
    }

    /**
     * Xử lý khi đọc đến từng từ cụ thể trong câu (onRangeStart callback thời gian thực).
     */
    public synchronized void handleRangeStart(String utteranceId, int start, int end) {
        int index = activeChunkIndex(utteranceId);
        if (index < 0 || index != currentChunkIndex) {
            return;
        }
        String text = chunks.get(index);
        int baseOffset = index == resumedChunkIndex ? resumedOffset : 0;
        start += baseOffset;
        end += baseOffset;
        if (start < 0 || end > text.length() || start >= end) {
            return;
        }
        spokenOffset = start;
        if (listener != null) {
            listener.onWordBoundary(index, start, end - start, text.substring(start, end));
        }
    }

    /**
     * Xử lý khi đọc xong một câu văn (onDone callback).
     */
    public synchronized void handleChunkDone(String utteranceId) {
        int index = activeChunkIndex(utteranceId);
        if (index < 0 || index != currentChunkIndex) {
            return;
        }
        if (listener != null) {
            listener.onWordBoundary(index, chunks.get(index).length(), 0, "");
            listener.onChunkCompleted(index);
        }

        // Kiểm tra xem đã đọc hết toàn bộ chương sách chưa
        if (index < chunks.size() - 1) {
            currentChunkIndex = index + 1;
            spokenOffset = 0;
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
     * Preserve the failed sentence so resume retries it; never report it as read.
     */
    public synchronized void handleChunkError(String utteranceId, TextToSpeech tts, Bundle params) {
        int index = activeChunkIndex(utteranceId);
        if (index < 0) return;
        Log.e(TAG, "Speech failed at sentence " + index);
        currentChunkIndex = Math.min(currentChunkIndex, index);
        notifyPaused();
        if (tts != null) tts.stop();
        if (listener != null) listener.onChunkError(index, "Device speech failed at sentence " + index);
    }

    public synchronized void notifyPaused() {
        generation += 1;
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
        generation += 1;
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
