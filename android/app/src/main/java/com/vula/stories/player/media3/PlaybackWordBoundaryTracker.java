package com.vula.stories.player.media3;

import java.util.List;

/** Selects a word using the audio playback clock, independent of UI tick frequency. */
public final class PlaybackWordBoundaryTracker {
    private int lastIndex = -1;

    public void reset() { lastIndex = -1; }

    public WordBoundary findDueBoundary(List<WordBoundary> words, long positionMs) {
        if (words == null) return null;
        synchronized (words) {
            int previousIndex = lastIndex;
            for (int index = lastIndex + 1;
                 index < words.size() && words.get(index).getStartTimeMs() <= positionMs;
                 index++) {
                lastIndex = index;
            }
            if (lastIndex == previousIndex) return null;
            return words.get(lastIndex);
        }
    }
}
