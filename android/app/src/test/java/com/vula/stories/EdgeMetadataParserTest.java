package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.vula.stories.tts.edge.EdgeMetadataParser;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.List;

/**
 * Unit Test kiểm tra bộ phân tích cú pháp siêu dữ liệu EdgeMetadataParser.
 */
public class EdgeMetadataParserTest {

    @Test
    public void testNhanDienKhungTinHeaders() {
        String metaFrame = "X-RequestId:123\r\nPath:audio.metadata\r\n\r\n{}";
        assertTrue(EdgeMetadataParser.isMetadataFrame(metaFrame));
        assertFalse(EdgeMetadataParser.isTurnEnd(metaFrame));

        String turnStart = "Path:turn.start\r\n\r\n";
        assertTrue(EdgeMetadataParser.isTurnStart(turnStart));

        String turnEnd = "Path:turn.end\r\n\r\n";
        assertTrue(EdgeMetadataParser.isTurnEnd(turnEnd));

        String response = "Path:response\r\n\r\n";
        assertTrue(EdgeMetadataParser.isResponse(response));
    }

    @Test
    public void testParseWordBoundaries_bocTachTuTiengVietChinhXac() {
        String rawMsg = "X-RequestId:abc\r\nPath:audio.metadata\r\nContent-Type:application/json\r\n\r\n"
                + "{\"Metadata\":["
                + "{\"Type\":\"WordBoundary\",\"Data\":{\"Offset\":1000000,\"Duration\":2500000,\"text\":{\"Text\":\"Tiêu\"}}},"
                + "{\"Type\":\"WordBoundary\",\"Data\":{\"Offset\":3600000,\"Duration\":3000000,\"text\":{\"Text\":\"Viêm\"}}}"
                + "]}";

        String sourceText = "tiêu viêm mỉm cười";
        int[] searchOffset = {0};

        List<JSONObject> results = EdgeMetadataParser.parseWordBoundaries(rawMsg, sourceText, searchOffset);
        assertEquals(2, results.size());

        JSONObject w1 = results.get(0);
        assertEquals("Tiêu", w1.optString("text"));
        assertEquals(0, w1.optInt("charIndex"));
        assertEquals(4, w1.optInt("charLength"));
        assertEquals(0.1, w1.optDouble("startSeconds"), 0.001);
        assertEquals(0.35, w1.optDouble("endSeconds"), 0.001);

        JSONObject w2 = results.get(1);
        assertEquals("Viêm", w2.optString("text"));
        assertEquals(5, w2.optInt("charIndex"));
        assertEquals(4, w2.optInt("charLength"));

        // Sau khi parse 2 từ, searchOffset phải trôi đến vị trí 9
        assertEquals(9, searchOffset[0]);
    }

    @Test
    public void testParseWordBoundaries_tuCoDauCauBaoQuanh_khopChinhXac() {
        String rawMsg = "Path:audio.metadata\r\n\r\n"
                + "{\"Metadata\":["
                + "{\"Type\":\"WordBoundary\",\"Data\":{\"Offset\":0,\"Duration\":2000000,\"text\":{\"Text\":\"\\\"Xin\"}}},"
                + "{\"Type\":\"WordBoundary\",\"Data\":{\"Offset\":2100000,\"Duration\":2000000,\"text\":{\"Text\":\"chào!\\\"\"}}}"
                + "]}";

        String sourceText = "\"xin chào!\"";
        int[] searchOffset = {0};

        List<JSONObject> results = EdgeMetadataParser.parseWordBoundaries(rawMsg, sourceText, searchOffset);
        assertEquals(2, results.size());

        // Từ thứ nhất có dấu ngoặc kép phía trước
        assertEquals("\"Xin", results.get(0).optString("text"));
        assertEquals(0, results.get(0).optInt("charIndex"));

        // Từ thứ hai có dấu chấm than và ngoặc kép phía sau
        assertEquals("chào!\"", results.get(1).optString("text"));
        assertEquals(5, results.get(1).optInt("charIndex"));
    }

    @Test
    public void testParseWordBoundaries_duLieuLoiHoacRong_traVeRongAnToan() {
        int[] searchOffset = {0};
        // Payload không chứa delimiter \r\n\r\n
        List<JSONObject> r1 = EdgeMetadataParser.parseWordBoundaries("Path:audio.metadata", "nguồn", searchOffset);
        assertTrue(r1.isEmpty());

        // JSON rác
        List<JSONObject> r2 = EdgeMetadataParser.parseWordBoundaries("Path:audio.metadata\r\n\r\n{invalid_json}", "nguồn", searchOffset);
        assertTrue(r2.isEmpty());

        // Source text null
        List<JSONObject> r3 = EdgeMetadataParser.parseWordBoundaries("Path:audio.metadata\r\n\r\n{}", null, searchOffset);
        assertTrue(r3.isEmpty());
    }

    @Test
    public void testAppendWordBoundaries_themVaoJSONArray() {
        String rawMsg = "Path:audio.metadata\r\n\r\n"
                + "{\"Metadata\":["
                + "{\"Type\":\"WordBoundary\",\"Data\":{\"Offset\":0,\"Duration\":1000000,\"text\":{\"Text\":\"Đọc\"}}}"
                + "]}";

        JSONArray target = new JSONArray();
        int[] searchOffset = {0};

        EdgeMetadataParser.appendWordBoundaries(rawMsg, "đọc truyện", searchOffset, target);
        assertEquals(1, target.length());
        assertEquals("Đọc", target.optJSONObject(0).optString("text"));
    }
}
