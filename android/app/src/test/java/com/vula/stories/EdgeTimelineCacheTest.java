package com.vula.stories;

import com.vula.stories.player.media3.EdgeTimelineCache;
import com.vula.stories.player.media3.WordBoundary;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

public class EdgeTimelineCacheTest {
    @Test public void reopensAudioWithItsOwnTimelineAndSeparatesVoiceAndRate() throws Exception {
        File directory = Files.createTempDirectory("edge-cache-test").toFile();
        try {
            EdgeTimelineCache cache = new EdgeTimelineCache(directory, 1024);
            String key = EdgeTimelineCache.key("Một", "voice-a", "+0%", "+0Hz");
            cache.put(key, new byte[] {1, 2, 3}, List.of(new WordBoundary(0, 3, "Một", 100, 80)));
            EdgeTimelineCache.Entry entry = new EdgeTimelineCache(directory, 1024).get(key);
            assertArrayEquals(new byte[] {1, 2, 3}, entry.audio());
            assertEquals(80, entry.words().get(0).getDurationMs());
            assertNull(cache.get(EdgeTimelineCache.key("Một", "voice-b", "+0%", "+0Hz")));
            assertNull(cache.get(EdgeTimelineCache.key("Một", "voice-a", "+80%", "+0Hz")));
            cache.clear();
            assertNull(cache.get(key));
        } finally {
            for (File file : directory.listFiles()) file.delete();
            directory.delete();
        }
    }
    @Test public void evictsOldEntriesByBytesAndNeverAcceptsAPartialFile() throws Exception {
        File directory = Files.createTempDirectory("edge-cache-budget").toFile();
        try {
            EdgeTimelineCache cache = new EdgeTimelineCache(directory, 180);
            String first = EdgeTimelineCache.key("first", "v", "0", "0");
            String second = EdgeTimelineCache.key("second", "v", "0", "0");
            cache.put(first, new byte[100], List.of());
            new File(directory, first + ".bin").setLastModified(1L);
            cache.put(second, new byte[100], List.of());
            assertNull(cache.get(first));
            assertNotNull(cache.get(second));
            Files.write(new File(directory, second + ".bin").toPath(), new byte[] {0});
            assertNull(cache.get(second));
        } finally {
            for (File file : directory.listFiles()) file.delete();
            directory.delete();
        }
    }
}
