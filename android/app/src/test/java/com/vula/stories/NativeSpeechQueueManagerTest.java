package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.vula.stories.player.NativeSpeechQueueManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;

import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Unit Test kiểm thử luồng phát âm thanh trực tiếp qua hàng đợi native (Native Direct Speech Queue):
 * Theo chuẩn TDD (Tracer Bullet):
 * - Đảm bảo phân rã utteranceId chính xác thành chunkIndex.
 * - Kiểm tra sự kiện onRangeStart bắn chính xác vị trí từ trong câu thời gian thực (0ms latency).
 * - Đảm bảo chuyển giao trạng thái Play / Pause / Resume / Seek mượt mà.
 */
public class NativeSpeechQueueManagerTest {

    private static final class RecordingTts extends TextToSpeech {
        final List<String> ids = new ArrayList<>();
        final List<String> texts = new ArrayList<>();
        RecordingTts() { super(null, null); }
        @Override
        public int speak(CharSequence text, int mode, Bundle params, String id) {
            ids.add(id);
            texts.add(text.toString());
            return SUCCESS;
        }
    }

    @Test
    public void restoredReadingPositionStartsAtSavedWord() {
        RecordingTts tts = new RecordingTts();
        queueManager.setChunks(Arrays.asList("Một hai ba bốn"), 0);
        queueManager.startSpeaking(tts, 0, 8, null);
        assertEquals("ba bốn", tts.texts.get(0));
    }

    @Test
    public void resumeContinuesAtActiveWordAndKeepsOriginalBoundaryOffsets() {
        RecordingTts tts = new RecordingTts();
        queueManager.setChunks(Arrays.asList("Một hai ba bốn"), 0);
        queueManager.startSpeaking(tts, 0, null);
        queueManager.handleRangeStart(tts.ids.get(0), 8, 10);
        queueManager.notifyPaused();
        queueManager.resumeSpeaking(tts, null);
        assertEquals("ba bốn", tts.texts.get(1));
        queueManager.handleRangeStart(tts.ids.get(1), 3, 6);
        queueManager.notifyPaused();
        queueManager.resumeSpeaking(tts, null);
        assertEquals("bốn", tts.texts.get(2));
    }

    @Test
    public void pauseBetweenSentencesDoesNotReplayCompletedSentence() {
        RecordingTts tts = new RecordingTts();
        queueManager.setChunks(Arrays.asList("Một", "Hai"), 0);
        queueManager.startSpeaking(tts, 0, null);
        queueManager.handleChunkDone(tts.ids.get(0));
        queueManager.notifyPaused();
        queueManager.resumeSpeaking(tts, null);
        assertEquals("Hai", tts.texts.get(2));
    }

    @Test
    public void rollingQueueEnqueuesEachSentenceExactlyOnce() {
        RecordingTts tts = new RecordingTts();
        queueManager.setChunks(Arrays.asList("0", "1", "2", "3", "4", "5", "6", "7"), 0);
        queueManager.startSpeaking(tts, 0, null);
        queueManager.handleChunkStart(tts.ids.get(0));
        queueManager.maintainQueue(tts, null);
        queueManager.handleChunkStart(tts.ids.get(1));
        queueManager.maintainQueue(tts, null);
        List<Integer> indexes = new ArrayList<>();
        for (String id : tts.ids) indexes.add(NativeSpeechQueueManager.parseChunkIndex(id));
        assertEquals(Arrays.asList(0, 1, 2, 3, 4, 5, 6), indexes);
    }

    @Test
    public void seekRejectsCallbacksFromFlushedQueueIncludingSameSentence() {
        RecordingTts tts = new RecordingTts();
        queueManager.setChunks(chunks, 0);
        queueManager.startSpeaking(tts, 0, null);
        String oldId = tts.ids.get(0);
        queueManager.startSpeaking(tts, 1, null);
        String newId = tts.ids.get(3);
        queueManager.handleChunkStart(oldId);
        assertEquals(1, queueManager.getCurrentChunkIndex());
        queueManager.startSpeaking(tts, 0, null);
        queueManager.handleChunkStart(newId);
        assertEquals(0, queueManager.getCurrentChunkIndex());
        queueManager.notifyStopped();
        queueManager.handleChunkStart(tts.ids.get(tts.ids.size() - 1));
        assertFalse(queueManager.isPlaying());
    }

    @Test
    public void speechFailurePausesOnFailedSentenceInsteadOfSkippingIt() {
        RecordingTts tts = new RecordingTts();
        queueManager.setChunks(chunks, 0);
        queueManager.startSpeaking(tts, 0, null);
        queueManager.handleChunkError(tts.ids.get(0), tts, null);
        assertEquals(0, queueManager.getCurrentChunkIndex());
        assertTrue(queueManager.isPaused());
        assertEquals(3, tts.ids.size());
    }

    private NativeSpeechQueueManager queueManager;
    private List<String> chunks;

    @Before
    public void setUp() {
        queueManager = new NativeSpeechQueueManager();
        chunks = Arrays.asList(
                "Tiêu Viêm mỉm cười nói.",
                "Một buổi chiều tà, mặt trời ngả về tây.",
                "Hắn xoay người rời đi."
        );
    }

