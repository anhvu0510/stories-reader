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

    /**
     * Kiểm tra hàm tokenize tách đúng từ ngữ âm và định vị chuẩn xác ký tự đầu/cuối,
     * loại bỏ hoàn toàn dấu ngoặc kép, dấu chấm, dấu phẩy dính vào từ.
     */
    @Test
    public void testNativeWordBoundaryEstimator_tokenize_loaiBoDauCauVaGiuDungOffset() {
        String input = "“Chào bạn!”";
        java.util.List<com.vula.stories.tts.NativeWordBoundaryEstimator.WordToken> tokens =
                com.vula.stories.tts.NativeWordBoundaryEstimator.tokenize(input);

        assertEquals("Phải tách đúng 2 từ sạch", 2, tokens.size());

        // Từ 1: "Chào" bắt đầu ở index 1 (bỏ qua dấu mở ngoặc “)
        assertEquals("Chào", tokens.get(0).text);
        assertEquals(1, tokens.get(0).charIndex);
        assertEquals(4, tokens.get(0).charLength);

        // Từ 2: "bạn" bắt đầu ở index 6 (bỏ qua dấu khoảng trắng)
        assertEquals("bạn", tokens.get(1).text);
        assertEquals(6, tokens.get(1).charIndex);
        assertEquals(3, tokens.get(1).charLength);
    }

    /**
     * Kiểm tra thuật toán estimateBoundaries luôn trừ hao khoảng lặng đầu file (leading silence),
     * đảm bảo từ đầu tiên không bao giờ bắt đầu lúc 0.0s để loa kịp phát âm thanh trước khi highlight.
     */
    @Test
    public void testNativeWordBoundaryEstimator_khoangLangDauFileTranhNhayChuTruocVoice() throws Exception {
        String text = "Tiêu Viêm mỉm cười nói.";
        JSONArray boundaries = com.vula.stories.tts.NativeWordBoundaryEstimator.estimateBoundaries(0, text, null);

        assertNotNull("Danh sách boundaries không được null", boundaries);
        assertEquals(5, boundaries.length());

        JSONObject firstWord = boundaries.getJSONObject(0);
        assertEquals("Tiêu", firstWord.getString("text"));
        double startSec = firstWord.getDouble("startSeconds");
        org.junit.Assert.assertTrue("Từ đầu tiên phải bắt đầu sau khoảng lặng leading silence >= 0.1s", startSec >= 0.10);
    }

    /**
     * Kiểm tra các dấu câu (dấu phẩy, dấu chấm) tạo ra khoảng nghỉ thực tế giữa các từ,
     * ngăn chặn hiện tượng trôi lệch tích lũy (timing drift) khiến chữ chạy trước tiếng.
     */
    @Test
    public void testNativeWordBoundaryEstimator_khoangNghiDauPhayGiuaCacTu() throws Exception {
        String text = "Một buổi chiều tà, mặt trời ngả về tây.";
        JSONArray boundaries = com.vula.stories.tts.NativeWordBoundaryEstimator.estimateBoundaries(0, text, null);

        assertNotNull(boundaries);
        assertEquals(9, boundaries.length());

        // Từ thứ 4 là "tà" (trước dấu phẩy)
        JSONObject wordTa = boundaries.getJSONObject(3);
        assertEquals("tà", wordTa.getString("text"));
        double endTa = wordTa.getDouble("endSeconds");

        // Từ thứ 5 là "mặt" (sau dấu phẩy)
        JSONObject wordMat = boundaries.getJSONObject(4);
        assertEquals("mặt", wordMat.getString("text"));
        double startMat = wordMat.getDouble("startSeconds");

        // Phải có khoảng dừng nghỉ dấu phẩy giữa từ "tà" và "mặt" (startMat > endTa)
        org.junit.Assert.assertTrue("Phải có khoảng nghỉ dấu phẩy giữa hai vế câu", startMat > endTa);
        double pause = startMat - endTa;
        org.junit.Assert.assertTrue("Khoảng nghỉ dấu phẩy phải ít nhất 0.05s", pause >= 0.05);
    }

    /**
     * Kiểm tra mô hình âm học tiếng Việt phân bổ thời lượng tối thiểu hợp lý,
     * không để từ ngắn (1 ký tự như 'ở', 'và') bị co dưới MIN_WORD_DURATION_SEC gây giật chữ.
     */
    @Test
    public void testNativeWordBoundaryEstimator_thoiLuongToiThieuChoAmTietTiengViet() throws Exception {
        String text = "Hắn ở đó và đi ra.";
        JSONArray boundaries = com.vula.stories.tts.NativeWordBoundaryEstimator.estimateBoundaries(0, text, null);

        for (int i = 0; i < boundaries.length(); i++) {
            JSONObject wb = boundaries.getJSONObject(i);
            double dur = wb.getDouble("endSeconds") - wb.getDouble("startSeconds");
            org.junit.Assert.assertTrue("Mỗi từ tiếng Việt phải có thời lượng đọc tối thiểu >= 0.12s", dur >= 0.12);
        }
    }
}
