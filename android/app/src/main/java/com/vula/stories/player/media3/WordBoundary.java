package com.vula.stories.player.media3;

public final class WordBoundary {
    private final int charIndex;
    private final int charLength;
    private final String text;
    private final long startTimeMs;

    public WordBoundary(int charIndex, int charLength, String text, long startTimeMs) {
        this.charIndex = charIndex;
        this.charLength = charLength;
        this.text = text;
        this.startTimeMs = startTimeMs;
    }

    public int getCharIndex() { return charIndex; }
    public int getCharLength() { return charLength; }
    public String getText() { return text; }
    public long getStartTimeMs() { return startTimeMs; }
}