    /**
     * Tracer Bullet: Kiểm tra sinh utteranceId và giải mã chỉ số câu (chunkIndex).
     */
    @Test
    public void testUtteranceIdParsing_taoVaGiaiMaChinhXac() {
        String utteranceId = NativeSpeechQueueManager.buildUtteranceId(2);
        assertEquals("speech_chunk_2", utteranceId);

        int index = NativeSpeechQueueManager.parseChunkIndex(utteranceId);
        assertEquals(2, index);

        // Trường hợp utteranceId không hợp lệ
        int invalid = NativeSpeechQueueManager.parseChunkIndex("other_id_99");
        assertEquals(-1, invalid);
    }

    /**
     * Kiểm tra sự kiện onRangeStart ánh xạ chính xác vị trí ký tự và từ đang đọc trong câu.
     */
    @Test
    public void testOnRangeStart_anhXaChinhXacTuTheoThoiGianThuc() {
        queueManager.setChunks(chunks, 0);
        RecordingTts tts = new RecordingTts();
        queueManager.startSpeaking(tts, 0, null);

        final List<String> capturedWords = new ArrayList<>();
        final List<Integer> capturedIndices = new ArrayList<>();

        queueManager.setListener(new NativeSpeechQueueManager.SpeechStreamListener() {
            @Override
            public void onChunkStart(int chunkIndex) {}

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                capturedIndices.add(charIndex);
                capturedWords.add(text);
            }

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {}

            @Override
            public void onChunkCompleted(int chunkIndex) {}

            @Override
            public void onAllCompleted() {}
        });

        // Giả lập callback onRangeStart từ Android TextToSpeech engine khi phát từ "Tiêu" (start=0, end=4)
        queueManager.handleRangeStart(tts.ids.get(0), 0, 4);

        assertEquals(1, capturedWords.size());
        assertEquals("Tiêu", capturedWords.get(0));
        assertEquals(Integer.valueOf(0), capturedIndices.get(0));

        // Giả lập callback onRangeStart khi phát từ "Viêm" (start=5, end=9)
        queueManager.handleRangeStart(tts.ids.get(0), 5, 9);
        assertEquals(2, capturedWords.size());
        assertEquals("Viêm", capturedWords.get(1));
        assertEquals(Integer.valueOf(5), capturedIndices.get(1));
    }

    /**
     * Kiểm tra các chuyển đổi trạng thái Playback (Start -> Pause -> Resume -> Stop).
     */
    @Test
    public void testPlaybackStateTransitions_chuyenTrangThaiChinhXac() {
        queueManager.setChunks(chunks, 1);

        final List<Boolean> playStates = new ArrayList<>();
        final List<Boolean> pauseStates = new ArrayList<>();

        queueManager.setListener(new NativeSpeechQueueManager.SpeechStreamListener() {
            @Override
            public void onChunkStart(int chunkIndex) {}

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {}

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
                playStates.add(isPlaying);
                pauseStates.add(isPaused);
            }

            @Override
            public void onChunkCompleted(int chunkIndex) {}

            @Override
            public void onAllCompleted() {}
        });

        // Khi bắt đầu phát
        RecordingTts tts = new RecordingTts();
        queueManager.startSpeaking(tts, 1, null);
        queueManager.handleChunkStart(tts.ids.get(0));
        assertTrue(queueManager.isPlaying());
        assertFalse(queueManager.isPaused());
        assertEquals(1, queueManager.getCurrentChunkIndex());

        // Khi tạm dừng
        queueManager.notifyPaused();
        assertFalse(queueManager.isPlaying());
        assertTrue(queueManager.isPaused());

        // Khi tiếp tục
        queueManager.notifyResumed();
        assertTrue(queueManager.isPlaying());
        assertFalse(queueManager.isPaused());

        // Khi dừng hoàn toàn
        queueManager.notifyStopped();
        assertFalse(queueManager.isPlaying());
        assertFalse(queueManager.isPaused());
    }

    /**
     * Kiểm tra hoàn tất toàn bộ chương đọc (onAllCompleted).
     */
    @Test
    public void testChunkCompleted_hoanTatChuong() {
        queueManager.setChunks(chunks, 2);

        final boolean[] allCompletedFired = {false};

        queueManager.setListener(new NativeSpeechQueueManager.SpeechStreamListener() {
            @Override
            public void onChunkStart(int chunkIndex) {}

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {}

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {}

            @Override
            public void onChunkCompleted(int chunkIndex) {}

            @Override
            public void onAllCompleted() {
                allCompletedFired[0] = true;
            }
        });

        // Hoàn tất chunk cuối cùng (index 2)
        RecordingTts tts = new RecordingTts();
        queueManager.startSpeaking(tts, 2, null);
        queueManager.handleChunkDone(tts.ids.get(0));
        assertTrue("Khi câu cuối cùng đọc xong, phải kích hoạt onAllCompleted", allCompletedFired[0]);
    }
}
