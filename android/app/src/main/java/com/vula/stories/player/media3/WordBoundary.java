package com.vula.stories.player.media3;

public final class WordBoundary {
    private final int charIndex;
    private final int charLength;
    private final String text;
    private final long startTimeMs;
    private final long durationMs;

    public WordBoundary(int charIndex, int charLength, String text, long startTimeMs) {
        this(charIndex, charLength, text, startTimeMs, 0L);
    }

    public WordBoundary(int charIndex, int charLength, String text, long startTimeMs, long durationMs) {
        this.charIndex = charIndex;
        this.charLength = charLength;
        this.text = text;
        this.startTimeMs = startTimeMs;
        this.durationMs = durationMs;
    }

    public int getCharIndex() { return charIndex; }
    public int getCharLength() { return charLength; }
    public String getText() { return text; }
    public long getStartTimeMs() { return startTimeMs; }
    public long getDurationMs() { return durationMs; }
}
