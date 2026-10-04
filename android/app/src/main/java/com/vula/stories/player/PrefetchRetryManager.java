package com.vula.stories.player;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Quản lý cơ chế thử lại (Linear Backoff Retry) khi tải hoặc tổng hợp audio của từng câu trong luồng cuốn chiếu.
 * Giúp tự phục hồi khi gặp lỗi mạng tạm thời (Connection reset, timeout, socket closed...)
 * mà không làm gián đoạn trải nghiệm đọc của người dùng.
 */
public class PrefetchRetryManager {
    public static final int DEFAULT_MAX_RETRIES = 3;
    public static final long DEFAULT_BASE_DELAY_MS = 500L;

    private final int maxRetries;
    private final long baseDelayMs;
    private final Map<Integer, Integer> retryCounts = new ConcurrentHashMap<>();

    public PrefetchRetryManager() {
        this(DEFAULT_MAX_RETRIES, DEFAULT_BASE_DELAY_MS);
    }

    public PrefetchRetryManager(int maxRetries, long baseDelayMs) {
        this.maxRetries = maxRetries;
        this.baseDelayMs = baseDelayMs;
    }

    /**
     * Kiểm tra xem câu này còn được phép thử lại hay không.
     */
    public boolean canRetry(int chunkIndex) {
        int current = retryCounts.getOrDefault(chunkIndex, 0);
        return current < maxRetries;
    }

    /**
     * Ghi nhận một lần thất bại, tăng bộ đếm và trả về số lần thử tiếp theo.
     */
    public int recordFailure(int chunkIndex) {
        int next = retryCounts.getOrDefault(chunkIndex, 0) + 1;
        retryCounts.put(chunkIndex, next);
        return next;
    }

    /**
     * Tính toán thời gian hoãn trước khi thử lại theo thuật toán Linear Backoff:
     * Lần 1: baseDelayMs * 1
     * Lần 2: baseDelayMs * 2
     * Lần 3: baseDelayMs * 3
     */
    public long getDelayMs(int chunkIndex) {
        int count = retryCounts.getOrDefault(chunkIndex, 1);
        return count * baseDelayMs;
    }

    /**
     * Ghi nhận tải thành công, xóa bộ đếm retry của câu.
     */
    public void recordSuccess(int chunkIndex) {
        retryCounts.remove(chunkIndex);
    }

    /**
     * Kiểm tra xem câu đã thử hết số lần cho phép hay chưa.
     */
    public boolean isExhausted(int chunkIndex) {
        return retryCounts.getOrDefault(chunkIndex, 0) >= maxRetries;
    }

    /**
     * Lấy số lần đã thử thất bại hiện tại.
     */
    public int getRetryCount(int chunkIndex) {
        return retryCounts.getOrDefault(chunkIndex, 0);
    }

    /**
     * Xóa toàn bộ bộ nhớ retry khi chuyển chương hoặc dừng phát.
     */
    public void reset() {
        retryCounts.clear();
    }
}
