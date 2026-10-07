package com.vula.stories.player.media3;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.vula.stories.MainActivity;
import java.io.File;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real Media3 decoding/seek from disk, with a voice that cannot synthesize over the network. */
@RunWith(AndroidJUnit4.class)
public class EdgeCachedPlaybackTest {
    @Test public void playsCachedTimelineAndSeeksWithoutSynthesizingAgain() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        EdgeTimelineCache cache = new EdgeTimelineCache(new File(context.getCacheDir(), EdgeTimelineCache.DIRECTORY), EdgeTimelineCache.DEFAULT_BUDGET_BYTES);
        List<ReadAloudUtterance> utterances = List.of(
                new ReadAloudUtterance("cached-0", 0, 0, 7, "Một hai", 0),
                new ReadAloudUtterance("cached-1", 1, 0, 6, "Ba bốn", 1),
                new ReadAloudUtterance("cached-2", 2, 0, 7, "Năm sáu", 2),
                new ReadAloudUtterance("cached-3", 3, 0, 8, "Bảy tám", 3));
        byte[] audio = silentMp3();
        for (ReadAloudUtterance utterance : utterances) {
            String word = utterance.getText().split(" ")[0];
            cache.put(EdgeTimelineCache.key(utterance.getText(), "cache-only-test", "+0%", "+0Hz"), audio,
                    List.of(new WordBoundary(0, word.length(), word, 100, 500)));
        }
        CountDownLatch first = new CountDownLatch(1);
        CountDownLatch next = new CountDownLatch(1);
        CountDownLatch automaticNext = new CountDownLatch(1);
        CountDownLatch replayed = new CountDownLatch(1);
        AtomicInteger stage = new AtomicInteger();
        AtomicInteger initialBuffers = new AtomicInteger();
        AtomicInteger nextBuffers = new AtomicInteger();
        AtomicReference<String> error = new AtomicReference<>();
        Media3ReadAloudBridge.Listener listener = new Media3ReadAloudBridge.Listener() {
            @Override public void onSnapshot(PlaybackSnapshot snapshot) {}
            @Override public void onUtteranceStart(String id, int index, ReadAloudUtterance utterance) {}
            @Override public void onWordBoundary(String id, int index, ReadAloudUtterance utterance, WordBoundary word) {}
            @Override public void onTimeline(PlaybackSnapshot snapshot, ReadAloudUtterance utterance, List<WordBoundary> words) {
                if (!"cache-playback".equals(snapshot.getSessionId()) || snapshot.getState() != PlaybackSnapshot.State.PLAYING || words.isEmpty()) return;
                if (snapshot.getUtteranceIndex() == 0 && snapshot.getPositionMs() >= 100 && first.getCount() > 0) {
                    initialBuffers.set(snapshot.getRebufferCount());
                    first.countDown();
                }
                if (snapshot.getUtteranceIndex() == 1 && snapshot.getPositionMs() >= 100 && stage.get() == 0) {
                    nextBuffers.set(snapshot.getRebufferCount());
                    automaticNext.countDown();
                }
                if (snapshot.getUtteranceIndex() == 3 && snapshot.getPositionMs() >= 100) next.countDown();
                if (snapshot.getUtteranceIndex() == 0 && snapshot.getPositionMs() >= 100 && stage.get() == 2) replayed.countDown();
            }
            @Override public void onCompleted(String id) {}
            @Override public void onError(String id, int index, String code, String message) { error.set(code + ": " + message); }
        };
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Media3ReadAloudBridge.registerListener(listener);
            Media3ReadAloudBridge.start(context, new ReadAloudSessionRequest("cache-playback", utterances,
                    0, "cache-only-test", "+0%", "+0Hz", "Test", "Test"));
            assertTrue("Cached audio must decode: " + error.get(), first.await(10, TimeUnit.SECONDS));
            assertTrue("Preloaded next item must play automatically", automaticNext.await(10, TimeUnit.SECONDS));
            assertEquals("A ready cached transition must not rebuffer", initialBuffers.get(), nextBuffers.get());
            stage.set(1);
            Media3ReadAloudBridge.seek(context, 3);
            assertTrue("Next cached audio must seek: " + error.get(), next.await(10, TimeUnit.SECONDS));
            stage.set(2);
            Media3ReadAloudBridge.seek(context, 0);
            assertTrue("Retired audio must reload from disk after RAM eviction: " + error.get(), replayed.await(10, TimeUnit.SECONDS));
            assertNull(error.get());
        } finally {
            Media3ReadAloudBridge.stop(context);
            Media3ReadAloudBridge.unregisterListener(listener);
        }
    }

    private byte[] silentMp3() {
        byte[] audio = new byte[144 * 50];
        for (int frame = 0; frame < 50; frame++) {
            int offset = frame * 144;
            audio[offset] = (byte) 0xff;
            audio[offset + 1] = (byte) 0xf3;
            audio[offset + 2] = (byte) 0x64;
            audio[offset + 3] = (byte) 0xc0;
        }
        return audio;
    }
}
