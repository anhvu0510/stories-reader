package com.vula.stories.player;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Thuật toán định vị và điều tiết nhịp hiển thị từ đang đọc (Word Boundary Tracker).
 * Đóng gói toàn bộ logic:
 * - Lead-in 20ms bù trừ độ trễ buffer phần cứng âm thanh.
 * - Early highlight (0ms) cho từ đầu tiên ngay khi phát câu.
 * - Tail protection (80ms) giữ từ cuối cùng cho tới khi dứt câu.
 * - Pacing catch-up chống nhảy cóc khi buffer HAL trả về bước nhảy thời gian đột ngột.
 */
public class WordBoundaryTracker {

    private static final double LEAD_IN_SECONDS = 0.02; // Bù trễ buffer âm thanh HAL 20ms
    private static final int TAIL_PROTECTION_MS = 80;    // Giữ từ cuối câu trong 80ms cuối

    private int lastWordBoundaryIndex = -1;

    public WordBoundaryTracker() {
        this.lastWordBoundaryIndex = -1;
    }

    public synchronized void reset() {
        this.lastWordBoundaryIndex = -1;
    }

    public synchronized int getLastWordBoundaryIndex() {
        return lastWordBoundaryIndex;
    }

    public synchronized void setLastWordBoundaryIndex(int index) {
        this.lastWordBoundaryIndex = index;
    }

    /**
     * Xác định từ cần highlight tiếp theo dựa trên mốc thời gian phát âm thanh hiện tại.
     * Sử dụng Flat Guard Clauses, đảm bảo không nhảy cóc từ.
     */
    public synchronized JSONObject findNextBoundary(int posMs, int durationMs, JSONArray boundaries) {
        if (boundaries == null || boundaries.length() == 0) {
            return null;
        }

        int totalWords = boundaries.length();
        double posSec = (double) posMs / 1000.0;
        JSONObject activeWb = null;
        int activeIdx = -1;

        for (int i = 0; i < totalWords; i++) {
            JSONObject wb = boundaries.optJSONObject(i);
            if (wb == null) {
                continue;
            }
            double startSec = wb.optDouble("startSeconds", 0);
            if ((posSec + LEAD_IN_SECONDS) < startSec) {
                break;
            }
            activeWb = wb;
            activeIdx = i;
        }

        // Kích hoạt ngay từ đầu tiên khi bắt đầu câu để triệt tiêu trễ thị giác
        if (activeWb == null && lastWordBoundaryIndex < 0) {
            activeWb = boundaries.optJSONObject(0);
            activeIdx = 0;
        }

        // Bảo vệ từ cuối câu: chỉ kích hoạt khi âm thanh tiệm cận sát mốc kết thúc
        if (durationMs > 0 && posMs >= durationMs - TAIL_PROTECTION_MS && activeIdx < totalWords - 1) {
            activeIdx = totalWords - 1;
            activeWb = boundaries.optJSONObject(activeIdx);
        }

        if (activeWb == null || activeIdx <= lastWordBoundaryIndex) {
            return null;
        }

        // Pacing catch-up: tiến tuần tự tối đa 1 từ mỗi chu kỳ tick để mọi từ đều được hiển thị
        int emitIdx = activeIdx;
        if (lastWordBoundaryIndex >= 0 && activeIdx > lastWordBoundaryIndex + 1) {
            emitIdx = lastWordBoundaryIndex + 1;
        }

        JSONObject emitWb = boundaries.optJSONObject(emitIdx);
        if (emitWb == null) {
            return null;
        }

        lastWordBoundaryIndex = emitIdx;
        return emitWb;
    }

    /**
     * Thu hồi toàn bộ các từ còn lại chưa kịp kích hoạt khi câu kết thúc.
     */
    public synchronized List<JSONObject> drainRemainingBoundaries(JSONArray boundaries) {
        if (boundaries == null || boundaries.length() == 0) {
            return Collections.emptyList();
        }

        List<JSONObject> remaining = new ArrayList<>();
        int startIndex = Math.max(0, lastWordBoundaryIndex + 1);
        for (int i = startIndex; i < boundaries.length(); i++) {
            JSONObject wb = boundaries.optJSONObject(i);
            if (wb != null) {
                remaining.add(wb);
            }
        }

        lastWordBoundaryIndex = boundaries.length() - 1;
        return remaining;
    }
}
