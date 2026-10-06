package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.vula.stories.player.PrefetchRetryManager;
import com.vula.stories.player.source.AudioSource;
import com.vula.stories.player.source.MemoryAudioSource;
import com.vula.stories.tts.edge.AudioCacheManager;
import com.vula.stories.tts.edge.EdgePrefetchQueue;
import com.vula.stories.tts.edge.EdgeWebSocketClient;

import org.junit.Before;
import org.junit.Test;

import java.util.Arrays;
import java.util.List;

/**
 * Unit Test kiểm tra cấu hình và vận hành của EdgePrefetchQueue.
 */
public class EdgePrefetchQueueTest {

    private EdgePrefetchQueue queue;

    @Before
    public void setUp() {
        // Khởi tạo queue với các dependency test (không kết nối mạng thực)
        EdgeWebSocketClient client = new EdgeWebSocketClient();
        AudioCacheManager cacheManager = new AudioCacheManager(null);
        PrefetchRetryManager retryManager = new PrefetchRetryManager();
        queue = new EdgePrefetchQueue(client, cacheManager, retryManager);
    }

    @Test
    public void testConfigure_khoiTaoVaXoaDuLieuCu() {
        List<String> chunks = Arrays.asList("Câu 1", "Câu 2", "Câu 3");
        queue.configure(chunks, "vi-VN-HoaiMyNeural", "default", "default", "memory", null);

        assertFalse(queue.isChunkReady(0));
        assertNull(queue.getAudioSource(0));
        assertNotNull(queue.getWordBoundariesSource());
    }

    @Test
    public void testPrefetchAhead_indexAmHoacVuotNguong_khongXayRaLoi() {
        List<String> chunks = Arrays.asList("Câu 1");
        queue.configure(chunks, "vi-VN-HoaiMyNeural", "default", "default", "memory", null);

        // Gọi với index âm hoặc quá giới hạn
        queue.prefetchAhead(-1, 2);
        queue.prefetchAhead(5, 2);
        assertEquals(0, queue.getWordBoundariesSource().size());
    }

    @Test
    public void testClear_giaiPhongHoanToan() {
        List<String> chunks = Arrays.asList("Câu 1", "Câu 2");
        queue.configure(chunks, "vi-VN-HoaiMyNeural", "default", "default", "memory", null);

        queue.clear();
        assertFalse(queue.isChunkReady(0));
    }
}
