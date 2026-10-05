package com.vula.stories.player.media3;

public final class ReadAloudUtterance {
    private final String id;
    private final int paragraphIndex;
    private final int sourceStart;
    private final int sourceLength;
    private final String text;
    private final int sourceChunkIndex;

    public ReadAloudUtterance(
            String id,
            int paragraphIndex,
            int sourceStart,
            int sourceLength,
            String text,
            int sourceChunkIndex
    ) {
        this.id = id;
        this.paragraphIndex = paragraphIndex;
        this.sourceStart = sourceStart;
        this.sourceLength = sourceLength;
        this.text = text;
        this.sourceChunkIndex = sourceChunkIndex;
    }

    public String getId() {
        return id;
    }

    public int getParagraphIndex() {
        return paragraphIndex;
    }

    public int getSourceStart() {
        return sourceStart;
    }

    public int getSourceLength() {
        return sourceLength;
    }

    public String getText() {
        return text;
    }

    public int getSourceChunkIndex() { return sourceChunkIndex; }
}
