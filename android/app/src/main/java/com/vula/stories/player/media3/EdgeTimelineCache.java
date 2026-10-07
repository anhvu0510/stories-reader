package com.vula.stories.player.media3;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.logging.Logger;

/** Completed audio and original-text timings form one atomic, content-addressed entry. */
public final class EdgeTimelineCache {
    public static final String DIRECTORY = "edge-timeline-v1";
    public static final long DEFAULT_BUDGET_BYTES = 32L * 1024 * 1024;
    private static final int VERSION = 1;
    // Never reuse timings produced by an older text alignment algorithm.
    private static final int ALIGNMENT_VERSION = 2;
    private static final Object DISK_LOCK = new Object();
    private static final Logger LOG = Logger.getLogger(EdgeTimelineCache.class.getName());
    private final File directory;
    private final long budget;
    public record Entry(byte[] audio, List<WordBoundary> words) {}

    public EdgeTimelineCache(File directory, long budget) {
        this.directory = directory;
        this.budget = budget;
    }

    public static String key(String text, String voice, String rate, String pitch) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(
                    (ALIGNMENT_VERSION + "\u0000" + text + "\u0000" + voice + "\u0000" + rate + "\u0000" + pitch + "\u0000mp3-24khz-48k")
                            .getBytes(StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder();
            for (byte value : bytes) key.append(String.format(Locale.ROOT, "%02x", value & 255));
            return key.toString();
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
    }

    public Entry get(String key) {
        synchronized (DISK_LOCK) {
            File file = new File(directory, key + ".bin");
            if (!file.isFile()) return null;
            try {
                Entry entry = read(file);
                file.setLastModified(System.currentTimeMillis());
                return entry;
            } catch (IOException error) {
                LOG.warning("Discarding invalid Edge cache: " + error.getMessage());
                file.delete();
                return null;
            }
        }
    }

    private Entry read(File file) throws IOException {
        try (DataInputStream input = new DataInputStream(new BufferedInputStream(new FileInputStream(file)))) {
            if (input.readInt() != VERSION) throw new IOException("Cache version mismatch");
            int length = input.readInt();
            if (length <= 0 || length > budget || length > file.length()) throw new IOException("Invalid audio length");
            byte[] audio = new byte[length];
            input.readFully(audio);
            int count = input.readInt();
            if (count < 0 || count > 10_000) throw new IOException("Invalid timeline length");
            List<WordBoundary> words = new ArrayList<>();
            for (int index = 0; index < count; index++) words.add(readWord(input));
            if (input.read() != -1) throw new IOException("Unexpected cache trailer");
            return new Entry(audio, words);
        }
    }

    private WordBoundary readWord(DataInputStream input) throws IOException {
        return new WordBoundary(input.readInt(), input.readInt(), input.readUTF(), input.readLong(), input.readLong());
    }

    public void put(String key, byte[] audio, List<WordBoundary> words) throws IOException {
        synchronized (DISK_LOCK) {
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create Edge cache");
            File temporary = File.createTempFile("entry-", ".tmp", directory);
            try {
                write(temporary, audio, words);
                File target = new File(directory, key + ".bin");
                if (!temporary.renameTo(target)) throw new IOException("Cannot publish Edge cache");
                trim();
            } finally {
                temporary.delete();
            }
        }
    }

    private void write(File file, byte[] audio, List<WordBoundary> words) throws IOException {
        try (DataOutputStream output = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(file)))) {
            output.writeInt(VERSION);
            output.writeInt(audio.length);
            output.write(audio);
            output.writeInt(words.size());
            for (WordBoundary word : words) writeWord(output, word);
        }
    }

    private void writeWord(DataOutputStream output, WordBoundary word) throws IOException {
        output.writeInt(word.getCharIndex());
        output.writeInt(word.getCharLength());
        output.writeUTF(word.getText());
        output.writeLong(word.getStartTimeMs());
        output.writeLong(word.getDurationMs());
    }

    private void trim() {
        File[] files = directory.listFiles((dir, name) -> name.endsWith(".bin"));
        if (files == null) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).thenComparing(File::getName));
        long bytes = Arrays.stream(files).mapToLong(File::length).sum();
        for (File file : files) {
            if (bytes <= budget) return;
            long length = file.length();
            if (file.delete()) bytes -= length;
        }
    }

    public void clear() {
        synchronized (DISK_LOCK) {
            File[] files = directory.listFiles();
            if (files == null) return;
            for (File file : files) file.delete();
        }
    }
}
