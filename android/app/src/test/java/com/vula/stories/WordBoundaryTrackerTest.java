package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/**
 * Unit Test kiểm tra thuật toán định vị từ đang đọc (Word Boundary Tracker):
 * - Dựa trên mốc thời gian phát âm thanh hiện tại (currentPosition tính bằng giây)
 * - Quét nhị phân/tuyến tính trong danh sách mốc thời gian Microsoft WordBoundaries
 * - Tìm chính xác từ đang được phát âm để cập nhật hiệu ứng highlight trên giao diện.
 */
public class WordBoundaryTrackerTest {

    /**
     * Hàm helper mô phỏng thuật toán quét từ trong GaplessStreamPlayer.
     */
    public static JSONObject findActiveWordBoundary(JSONArray boundaries, double posSec) {
        if (boundaries == null || boundaries.length() == 0) return null;
        JSONObject activeWb = null;
        for (int i = 0; i < boundaries.length(); i++) {
            JSONObject wb = boundaries.optJSONObject(i);
            if (wb != null) {
                double startSec = wb.optDouble("startSeconds", 0);
                if (posSec >= startSec) {
                    activeWb = wb;
                } else {
                    break;
                }
            }
        }
        return activeWb;
    }

    @Test
    public void testFindActiveWordBoundary_dinhViChinhXacTuTheoThoiGian() throws Exception {
        JSONArray boundaries = new JSONArray();

        // Từ 1: "Tiêu" (0.0s -> 0.3s)
        JSONObject w1 = new JSONObject();
        w1.put("text", "Tiêu");
        w1.put("charIndex", 0);
        w1.put("startSeconds", 0.0);
        boundaries.put(w1);

        // Từ 2: "Viêm" (0.35s -> 0.7s)
        JSONObject w2 = new JSONObject();
        w2.put("text", "Viêm");
        w2.put("charIndex", 5);
        w2.put("startSeconds", 0.35);
        boundaries.put(w2);

        // Từ 3: "mỉm" (0.75s -> 1.0s)
        JSONObject w3 = new JSONObject();
        w3.put("text", "mỉm");
        w3.put("charIndex", 10);
        w3.put("startSeconds", 0.75);
        boundaries.put(w3);

        // Khi vị trí âm thanh ở 0.1s -> Từ đang phát là "Tiêu"
        JSONObject res1 = findActiveWordBoundary(boundaries, 0.1);
        assertNotNull(res1);
        assertEquals("Tiêu", res1.getString("text"));
        assertEquals(0, res1.getInt("charIndex"));

        // Khi vị trí âm thanh ở 0.5s -> Từ đang phát là "Viêm"
        JSONObject res2 = findActiveWordBoundary(boundaries, 0.5);
        assertNotNull(res2);
        assertEquals("Viêm", res2.getString("text"));
        assertEquals(5, res2.getInt("charIndex"));

        // Khi vị trí âm thanh ở 0.8s -> Từ đang phát là "mỉm"
        JSONObject res3 = findActiveWordBoundary(boundaries, 0.8);
        assertNotNull(res3);
        assertEquals("mỉm", res3.getString("text"));
        assertEquals(10, res3.getInt("charIndex"));
    }

    @Test
    public void testFindActiveWordBoundary_khiChuaToiMocDauTien_traVeNull() throws Exception {
        JSONArray boundaries = new JSONArray();
        JSONObject w1 = new JSONObject();
        w1.put("text", "Bắt");
        w1.put("startSeconds", 0.5);
        boundaries.put(w1);

        // Vị trí âm thanh ở 0.2s (chưa tới 0.5s)
        JSONObject res = findActiveWordBoundary(boundaries, 0.2);
        assertNull("Khi chưa tới thời điểm bắt đầu của từ đầu tiên, phải trả về null", res);
    }
}
