package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.vula.stories.tts.edge.EdgeAuth;

import org.junit.Test;

/**
 * Unit Test kiểm tra tính hợp lệ của cơ chế xác thực và đóng gói bản tin Edge TTS:
 * - Mã hóa ký tự đặc biệt cho SSML XML (escapeXml).
 * - Sinh dấu thời gian chuẩn ISO 8601 UTC.
 * - Cấu trúc URL WebSocket và token bản quyền của Microsoft Bing Edge.
 * - Khung định dạng SSML với giọng đọc tiếng Việt và tốc độ tùy chỉnh.
 */
public class EdgeAuthTest {

    @Test
    public void testEscapeXml_cacKyTuDacBiet() {
        // Bảo vệ XML không bị lỗi parse khi gặp các ký tự nhạy cảm XML
        assertEquals("", EdgeAuth.escapeXml(null));
        assertEquals("Text binh thuong", EdgeAuth.escapeXml("Text binh thuong"));

        String input = "Tiêu Viêm & Huân Nhi nói: <Xin chào> \"Bạn\" 'ơi'";
        String expected = "Tiêu Viêm &amp; Huân Nhi nói: &lt;Xin chào&gt; &quot;Bạn&quot; &apos;ơi&apos;";
        assertEquals(expected, EdgeAuth.escapeXml(input));
    }

    @Test
    public void testGetTimestampIso_dinhDangUtcChuan() {
        // Bing Edge yêu cầu timestamp định dạng ISO 8601 kết thúc bằng Z (UTC)
        String iso = EdgeAuth.getTimestampIso();
        assertNotNull(iso);
        assertTrue("Timestamp phải kết thúc bằng ký tự Z chỉ giờ UTC", iso.endsWith("Z"));
        assertTrue("Timestamp phải chứa ký tự T phân cách ngày và giờ", iso.contains("T"));
    }

    @Test
    public void testBuildWebSocketUrl_chuaCacThamSoChuanBingEdge() {
        // WebSocket URL phải trỏ đến endpoint Bing Edge và chứa TrustedClientToken
        String url = EdgeAuth.buildWebSocketUrl();
        assertNotNull(url);
        assertTrue("URL phải có giao thức wss://", url.startsWith("wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"));
        assertTrue("URL phải chứa TrustedClientToken", url.contains("TrustedClientToken=" + EdgeAuth.TRUSTED_CLIENT_TOKEN));
        assertTrue("URL phải chứa Sec-MS-GEC-Version", url.contains("Sec-MS-GEC-Version=" + EdgeAuth.SEC_MS_GEC_VERSION));
        assertTrue("URL phải chứa Sec-MS-GEC", url.contains("Sec-MS-GEC="));
    }

    @Test
    public void testBuildSpeechConfigMessage_chuaDungHeaderVaFormatMp3() {
        // Bản tin Speech Config mở đầu phiên kết nối
        String msg = EdgeAuth.buildSpeechConfigMessage();
        assertNotNull(msg);
        assertTrue("Bản tin phải có Path:speech.config", msg.contains("Path:speech.config"));
        assertTrue("Bản tin phải cấu hình định dạng audio MP3 24kHz", msg.contains("audio-24khz-48kbitrate-mono-mp3"));
    }

    @Test
    public void testBuildSsmlMessage_chuaDungThongSoVaDuocEscape() {
        String requestId = "req-123456";
        String voice = "vi-VN-HoaiMyNeural";
        String rate = "+20%";
        String pitch = "+0Hz";
        String rawText = "Chương 1: <Bắt đầu> cuộc hành trình & phiêu lưu";

        String ssml = EdgeAuth.buildSsmlMessage(requestId, voice, rate, pitch, rawText);
        assertNotNull(ssml);

        // Kiểm tra header SSML
        assertTrue("Bản tin phải có Path:ssml", ssml.contains("Path:ssml"));
        assertTrue("Bản tin phải chứa X-RequestId", ssml.contains("X-RequestId:" + requestId));

        // Kiểm tra nội dung XML SSML
        assertTrue("Phải gán đúng voice tiếng Việt", ssml.contains("name='" + voice + "'"));
        assertTrue("Phải gán đúng rate", ssml.contains("rate='" + rate + "'"));
        assertTrue("Phải gán đúng pitch", ssml.contains("pitch='" + pitch + "'"));

        // Nội dung văn bản phải được escape ký tự đặc biệt
        assertTrue("Ký tự < phải được escape thành &lt;", ssml.contains("&lt;Bắt đầu&gt;"));
        assertTrue("Ký tự & phải được escape thành &amp;", ssml.contains("&amp;"));
        assertFalse("Không được để lộ ký tự < thô trong thẻ", ssml.contains("<Bắt đầu>"));
    }
}
