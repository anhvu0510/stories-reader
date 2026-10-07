package com.vula.stories;

import com.vula.stories.player.media3.PlaybackResumePosition;
import com.vula.stories.player.media3.WordBoundary;
import org.junit.Test;
import java.util.List;
import static org.junit.Assert.assertEquals;

public class PlaybackResumePositionTest {
    private final List<WordBoundary> words = List.of(
            new WordBoundary(0, 3, "Một", 100, 250),
            new WordBoundary(4, 3, "hai", 800, 250));

    @Test public void seeksIntoCachedOriginalAudioAtTheInterruptedWord() {
        assertEquals(800L, PlaybackResumePosition.find(words, 5, true));
        assertEquals(800L, PlaybackResumePosition.find(words, 3, true));
    }

    @Test public void waitsForTheRequestedBoundaryInsteadOfReplayingTheBeginning() {
        assertEquals(-1L, PlaybackResumePosition.find(words.subList(0, 1), 4, false));
        assertEquals(-1L, PlaybackResumePosition.find(List.of(), 4, false));
    }

    @Test public void completedTrailingPunctuationSeeksPastTheLastWord() {
        assertEquals(1050L, PlaybackResumePosition.find(words, 8, true));
        assertEquals(0L, PlaybackResumePosition.find(words, 0, false));
    }
}
