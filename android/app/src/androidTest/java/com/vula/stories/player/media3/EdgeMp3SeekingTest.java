package com.vula.stories.player.media3;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import androidx.media3.common.C;
import androidx.media3.extractor.DefaultExtractorInput;
import androidx.media3.extractor.DummyTrackOutput;
import androidx.media3.extractor.Extractor;
import androidx.media3.extractor.ExtractorOutput;
import androidx.media3.extractor.PositionHolder;
import androidx.media3.extractor.SeekMap;
import androidx.media3.extractor.TrackOutput;
import androidx.media3.extractor.mp3.Mp3Extractor;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real Android extractor: an unknown-length Edge stream must seek past its spoken prefix. */
@RunWith(AndroidJUnit4.class)
public class EdgeMp3SeekingTest {
    @Test
    public void progressiveEdgeAudioCanSeekBeforeItsLengthIsKnown() throws Exception {
        byte[] audio = new byte[144 * 300];
        for (int frame = 0; frame < 300; frame++) {
            // MPEG-2 layer III, 24 kHz, 48 kbit/s, mono: the Edge output format.
            int position = frame * 144;
            audio[position] = (byte) 0xff;
            audio[position + 1] = (byte) 0xf3;
            audio[position + 2] = (byte) 0x64;
            audio[position + 3] = (byte) 0xc0;
        }
        ByteArrayInputStream bytes = new ByteArrayInputStream(audio);
        DefaultExtractorInput input = new DefaultExtractorInput(bytes::read, 0, C.LENGTH_UNSET);
        Extractor extractor = Arrays.stream(NativeReadAloudService.edgeExtractors().createExtractors())
                .filter(candidate -> candidate instanceof Mp3Extractor).findFirst().orElseThrow();
        AtomicReference<SeekMap> result = new AtomicReference<>();
        extractor.init(new ExtractorOutput() {
            @Override public TrackOutput track(int id, int type) { return new DummyTrackOutput(); }
            @Override public void endTracks() {}
            @Override public void seekMap(SeekMap map) { result.set(map); }
        });
        extractor.read(input, new PositionHolder());
        SeekMap map = result.get();
        assertNotNull(map);
        assertTrue(map.isSeekable());
        assertTrue(map.getSeekPoints(2_000_000).first.position > 0);
        assertTrue(Math.abs(map.getSeekPoints(2_000_000).first.timeUs - 2_000_000) < 30_000);
        extractor.release();
    }
}
