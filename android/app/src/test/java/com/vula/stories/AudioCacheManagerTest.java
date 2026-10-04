package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.vula.stories.tts.edge.AudioCacheManager;

import org.junit.Test;

import java.io.File;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Unit Test kiểm tra cơ chế giải phóng bộ nhớ đệm (Sliding Window Eviction) của AudioCacheManager.
 * Đảm bảo các file âm thanh đã đọc qua quá xa sẽ bị loại bỏ để giải phóng dung lượng đĩa,
 * đồng thời luôn bảo toàn các câu đang đọc và câu đọc kế tiếp.
 */
public class AudioCacheManagerTest {

    @Test
    public void testHangSoCauHinhBuffer() {
        // Kiểm tra các hằng số cửa sổ trượt: luôn gối đầu 10 câu và không giữ câu quá khứ
        assertEquals("Số lượng câu nạp trước (lookahead) phải là 10 câu", 10, AudioCacheManager.BUFFER_LOOKAHEAD);
        assertEquals("Số lượng câu đã đọc trong quá khứ được giữ lại phải là 0 câu", 0, AudioCacheManager.MAX_PAST_CHUNKS_RETAINED);
        assertEquals("Giới hạn tối đa số file cache trên đĩa là 25 file", 25, AudioCacheManager.MAX_TOTAL_CACHE_FILES);
    }

    @Test
    public void testEvictOldChunks_xoaDungCacCauCuNgoaiCuaSoTruot() {
        // Giả lập một danh sách các câu đã nạp trong bộ nhớ đệm
        ConcurrentHashMap<Integer, File> readyAudioFiles = new ConcurrentHashMap<>();
        for (int i = 0; i <= 15; i++) {
            // Tạo đối tượng File giả lập (không cần tồn tại trên đĩa vật lý)
            readyAudioFiles.put(i, new File("/fake/cache/chunk_" + i + ".mp3"));
        }

        AudioCacheManager cacheManager = new AudioCacheManager(null);

        // Giả sử người đọc đang đọc đến câu thứ 10
        // Ngưỡng lưu giữ: thresholdIndex = 10 - 0 = 10
        // Các câu < 10 (từ 0 đến 9) phải bị dọn dẹp để câu 10 là câu đầu tiên của cache
        // Các câu >= 10 (từ 10 đến 15) phải được bảo toàn
        cacheManager.evictOldChunks(10, readyAudioFiles, null, null);

        // Kiểm tra các câu quá khứ đã bị xóa sạch hoàn toàn
        for (int i = 0; i < 10; i++) {
            assertFalse("Câu quá khứ " + i + " phải bị loại bỏ để câu hiện tại luôn là câu đầu tiên trong cache", readyAudioFiles.containsKey(i));
        }

        // Kiểm tra câu hiện tại (10) và các câu tương lai được bảo toàn tuyệt đối
        assertTrue("Câu hiện tại (10) phải luôn là câu đầu tiên trong cache", readyAudioFiles.containsKey(10));
        assertTrue("Câu tiếp theo (11) phải luôn được giữ lại", readyAudioFiles.containsKey(11));
        assertTrue("Câu 15 trong tương lai phải được giữ lại", readyAudioFiles.containsKey(15));
    }

    @Test
    public void testEvictOldChunks_khiDangODauChuong_khongXoaNham() {
        ConcurrentHashMap<Integer, File> readyAudioFiles = new ConcurrentHashMap<>();
        for (int i = 0; i <= 5; i++) {
            readyAudioFiles.put(i, new File("/fake/cache/chunk_" + i + ".mp3"));
        }

        AudioCacheManager cacheManager = new AudioCacheManager(null);

        // Đang ở câu đầu chương (index = 0)
        // thresholdIndex = 0 -> Không có câu nào bị xóa
        cacheManager.evictOldChunks(0, readyAudioFiles, null, null);

        assertEquals("Toàn bộ 6 câu đầu chương phải được giữ nguyên khi đang đọc câu 0", 6, readyAudioFiles.size());

        // Khi chuyển sang đọc câu 1
        // Câu 0 bị xóa ngay lập tức, câu 1 trở thành câu đầu tiên của cache
        cacheManager.evictOldChunks(1, readyAudioFiles, null, null);
        assertFalse("Câu 0 phải bị xóa khi đang đọc câu 1", readyAudioFiles.containsKey(0));
        assertTrue("Câu 1 phải là câu đầu tiên của cache", readyAudioFiles.containsKey(1));
        assertEquals("Số file cache còn lại là 5 câu (1..5)", 5, readyAudioFiles.size());
    }
}
