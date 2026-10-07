package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.vula.stories.player.media3.AdaptiveBufferPolicy;
import com.vula.stories.player.media3.PlaybackSnapshot;
import com.vula.stories.player.media3.PlaybackStateMachine;
import com.vula.stories.player.media3.ReadAloudRequestNormalizer;
import com.vula.stories.player.media3.ReadAloudUtterance;
import com.vula.stories.player.media3.RetryPolicy;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Collections;

public class Media3ReadAloudCoreTest {
    @Test
    public void normalizesLegacyChunksIntoStableUtterances() {
        List<ReadAloudUtterance> result = ReadAloudRequestNormalizer.fromLegacyChunks(Arrays.asList("Một", "Hai"));

        assertEquals(2, result.size());
        assertEquals("legacy-0", result.get(0).getId());
        assertEquals(1, result.get(1).getParagraphIndex());
        assertEquals("Hai", result.get(1).getText());
    }

    @Test
    public void rejectsStateUpdatesFromStaleSessions() {
        PlaybackStateMachine machine = new PlaybackStateMachine();
        machine.start("active", 2);

        assertFalse(machine.transition("stale", PlaybackSnapshot.State.PLAYING, 3, 10L, 4000L));
        assertTrue(machine.transition("active", PlaybackSnapshot.State.PLAYING, 2, 10L, 4000L));
        assertEquals(PlaybackSnapshot.State.PLAYING, machine.snapshot().getState());
        assertEquals(2, machine.snapshot().getUtteranceIndex());
    }

    @Test
    public void usesDurationWatermarksAndCurrentFirstPriority() {
        AdaptiveBufferPolicy policy = new AdaptiveBufferPolicy(4000L, 11000L);

        assertTrue(policy.shouldBuffer(3500L));
        assertFalse(policy.shouldBuffer(11000L));
        assertEquals(Arrays.asList(4, 5, 6), policy.planIndices(4, 7, Arrays.asList(0L, 3000L, 4200L)));
    }

    @Test
    public void lookaheadBudgetDoesNotCountTheCurrentlyPlayingSentence() {
        AdaptiveBufferPolicy policy = new AdaptiveBufferPolicy(4000L, 11000L);
        assertEquals(Arrays.asList(0, 1, 2, 3),
                policy.planIndices(0, 8, Arrays.asList(25000L, 4000L, 4000L, 4000L, 4000L)));
    }

    @Test
    public void lookaheadIsBoundedEvenWhenDurationsAreMissingOrZero() {
        AdaptiveBufferPolicy policy = new AdaptiveBufferPolicy(4000L, 11000L);
        assertTrue(policy.planIndices(0, 1000, Collections.nCopies(1000, 0L)).size() <= 17);
        assertEquals(Arrays.asList(9), policy.planIndices(9, 10, Arrays.asList(18000L)));
    }

    @Test
    public void retryBackoffIsBoundedAndJitterable() {
        RetryPolicy policy = new RetryPolicy(3, 250L, 2000L);

        assertEquals(250L, policy.delayMillis(0, 0.0));
        assertEquals(1000L, policy.delayMillis(2, 0.0));
        assertEquals(2000L, policy.delayMillis(8, 0.0));
        assertFalse(policy.canRetry(3));
    }
}
