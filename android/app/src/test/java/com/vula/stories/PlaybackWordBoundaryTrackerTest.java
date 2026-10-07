package com.vula.stories;

import com.vula.stories.player.media3.PlaybackWordBoundaryTracker;
import com.vula.stories.player.media3.WordBoundary;
import org.junit.Test;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

public class PlaybackWordBoundaryTrackerTest {
    private final List<WordBoundary> words = Arrays.asList(
            new WordBoundary(0, 3, "Một", 100L),
            new WordBoundary(4, 3, "hai", 300L),
            new WordBoundary(8, 2, "ba", 500L));

    @Test
    public void delayedTickSelectsCurrentlySpokenWordWithoutReplayingOldHighlights() {
        PlaybackWordBoundaryTracker tracker = new PlaybackWordBoundaryTracker();
        assertEquals("ba", tracker.findDueBoundary(words, 520L).getText());
        assertNull(tracker.findDueBoundary(words, 540L));
    }

    @Test
    public void doesNotHighlightAheadOfAudioOrRescaleProviderTimestamps() {
        PlaybackWordBoundaryTracker tracker = new PlaybackWordBoundaryTracker();
        assertNull(tracker.findDueBoundary(words, 90L));
        assertEquals("Một", tracker.findDueBoundary(words, 100L).getText());
        assertNull(tracker.findDueBoundary(words, 299L));
        assertEquals("hai", tracker.findDueBoundary(words, 300L).getText());
    }

    @Test
    public void resetAllowsSameSentenceToBeReplayedAfterSeek() {
        PlaybackWordBoundaryTracker tracker = new PlaybackWordBoundaryTracker();
        tracker.findDueBoundary(words, 520L);
        tracker.reset();
        assertNull(tracker.findDueBoundary(words, 0L));
        assertEquals("Một", tracker.findDueBoundary(words, 100L).getText());
    }
}
