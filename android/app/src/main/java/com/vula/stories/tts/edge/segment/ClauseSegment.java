package com.vula.stories.tts.edge.segment;

/**
 * Đại diện cho một phân đoạn con của một câu văn bản (Clause Segment).
 * Giữ nguyên vị trí offset trong câu gốc để ánh xạ chính xác ranh giới từ vựng (Word Boundary).
 */
public class ClauseSegment {

    public final int parentChunkIndex;
    public final int segmentIndex;
    public final String text;
    public final int startOffset;
    public final int endOffset;
    public final boolean isFirst;
    public final boolean isLast;

    public ClauseSegment(
            int parentChunkIndex,
            int segmentIndex,
            String text,
            int startOffset,
            int endOffset,
            boolean isFirst,
            boolean isLast
    ) {
        this.parentChunkIndex = parentChunkIndex;
        this.segmentIndex = segmentIndex;
        this.text = text != null ? text : "";
        this.startOffset = startOffset;
        this.endOffset = endOffset;
        this.isFirst = isFirst;
        this.isLast = isLast;
    }

    public int getLength() {
        return text.length();
    }
}
