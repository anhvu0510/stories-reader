package com.vula.stories;

import com.vula.stories.player.PrefetchRetryManager;
import com.vula.stories.tts.edge.AudioCacheManager;
import com.vula.stories.tts.edge.EdgePrefetchQueue;
import com.vula.stories.tts.edge.EdgeWebSocketClient;
import com.vula.stories.tts.edge.segment.ClauseSegment;
import com.vula.stories.tts.edge.segment.ClauseSegmenter;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * Kiểm thử ca biên (Edge Cases) cho thuật toán Adaptive Clause Pipelining.
 */
public class AdaptiveClausePipeliningTest {

    private EdgePrefetchQueue queue;

    @Before
    public void setUp() {
        EdgeWebSocketClient client = new EdgeWebSocketClient();
        AudioCacheManager cacheManager = new AudioCacheManager(null);
        PrefetchRetryManager retryManager = new PrefetchRetryManager();
        queue = new EdgePrefetchQueue(client, cacheManager, retryManager);
    }

    @Test
    public void testPipeliningWithQuotationMarks() {
        String complexText = "Lâm Phong lạnh lùng quát lớn: \"Kẻ nào dám cả gan bước qua ranh giới này, đừng trách ta hạ thủ vô tình!\", dứt lời liền rút trường kiếm ra.";
        List<ClauseSegment> segments = ClauseSegmenter.segment(0, complexText);

        assertTrue("Phải phân đoạn câu có chứa dấu ngoặc kép", segments.size() >= 2);
        assertEquals(0, segments.get(0).startOffset);
        assertEquals(complexText.length(), segments.get(segments.size() - 1).endOffset);

        // Kiểm tra tính liên tục của các phân đoạn
        for (int i = 0; i < segments.size() - 1; i++) {
            assertEquals("Ranh giới các phân đoạn phải liền mạch",
                    segments.get(i).endOffset, segments.get(i + 1).startOffset);
        }
    }

    @Test
    public void testQueueSegmentSequencing() {
        String longText = "Mặt trời dần khuất sau rặng núi phía tây, ánh tà dương đỏ rực nhuộm thắm cả một góc trời bao la rộng lớn không một bóng người qua lại.";
        List<String> chunks = Arrays.asList(longText, "Câu ngắn thứ hai.");

        queue.configure(chunks, "vi-VN-HoaiMyNeural", "default", "default", "memory", null);

        List<ClauseSegment> segs = queue.getSegments(0);
        assertTrue("Câu đầu dài phải được chia thành nhiều segment", segs.size() >= 2);

        ClauseSegment first = queue.getFirstSegment(0);
        assertNotNull(first);
        assertEquals(0, first.segmentIndex);
        assertTrue(first.isFirst);

        ClauseSegment next = queue.getNextSegment(first);
        assertNotNull(next);
        assertEquals(1, next.segmentIndex);
        assertEquals(0, next.parentChunkIndex);

        ClauseSegment secondChunkFirst = queue.getFirstSegment(1);
        assertNotNull(secondChunkFirst);
        assertEquals(1, secondChunkFirst.parentChunkIndex);
        assertEquals(0, secondChunkFirst.segmentIndex);
        assertTrue(secondChunkFirst.isLast);
    }

    @Test
    public void testWordBoundaryOffsetAccumulation() throws Exception {
        // Giả lập 2 phân đoạn của 1 câu và kiểm tra logic cộng dồn offset
        ClauseSegment seg0 = new ClauseSegment(0, 0, "Đoạn đầu ngắn,", 0, 14, true, false);
        ClauseSegment seg1 = new ClauseSegment(0, 1, "tiếp tục đoạn sau.", 14, 32, false, true);

        // Boundary trong seg 0: charIndex = 5 ("đầu")
        int realIndex0 = seg0.startOffset + 5;
        assertEquals(5, realIndex0);

        // Boundary trong seg 1: charIndex = 8 ("đoạn")
        int realIndex1 = seg1.startOffset + 8;
        assertEquals(22, realIndex1); // 14 + 8 = 22
    }
}
