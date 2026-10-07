package com.vula.stories;

import android.content.Context;
import android.content.ContextWrapper;
import com.vula.stories.tts.edge.AudioCacheManager;
import com.vula.stories.tts.edge.EdgePrefetchQueue;
import com.vula.stories.tts.edge.EdgeStreamingCoordinator;
import com.vula.stories.player.source.AudioSource;
import org.junit.Test;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

public class EdgeStreamingNavigationTest {
    private static final class TestContext extends ContextWrapper {
        TestContext() { super(null); }
        @Override public Context getApplicationContext() { return this; }
    }

    private static final class RecordingQueue extends EdgePrefetchQueue {
        PrefetchListener listener;
        final List<Integer> fetched = new ArrayList<>();
        int prefetchCalls;
        RecordingQueue() { super(null, null, null); }
        @Override public synchronized void configure(List<String> chunks, String voice, String rate,
                String pitch, String mode, PrefetchListener listener) { this.listener = listener; }
        @Override public synchronized void startFetch(int index) { fetched.add(index); }
        @Override public synchronized void prefetchAhead(int index, int count) { prefetchCalls++; }
        @Override public synchronized void cancelAll() {}
    }

    private static final class RecordingEvents implements EdgeStreamingCoordinator.PlaybackEventListener {
        boolean paused;
        boolean completed;
        @Override public void onChunkStart(int index) {}
        @Override public void onWordBoundary(int index, int start, int length, String text) {}
        @Override public void onPlaybackStateChange(boolean playing, boolean paused, boolean buffering) {
            this.paused = paused;
        }
        @Override public void onPlaybackComplete() { completed = true; }
    }

    private EdgeStreamingCoordinator start(RecordingQueue queue, RecordingEvents events) {
        Context context = new TestContext();
        AudioCacheManager cache = new AudioCacheManager(context) {
            @Override public void cleanCacheDir(boolean all) {}
        };
        EdgeStreamingCoordinator coordinator = new EdgeStreamingCoordinator(context, cache, queue, null, events);
        coordinator.startStreaming(Arrays.asList("Một", "Hai", "Ba"), 0,
                "voice", "+0%", "+0Hz", "memory", "Book", "Chapter");
        return coordinator;
    }

    @Test
    public void nextStillAcceptsAudioFromTheSameChapterPrefetchQueue() {
        RecordingQueue queue = new RecordingQueue();
        EdgeStreamingCoordinator coordinator = start(queue, new RecordingEvents());
        coordinator.seek(1);
        int before = queue.prefetchCalls;
        // Invalid audio keeps MediaPlayer out of this JVM test; the ready event must still reach scheduling.
        AudioSource invalid = new AudioSource() {
            @Override public boolean isValid() { return false; }
            @Override public void applyTo(android.media.MediaPlayer player) {}
        };
        queue.listener.onChunkReady(1, invalid);
        assertEquals(before + 1, queue.prefetchCalls);
    }

    @Test
    public void exhaustedSynthesisFailureDoesNotSkipOrDeclareTheChapterRead() {
        RecordingQueue queue = new RecordingQueue();
        RecordingEvents events = new RecordingEvents();
        start(queue, events);
        queue.listener.onChunkFailed(0, "Network unavailable");
        assertEquals(Arrays.asList(0), queue.fetched);
        assertTrue(events.paused);
        assertFalse(events.completed);
    }
}
