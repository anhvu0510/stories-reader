package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.vula.stories.logging.RemoteLogger;

import org.junit.Test;

/**
 * Unit Test kiểm tra tính năng rút gọn log telemetry của RemoteLogger.
 * Đảm bảo không bao giờ gửi toàn bộ nội dung câu dài lên server để bảo mật và tiết kiệm băng thông.
 */
public class RemoteLoggerTest {

    @Test
    public void testFormatSnippet_voiChuoiNullVaRong() {
        // Trường hợp chuỗi null hoặc rỗng, phải trả về chuỗi rỗng an toàn, không ném NullPointerException
        assertEquals("", RemoteLogger.formatSnippet(null));
        assertEquals("", RemoteLogger.formatSnippet(""));
        assertEquals("", RemoteLogger.formatSnippet("   "));
    }

    @Test
    public void testFormatSnippet_voiCauNgan_giuNguyenNoiDung() {
        // Câu ngắn <= 35 ký tự thì giữ nguyên để tiện theo dõi ngữ cảnh
        String shortText = "Hôm nay trời rất đẹp.";
        assertEquals(shortText, RemoteLogger.formatSnippet(shortText));

        String boundaryText = "12345678901234567890123456789012345"; // đúng 35 ký tự
        assertEquals(boundaryText, RemoteLogger.formatSnippet(boundaryText));
    }

    @Test
    public void testFormatSnippet_voiCauDai_rutGonDauVaCuoi() {
        // Câu dài > 35 ký tự phải được cắt gọn thành: [16 ký tự đầu]...[12 ký tự cuối]
        String longText = "Tiêu Viêm thở dài một hơi thật sâu rồi chậm rãi nhắm mắt lại.";
        String snippet = RemoteLogger.formatSnippet(longText);

        assertNotNull(snippet);
        assertTrue("Snippet phải chứa dấu ... phân cách", snippet.contains("..."));
        assertTrue("Độ dài sau khi rút gọn phải ngắn hơn văn bản gốc", snippet.length() < longText.length());
        assertTrue("Phải giữ lại 16 ký tự đầu", snippet.startsWith("Tiêu Viêm thở d"));
        assertTrue("Phải giữ lại 12 ký tự cuối", snippet.endsWith("hắm mắt lại."));
    }

    @Test
    public void testFormatSnippet_baoToanUnicodeTiengVietCoDau() {
        // Kiểm tra xử lý ký tự tiếng Việt có dấu thanh điệu UTF-8 không bị vỡ ký tự
        String vietnameseText = "Vạn Cổ Đệ Nhất Thần Tông - Chương 1024: Đỉnh cao quyết chiến nơi hoang mạc";
        String snippet = RemoteLogger.formatSnippet(vietnameseText);

        assertTrue("Snippet không được rỗng", snippet.length() > 0);
        assertTrue("Snippet phải có dấu ...", snippet.contains("..."));
        assertFalse("Không được chứa toàn bộ chuỗi dài", snippet.equals(vietnameseText));
    }
}
