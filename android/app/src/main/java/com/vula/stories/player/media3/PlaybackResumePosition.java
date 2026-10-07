package com.vula.stories.player.media3;

import java.util.List;

/** Resolve a text cursor against the original cached audio, never a freshly sliced suffix. */
public final class PlaybackResumePosition {
    private PlaybackResumePosition() {}

    public static long find(List<WordBoundary> words, int charIndex, boolean completed) {
        if (charIndex <= 0) return 0L;
        for (WordBoundary word : words) {
            if (word.getCharIndex() + word.getCharLength() > charIndex) return word.getStartTimeMs();
        }
        if (!completed || words.isEmpty()) return -1L;
        WordBoundary last = words.get(words.size() - 1);
        return last.getStartTimeMs() + last.getDurationMs();
    }
}
