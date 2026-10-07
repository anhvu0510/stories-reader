package com.vula.stories;

import android.content.Context;
import android.content.ContextWrapper;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.vula.stories.player.media3.Media3PlaybackAdapter;
import com.vula.stories.player.media3.PlaybackSnapshot;
import org.junit.Test;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;

public class Media3PlaybackAdapterTest {
    private Media3PlaybackAdapter start(List<JSObject> events) {
        Context context = new ContextWrapper(null) {
            @Override public Context getApplicationContext() { return this; }
        };
        Media3PlaybackAdapter adapter = new Media3PlaybackAdapter((name, data) -> events.add(data));
        JSArray chunks = new JSArray();
        chunks.put("Một");
        assertTrue(adapter.startPlayback(context, chunks, null, 0, "voice", "+0%", "+0Hz", "Book", "Chapter", "new"));
        events.clear();
        return adapter;
    }

    @Test
    public void staleCompletionCannotRouteNewMedia3NextToLegacyPlayer() {
        List<JSObject> events = new ArrayList<>();
        Media3PlaybackAdapter adapter = start(events);
        adapter.onSnapshot(new PlaybackSnapshot("old", PlaybackSnapshot.State.COMPLETED, 0, 0L, 0L, 0, null));
        adapter.onCompleted("old");
        assertTrue(adapter.isMedia3Active());
        assertTrue(events.isEmpty());
        adapter.unregister();
    }

    @Test
    public void seekingReportsBufferingUntilTargetAudioIsReady() {
        List<JSObject> events = new ArrayList<>();
        Media3PlaybackAdapter adapter = start(events);
        adapter.onSnapshot(new PlaybackSnapshot("new", PlaybackSnapshot.State.SEEKING, 0, 0L, 0L, 0, null));
        assertTrue(events.get(events.size() - 1).optBoolean("isBuffering"));
        adapter.unregister();
    }
}
