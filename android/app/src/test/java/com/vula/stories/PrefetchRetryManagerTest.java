package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.vula.stories.player.PrefetchRetryManager;

import org.junit.Before;
import org.junit.Test;

/**
 * Unit Test kiểm tra cơ chế thử lại cuốn chiếu (Prefetch Retry với Linear Backoff):
 * - Tự động thử lại khi tải câu gặp sự cố mạng (Connection reset, timeout).
 * - Tăng thời gian hoãn theo số lần thất bại (500ms, 1000ms, 1500ms).
 * - Giới hạn tối đa 3 lần thử lại để tránh nghẽn luồng.
 * - Reset bộ đếm khi tải thành công hoặc chuyển chương.
 */
public class PrefetchRetryManagerTest {

    private PrefetchRetryManager retryManager;

    @Before
    public void setUp() {
        retryManager = new PrefetchRetryManager(3, 500L);
    }

    @Test
    public void testCanRetry_macDinhChoPhepThuLai() {
        // Ban đầu chưa lỗi, câu số 8 phải được phép thử lại
        assertTrue("Mặc định phải cho phép thử lại", retryManager.canRetry(8));
        assertEquals(0, retryManager.getRetryCount(8));
        assertFalse(retryManager.isExhausted(8));
    }

    @Test
    public void testRecordFailure_tangSoLanVaLinearBackoffDelay() {
        // Lần lỗi thứ 1
        int retries1 = retryManager.recordFailure(8);
        assertEquals(1, retries1);
        assertEquals(500L, retryManager.getDelayMs(8));
        assertTrue(retryManager.canRetry(8));
        assertFalse(retryManager.isExhausted(8));

        // Lần lỗi thứ 2
        int retries2 = retryManager.recordFailure(8);
        assertEquals(2, retries2);
        assertEquals(1000L, retryManager.getDelayMs(8));
        assertTrue(retryManager.canRetry(8));
        assertFalse(retryManager.isExhausted(8));

        // Lần lỗi thứ 3
        int retries3 = retryManager.recordFailure(8);
        assertEquals(3, retries3);
        assertEquals(1500L, retryManager.getDelayMs(8));
        // Đã đạt 3 lần -> không còn được phép thử thêm
        assertFalse("Đã đạt giới hạn 3 lần thì canRetry phải trả về false", retryManager.canRetry(8));
        assertTrue("isExhausted phải trả về true khi đạt tối đa 3 lần", retryManager.isExhausted(8));
    }

    @Test
    public void testRecordSuccess_xoaBoDemKhiTaiThanhCong() {
        // Gặp lỗi 2 lần
        retryManager.recordFailure(8);
        retryManager.recordFailure(8);
        assertEquals(2, retryManager.getRetryCount(8));

        // Lần 3 thành công -> Gọi recordSuccess
        retryManager.recordSuccess(8);
        assertEquals("Sau khi thành công, bộ đếm retry phải được xóa về 0", 0, retryManager.getRetryCount(8));
        assertTrue("Sau khi reset, câu lại có thể thử lại nếu cần", retryManager.canRetry(8));
    }

    @Test
    public void testReset_xoaToanBoBoDemCacCau() {
        retryManager.recordFailure(1);
        retryManager.recordFailure(2);
        retryManager.recordFailure(8);

        retryManager.reset();

        assertEquals(0, retryManager.getRetryCount(1));
        assertEquals(0, retryManager.getRetryCount(2));
        assertEquals(0, retryManager.getRetryCount(8));
    }

    @Test
    public void testCacCauDocLapVoiNhau() {
        // Lỗi ở câu 8 không được ảnh hưởng đến trạng thái của câu 9
        retryManager.recordFailure(8);
        retryManager.recordFailure(8);
        retryManager.recordFailure(8);

        assertTrue("Câu 8 đã kiệt sức", retryManager.isExhausted(8));
        assertFalse("Câu 9 chưa bị lỗi phải còn nguyên lượt thử", retryManager.isExhausted(9));
        assertTrue("Câu 9 phải được phép tải", retryManager.canRetry(9));
    }
}
