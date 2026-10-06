package com.vula.stories;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.vula.stories.player.source.FileAudioSource;
import com.vula.stories.player.source.MemoryAudioSource;

import org.junit.Test;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Unit Test kiểm tra tính hợp lệ của FileAudioSource và MemoryAudioSource.
 */
public class AudioSourceTest {

    @Test
    public void testFileAudioSource_validity() throws Exception {
        FileAudioSource nullSource = new FileAudioSource(null);
        assertFalse(nullSource.isValid());

        File nonExistent = new File("/non/existent/path/audio.mp3");
        FileAudioSource notFoundSource = new FileAudioSource(nonExistent);
        assertFalse(notFoundSource.isValid());

        File tempFile = File.createTempFile("test_audio", ".mp3");
        try {
            // Tệp rỗng (0 bytes) -> không hợp lệ
            FileAudioSource emptySource = new FileAudioSource(tempFile);
            assertFalse(emptySource.isValid());

            // Tệp có dữ liệu -> hợp lệ
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(new byte[]{1, 2, 3, 4});
            }
            assertTrue(emptySource.isValid());
        } finally {
            tempFile.delete();
        }
    }

    @Test
    public void testMemoryAudioSource_validity() {
        MemoryAudioSource nullSource = new MemoryAudioSource(null);
        assertFalse(nullSource.isValid());

        MemoryAudioSource emptySource = new MemoryAudioSource(new byte[0]);
        assertFalse(emptySource.isValid());

        MemoryAudioSource validSource = new MemoryAudioSource(new byte[]{1, 2, 3, 4});
        assertTrue(validSource.isValid());
    }
}
