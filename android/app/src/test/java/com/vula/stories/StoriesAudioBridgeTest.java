package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.vula.stories.player.StoriesAudioBridge;

import org.junit.Before;
import org.junit.Test;

/**
 * Unit Test kiểm tra cơ chế điều khiển hai chiều của StoriesAudioBridge:
 * - Đăng ký listener nhận sự kiện từ thanh thông báo / màn hình khóa (Notification & Lock Screen).
 * - Phân phối chính xác các lệnh: Play, Pause, Next, Previous, Stop.
 * - Hủy đăng ký an toàn và xử lý trường hợp không có listener (zero NullPointerException).
 */
public class StoriesAudioBridgeTest {

    // Lớp giả lập (Spy/Mock) để ghi nhận các sự kiện được chuyển tiếp từ AudioBridge
    private static class TestAudioControlListener implements StoriesAudioBridge.AudioControlListener {
        int playCalls = 0;
        int pauseCalls = 0;
        int nextCalls = 0;
        int previousCalls = 0;
        int stopCalls = 0;

        @Override
        public void onPlayRequested() {
            playCalls++;
        }

        @Override
        public void onPauseRequested() {
            pauseCalls++;
        }

        @Override
        public void onNextRequested() {
            nextCalls++;
        }

        @Override
        public void onPreviousRequested() {
            previousCalls++;
        }

        @Override
        public void onStopRequested() {
            stopCalls++;
        }
    }

    @Before
    public void setUp() {
        // Đảm bảo trạng thái ban đầu sạch trước mỗi test
        StoriesAudioBridge.registerListener(null);
    }

    @Test
    public void testDispatchKhiChuaCoListener_khongNemNgoaiLe() {
        // Kiểm tra an toàn: khi chưa có listener nào đăng ký, việc dispatch các lệnh không được gây crash ứng dụng
        StoriesAudioBridge.dispatchPlay();
        StoriesAudioBridge.dispatchPause();
        StoriesAudioBridge.dispatchNext();
        StoriesAudioBridge.dispatchPrevious();
        StoriesAudioBridge.dispatchStop();
        // Không có ngoại lệ xảy ra là đạt chuẩn
        assertTrue(true);
    }

    @Test
    public void testChuyenTiepCacLenhDieuKhien_toiListenerDangHoatDong() {
        TestAudioControlListener listener = new TestAudioControlListener();
        StoriesAudioBridge.registerListener(listener);

        StoriesAudioBridge.dispatchPlay();
        assertEquals(1, listener.playCalls);

        StoriesAudioBridge.dispatchPause();
        assertEquals(1, listener.pauseCalls);

        StoriesAudioBridge.dispatchNext();
        assertEquals(1, listener.nextCalls);

        StoriesAudioBridge.dispatchPrevious();
        assertEquals(1, listener.previousCalls);

        StoriesAudioBridge.dispatchStop();
        assertEquals(1, listener.stopCalls);
    }

    @Test
    public void testHuyDangKyListener_khongNhanThemSuKien() {
        TestAudioControlListener listener = new TestAudioControlListener();
        StoriesAudioBridge.registerListener(listener);

        StoriesAudioBridge.dispatchPlay();
        assertEquals(1, listener.playCalls);

        // Hủy đăng ký listener
        StoriesAudioBridge.unregisterListener(listener);

        // Phát tiếp các lệnh khác
        StoriesAudioBridge.dispatchPlay();
        StoriesAudioBridge.dispatchPause();

        // Số lần nhận sự kiện không được tăng thêm
        assertEquals(1, listener.playCalls);
        assertEquals(0, listener.pauseCalls);
    }
}
