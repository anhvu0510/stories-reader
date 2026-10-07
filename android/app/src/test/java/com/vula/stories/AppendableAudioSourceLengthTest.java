package com.vula.stories;

import static org.junit.Assert.assertEquals;
import androidx.media3.common.C;
import com.vula.stories.player.media3.AppendableAudioSource;
import org.junit.Test;

public class AppendableAudioSourceLengthTest {
    @org.junit.Test public void releasesOnlyCompletedAudioAndCanBeRefilledFromCacheAfterSeek() {
        AppendableAudioSource source = new AppendableAudioSource();
        source.append(new byte[] {1, 2, 3});
        org.junit.Assert.assertFalse(source.releaseCompletedBuffer());
        source.complete();
        org.junit.Assert.assertTrue(source.releaseCompletedBuffer());
        org.junit.Assert.assertEquals(0, source.size());
        source.append(new byte[] {1, 2, 3});
        source.complete();
        org.junit.Assert.assertEquals(3L, source.remainingLength(0));
    }
    @Test
    public void completedAudioExposesRemainingLengthForSeeking() throws Exception {
        AppendableAudioSource source = new AppendableAudioSource();
        source.append(new byte[]{1, 2, 3, 4});
        assertEquals(C.LENGTH_UNSET, source.remainingLength(0));
        source.complete();
        assertEquals(2L, source.remainingLength(2));
    }
}
