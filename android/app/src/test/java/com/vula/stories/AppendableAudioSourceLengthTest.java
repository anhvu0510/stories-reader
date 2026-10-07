package com.vula.stories;

import static org.junit.Assert.assertEquals;
import androidx.media3.common.C;
import com.vula.stories.player.media3.AppendableAudioSource;
import org.junit.Test;

public class AppendableAudioSourceLengthTest {
    @Test
    public void completedAudioExposesRemainingLengthForSeeking() throws Exception {
        AppendableAudioSource source = new AppendableAudioSource();
        source.append(new byte[]{1, 2, 3, 4});
        assertEquals(C.LENGTH_UNSET, source.remainingLength(0));
        source.complete();
        assertEquals(2L, source.remainingLength(2));
    }
}
