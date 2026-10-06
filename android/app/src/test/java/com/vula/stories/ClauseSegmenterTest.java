package com.vula.stories;

import com.vula.stories.tts.edge.segment.ClauseSegment;
import com.vula.stories.tts.edge.segment.ClauseSegmenter;

import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

public class ClauseSegmenterTest {

    @Test
    public void testEmptyOrNullText() {
        List<ClauseSegment> result1 = ClauseSegmenter.segment(0, "");
        assertNotNull(result1);
        assertTrue(result1.isEmpty());

        List<ClauseSegment> result2 = ClauseSegmenter.segment(0, null);
        assertNotNull(result2);
        assertTrue(result2.isEmpty());
    }

    @Test
    public void testShortSentenceNotSplit() {
        String shortText = "Hắn khẽ mỉm cười gật đầu.";
        List<ClauseSegment> segments = ClauseSegmenter.segment(3, shortText);

        assertEquals(1, segments.size());
        ClauseSegment seg = segments.get(0);
        assertEquals(3, seg.parentChunkIndex);
        assertEquals(0, seg.segmentIndex);
        assertEquals(shortText, seg.text);
        assertEquals(0, seg.startOffset);
        assertEquals(shortText.length(), seg.endOffset);
        assertTrue(seg.isFirst);
        assertTrue(seg.isLast);
    }

    @Test
    public void testLongSentenceSplitAtComma() {
        String longText = "Hắn khẽ thở dài một tiếng, ánh mắt nhìn về phía chân trời xa xăm nơi những đám mây đen đang dần kéo tới bao phủ bầu trời u tối.";
        List<ClauseSegment> segments = ClauseSegmenter.segment(1, longText);

        assertTrue("Phải chia thành ít nhất 2 phân đoạn", segments.size() >= 2);

        ClauseSegment first = segments.get(0);
        assertTrue("Segment đầu tiên phải có cờ isFirst", first.isFirst);
        assertFalse("Segment đầu tiên không phải isLast", first.isLast);
        assertTrue("Segment đầu tiên phải kết thúc bằng dấu phẩy", first.text.endsWith(","));
        assertEquals(0, first.startOffset);

        ClauseSegment last = segments.get(segments.size() - 1);
        assertTrue("Segment cuối phải có cờ isLast", last.isLast);
        assertFalse("Segment cuối không có cờ isFirst", last.isFirst);
        assertEquals(longText.length(), last.endOffset);

        // Kiểm tra tính liên tục của các offset
        for (int i = 0; i < segments.size() - 1; i++) {
            assertEquals("Offset phải liên tục không gián đoạn",
                    segments.get(i).endOffset, segments.get(i + 1).startOffset);
        }
    }

    @Test
    public void testSplitAtConjunctionWhenNoPunctuation() {
        String text = "Hắn biết rõ chuyến đi lần này vô cùng nguy hiểm nhưng trong lòng vẫn không hề có nửa phần do dự hay lùi bước trước hiểm nguy.";
        List<ClauseSegment> segments = ClauseSegmenter.segment(0, text);

        assertTrue("Phải chia thành ít nhất 2 phân đoạn", segments.size() >= 2);
        ClauseSegment first = segments.get(0);
        assertTrue("Segment đầu phải cắt trước liên từ 'nhưng'", first.text.trim().endsWith("nguy hiểm"));
    }

    @Test
    public void testSplitAtWordBoundaryWhenNoPunctuationOrConjunction() {
        String longNoPunc = "Một chuỗi văn bản dài liên tục không có bất kỳ dấu câu nào được viết ra để kiểm tra tính năng ngắt nhịp theo khoảng trắng an toàn của hệ thống.";
        List<ClauseSegment> segments = ClauseSegmenter.segment(0, longNoPunc);

        assertTrue("Phải chia thành ít nhất 2 phân đoạn", segments.size() >= 2);
        for (ClauseSegment seg : segments) {
            assertFalse("Không được có khoảng trắng thừa ở đầu nếu không phải phân đoạn đầu",
                    seg.segmentIndex > 0 && seg.text.startsWith(" "));
        }
    }
}
