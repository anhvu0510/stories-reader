package com.vula.stories.tts.edge.segment;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Thuật toán phân đoạn câu thông minh (Adaptive Clause Segmenter).
 * Chia nhỏ các câu dài thành các phân đoạn tự nhiên (Clause Segments)
 * để giảm thời gian chờ phản hồi đầu tiên (TTFA) của Bing Edge TTS xuống < 300ms.
 */
public class ClauseSegmenter {

    public static final int MIN_SPLIT_THRESHOLD = 55;
    public static final int FIRST_SEGMENT_MAX = 55;
    public static final int TARGET_SEGMENT_CHARS = 80;
    public static final int MAX_SEGMENT_CHARS = 120;

    private static final char[] PUNCTUATION_BREAKS = {',', ';', ':', '—', '-', '…', ')', ']', '"', '”'};
    private static final String[] CONJUNCTIONS = {
            " nhưng ", " mà ", " và ", " tuy nhiên ", " vì vậy ",
            " cho nên ", " đồng thời ", " bởi vì ", " sau đó ", " mặc dù "
    };

    public static List<ClauseSegment> segment(int parentChunkIndex, String text) {
        if (text == null || text.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String raw = text.trim();
        if (raw.length() < MIN_SPLIT_THRESHOLD) {
            ClauseSegment single = new ClauseSegment(parentChunkIndex, 0, raw, 0, raw.length(), true, true);
            return Collections.singletonList(single);
        }

        List<ClauseSegment> result = new ArrayList<>();
        int currentStart = 0;
        int segmentIndex = 0;

        while (currentStart < raw.length()) {
            int remaining = raw.length() - currentStart;
            if (remaining < MIN_SPLIT_THRESHOLD && segmentIndex > 0) {
                // Phần còn lại quá ngắn, gộp làm phân đoạn cuối cùng
                addSegment(result, parentChunkIndex, segmentIndex, raw, currentStart, raw.length(), true);
                break;
            }

            boolean isFirst = (segmentIndex == 0);
            int cutPoint = findBestCutPoint(raw, currentStart, isFirst);

            if (cutPoint >= raw.length()) {
                addSegment(result, parentChunkIndex, segmentIndex, raw, currentStart, raw.length(), true);
                break;
            }

            addSegment(result, parentChunkIndex, segmentIndex, raw, currentStart, cutPoint, false);
            currentStart = cutPoint;
            segmentIndex++;
        }

        return result;
    }

    private static void addSegment(
            List<ClauseSegment> list,
            int parentChunkIndex,
            int segmentIndex,
            String fullText,
            int start,
            int end,
            boolean isLast
    ) {
        String sub = fullText.substring(start, end).trim();
        boolean isFirst = (segmentIndex == 0);
        list.add(new ClauseSegment(parentChunkIndex, segmentIndex, sub, start, end, isFirst, isLast));
    }

    private static int findBestCutPoint(String text, int start, boolean isFirst) {
        int maxChars = isFirst ? FIRST_SEGMENT_MAX : TARGET_SEGMENT_CHARS;
        int minChars = isFirst ? 20 : 35;

        int searchEnd = Math.min(text.length(), start + maxChars);
        int searchStart = Math.min(text.length(), start + minChars);

        if (searchStart >= searchEnd) {
            return searchEnd;
        }

        // 1. Ưu tiên dấu câu mềm
        int punctCut = findPunctuationCut(text, searchStart, searchEnd);
        if (punctCut > 0) {
            return punctCut;
        }

        // 2. Ưu tiên liên từ tiếng Việt
        int conjCut = findConjunctionCut(text, searchStart, searchEnd);
        if (conjCut > 0) {
            return conjCut;
        }

        // 3. Dự phòng khoảng trắng ngắt từ
        int spaceCut = findSpaceCut(text, searchStart, searchEnd);
        if (spaceCut > 0) {
            return spaceCut;
        }

        return searchEnd;
    }

    private static int findPunctuationCut(String text, int searchStart, int searchEnd) {
        for (int i = searchEnd - 1; i >= searchStart; i--) {
            char c = text.charAt(i);
            if (isPunctuation(c)) {
                return (i + 1 < text.length() && text.charAt(i + 1) == ' ') ? i + 2 : i + 1;
            }
        }
        return -1;
    }

    private static boolean isPunctuation(char c) {
        for (char p : PUNCTUATION_BREAKS) {
            if (c == p) {
                return true;
            }
        }
        return false;
    }

    private static int findConjunctionCut(String text, int searchStart, int searchEnd) {
        String window = text.substring(searchStart, searchEnd).toLowerCase();
        int bestIndex = -1;

        for (String conj : CONJUNCTIONS) {
            int idx = window.indexOf(conj);
            if (idx >= 0 && (bestIndex == -1 || idx < bestIndex)) {
                bestIndex = idx;
            }
        }

        if (bestIndex < 0) {
            return -1;
        }
        // Cắt ngay trước liên từ (bao gồm khoảng trắng trước)
        return searchStart + bestIndex + 1;
    }

    private static int findSpaceCut(String text, int searchStart, int searchEnd) {
        for (int i = searchEnd - 1; i >= searchStart; i--) {
            if (text.charAt(i) == ' ') {
                return i + 1;
            }
        }
        return -1;
    }
}
