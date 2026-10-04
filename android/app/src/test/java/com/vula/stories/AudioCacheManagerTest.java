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
        // Kiểm tra các hằng số cửa sổ trượt tối ưu cho trải nghiệm gapless 0ms
        assertEquals("Số lượng câu nạp trước (lookahead) phải là 6 câu", 6, AudioCacheManager.BUFFER_LOOKAHEAD);
        assertEquals("Số lượng câu đã đọc trong quá khứ được giữ lại phải là 3 câu", 3, AudioCacheManager.MAX_PAST_CHUNKS_RETAINED);
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
        // Ngưỡng lưu giữ: thresholdIndex = 10 - 3 = 7
        // Các câu < 7 (từ 0 đến 6) phải bị dọn dẹp
        // Các câu >= 7 (từ 7 đến 15) phải được bảo toàn
        cacheManager.evictOldChunks(10, readyAudioFiles, null, null);

        // Kiểm tra các câu cũ đã bị xóa
        for (int i = 0; i < 7; i++) {
            assertFalse("Câu " + i + " nằm ngoài cửa sổ trượt quá khứ phải bị loại bỏ", readyAudioFiles.containsKey(i));
        }

        // Kiểm tra câu hiện tại (10) và các câu lân cận vẫn được bảo toàn tuyệt đối
        assertTrue("Câu 7 (giáp ranh quá khứ) phải được giữ lại", readyAudioFiles.containsKey(7));
        assertTrue("Câu 8 phải được giữ lại", readyAudioFiles.containsKey(8));
        assertTrue("Câu 9 phải được giữ lại", readyAudioFiles.containsKey(9));
        assertTrue("Câu hiện tại (10) phải luôn được giữ lại", readyAudioFiles.containsKey(10));
        assertTrue("Câu tiếp theo (11) phải luôn được giữ lại để chuẩn bị gapless", readyAudioFiles.containsKey(11));
        assertTrue("Câu 15 trong tương lai phải được giữ lại", readyAudioFiles.containsKey(15));
    }

    @Test
    public void testEvictOldChunks_khiDangODauChuong_khongXoaNham() {
        ConcurrentHashMap<Integer, File> readyAudioFiles = new ConcurrentHashMap<>();
        for (int i = 0; i <= 5; i++) {
            readyAudioFiles.put(i, new File("/fake/cache/chunk_" + i + ".mp3"));
        }

        AudioCacheManager cacheManager = new AudioCacheManager(null);

        // Đang ở câu đầu chương (index = 0 hoặc index = 1)
        // thresholdIndex <= 0 -> Không có câu nào bị xóa
        cacheManager.evictOldChunks(1, readyAudioFiles, null, null);

        assertEquals("Toàn bộ 6 câu đầu chương phải được giữ nguyên", 6, readyAudioFiles.size());
    }
}
