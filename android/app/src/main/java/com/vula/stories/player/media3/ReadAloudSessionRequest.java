package com.vula.stories.player.media3;

import java.util.Collections;
import java.util.List;

public final class ReadAloudSessionRequest {
    private final String sessionId;
    private final List<ReadAloudUtterance> utterances;
    private final int startIndex;
    private final String voice;
    private final String rate;
    private final String pitch;
    private final String bookTitle;
    private final String chapterTitle;
    private final int startCharIndex;

    public ReadAloudSessionRequest(
            String sessionId,
            List<ReadAloudUtterance> utterances,
            int startIndex,
            String voice,
            String rate,
            String pitch,
            String bookTitle,
            String chapterTitle
    ) {
        this(sessionId, utterances, startIndex, voice, rate, pitch, bookTitle, chapterTitle, 0);
    }

    public ReadAloudSessionRequest(String sessionId, List<ReadAloudUtterance> utterances, int startIndex,
            String voice, String rate, String pitch, String bookTitle, String chapterTitle, int startCharIndex) {
        this.sessionId = sessionId;
        this.utterances = Collections.unmodifiableList(utterances);
        this.startIndex = startIndex;
        this.voice = voice;
        this.rate = rate;
        this.pitch = pitch;
        this.bookTitle = bookTitle;
        this.chapterTitle = chapterTitle;
        this.startCharIndex = Math.max(0, startCharIndex);
    }

    public String getSessionId() { return sessionId; }
    public List<ReadAloudUtterance> getUtterances() { return utterances; }
    public int getStartIndex() { return startIndex; }
    public int getStartCharIndex() { return startCharIndex; }
    public String getVoice() { return voice; }
    public String getRate() { return rate; }
    public String getPitch() { return pitch; }
    public String getBookTitle() { return bookTitle; }
    public String getChapterTitle() { return chapterTitle; }
}
