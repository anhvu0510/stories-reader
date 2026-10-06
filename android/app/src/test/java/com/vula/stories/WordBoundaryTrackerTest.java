package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import com.vula.stories.player.WordBoundaryTracker;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

import java.util.List;

/**
 * Unit Test kiểm tra toàn diện bộ điều tiết WordBoundaryTracker.
 */
public class WordBoundaryTrackerTest {

    private WordBoundaryTracker tracker;
    private JSONArray sampleBoundaries;

    @Before
    public void setUp() throws Exception {
        tracker = new WordBoundaryTracker();
        sampleBoundaries = new JSONArray();

        // Từ 0: "Tiêu" (0.0s -> 0.3s)
        JSONObject w0 = new JSONObject();
        w0.put("text", "Tiêu");
        w0.put("charIndex", 0);
        w0.put("charLength", 4);
        w0.put("startSeconds", 0.0);
        sampleBoundaries.put(w0);

        // Từ 1: "Viêm" (0.35s -> 0.7s)
        JSONObject w1 = new JSONObject();
        w1.put("text", "Viêm");
        w1.put("charIndex", 5);
        w1.put("charLength", 4);
        w1.put("startSeconds", 0.35);
        sampleBoundaries.put(w1);

        // Từ 2: "mỉm" (0.75s -> 1.0s)
        JSONObject w2 = new JSONObject();
        w2.put("text", "mỉm");
        w2.put("charIndex", 10);
        w2.put("charLength", 3);
        w2.put("startSeconds", 0.75);
        sampleBoundaries.put(w2);

        // Từ 3: "cười" (1.05s -> 1.3s)
        JSONObject w3 = new JSONObject();
        w3.put("text", "cười");
        w3.put("charIndex", 14);
        w3.put("charLength", 4);
        w3.put("startSeconds", 1.05);
        sampleBoundaries.put(w3);
    }

    @Test
    public void testEarlyHighlight_taiMocBatDau_traVeTuDauTien() {
        JSONObject res = tracker.findNextBoundary(0, 1300, sampleBoundaries);
        assertNotNull(res);
        assertEquals("Tiêu", res.optString("text"));
        assertEquals(0, tracker.getLastWordBoundaryIndex());
    }

    @Test
    public void testPacingCatchUp_khiBuocNhayVuot_tienTungTuMot() {
        // Kích hoạt từ đầu tiên (index 0)
        tracker.findNextBoundary(0, 1300, sampleBoundaries);
        assertEquals(0, tracker.getLastWordBoundaryIndex());

        // Âm thanh nhảy vọt tới 1.1s (lẽ ra là từ "cười" ở index 3)
        JSONObject step1 = tracker.findNextBoundary(1100, 1300, sampleBoundaries);
        assertNotNull(step1);
        assertEquals("Viêm", step1.optString("text"));
        assertEquals(1, tracker.getLastWordBoundaryIndex());

        // Chu kỳ tiếp theo tiếp tục tiến tới index 2 ("mỉm")
        JSONObject step2 = tracker.findNextBoundary(1100, 1300, sampleBoundaries);
        assertNotNull(step2);
        assertEquals("mỉm", step2.optString("text"));
        assertEquals(2, tracker.getLastWordBoundaryIndex());

        // Chu kỳ tiếp theo đạt index 3 ("cười")
        JSONObject step3 = tracker.findNextBoundary(1100, 1300, sampleBoundaries);
        assertNotNull(step3);
        assertEquals("cười", step3.optString("text"));
        assertEquals(3, tracker.getLastWordBoundaryIndex());
    }

    @Test
    public void testTailProtection_khiSatDiemKetThuc_kichHoatTuCuoiCung() {
        // Đặt index đã qua từ 1
        tracker.setLastWordBoundaryIndex(1);

        // Vị trí ở 1250ms (trong 80ms cuối của 1300ms)
        JSONObject res = tracker.findNextBoundary(1250, 1300, sampleBoundaries);
        assertNotNull(res);
        // Do pacing catch-up, tiến từ index 1 lên index 2 trước
        assertEquals(2, tracker.getLastWordBoundaryIndex());

        // Tick kế tiếp đạt từ cuối cùng
        JSONObject resFinal = tracker.findNextBoundary(1250, 1300, sampleBoundaries);
        assertNotNull(resFinal);
        assertEquals("cười", resFinal.optString("text"));
        assertEquals(3, tracker.getLastWordBoundaryIndex());
    }

    @Test
    public void testDrainRemainingBoundaries_thuHoiCacTuChuaKichHoat() {
        tracker.setLastWordBoundaryIndex(1); // Mới phát xong "Viêm"

        List<JSONObject> remaining = tracker.drainRemainingBoundaries(sampleBoundaries);
        assertEquals(2, remaining.size());
        assertEquals("mỉm", remaining.get(0).optString("text"));
        assertEquals("cười", remaining.get(1).optString("text"));
        assertEquals(3, tracker.getLastWordBoundaryIndex());
    }

    @Test
    public void testReset_khoiPhucTrangThaiBanDau() {
        tracker.findNextBoundary(0, 1300, sampleBoundaries);
        assertEquals(0, tracker.getLastWordBoundaryIndex());

        tracker.reset();
        assertEquals(-1, tracker.getLastWordBoundaryIndex());
    }

    @Test
    public void testBoundariesRong_traVeNullAnToan() {
        assertNull(tracker.findNextBoundary(100, 500, null));
        assertNull(tracker.findNextBoundary(100, 500, new JSONArray()));
    }
}
