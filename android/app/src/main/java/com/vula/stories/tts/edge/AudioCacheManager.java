package com.vula.stories.tts.edge;

import android.content.Context;
import android.util.Log;

import com.vula.stories.player.source.AudioSource;
import com.vula.stories.player.source.FileAudioSource;

import org.json.JSONArray;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Manages audio cache files on disk, enforcing Sliding Window retention and LRU eviction.
 */
public class AudioCacheManager {
    private static final String TAG = "AudioCacheManager";
    public static final int BUFFER_LOOKAHEAD = 10;
    public static final int MAX_PAST_CHUNKS_RETAINED = 0;
    public static final int MAX_TOTAL_CACHE_FILES = 25;

    private final Context context;
    private final String cacheSubDir;
    private final String fileExtension;

    public AudioCacheManager(Context context) {
        this(context, "edge_tts_cache", ".mp3");
    }

    public AudioCacheManager(Context context, String cacheSubDir, String fileExtension) {
        this.context = context != null ? context.getApplicationContext() : null;
        this.cacheSubDir = cacheSubDir != null ? cacheSubDir : "edge_tts_cache";
        this.fileExtension = fileExtension != null ? fileExtension : ".mp3";
    }

    public File getCacheDir() {
        File dir = new File(context.getCacheDir(), cacheSubDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    public File getChunkFile(int index) {
        return new File(getCacheDir(), "chunk_" + index + fileExtension);
    }

    private void deleteFileSafely(File file) {
        if (file != null && file.exists()) {
            file.delete();
        }
    }

    private void removeMetadata(int idx, Map<Integer, JSONArray> readyWordBoundaries, Set<Integer> inFlightIndices) {
        if (readyWordBoundaries != null) {
            readyWordBoundaries.remove(idx);
        }
        if (inFlightIndices != null) {
            inFlightIndices.remove(idx);
        }
    }

    public void cleanCacheDir(boolean purgeAll) {
        try {
            File dir = getCacheDir();
            File[] files = dir.listFiles();
            if (files == null) {
                return;
            }
            long now = System.currentTimeMillis();
            for (File f : files) {
                if (purgeAll || (now - f.lastModified() > 60 * 60 * 1000L)) {
                    f.delete();
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error cleaning cache directory: " + e.getMessage());
        }
    }

    public void evictOldChunks(
            int currentChunkIndex,
            Map<Integer, File> readyAudioFiles,
            Map<Integer, JSONArray> readyWordBoundaries,
            Set<Integer> inFlightIndices
    ) {
        try {
            int thresholdIndex = currentChunkIndex - MAX_PAST_CHUNKS_RETAINED;
            for (Map.Entry<Integer, File> entry : readyAudioFiles.entrySet()) {
                int idx = entry.getKey();
                if (idx >= thresholdIndex) {
                    continue;
                }
                File file = readyAudioFiles.remove(idx);
                deleteFileSafely(file);
                removeMetadata(idx, readyWordBoundaries, inFlightIndices);
            }

            if (readyAudioFiles.size() <= MAX_TOTAL_CACHE_FILES) {
                return;
            }
            List<Integer> sortedIndices = new ArrayList<>(readyAudioFiles.keySet());
            Collections.sort(sortedIndices);
            int toRemove = readyAudioFiles.size() - MAX_TOTAL_CACHE_FILES;
            for (int i = 0; i < toRemove && i < sortedIndices.size(); i++) {
                int idx = sortedIndices.get(i);
                if (idx >= currentChunkIndex) {
                    continue;
                }
                File file = readyAudioFiles.remove(idx);
                deleteFileSafely(file);
                removeMetadata(idx, readyWordBoundaries, inFlightIndices);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error in evictOldChunks: " + e.getMessage());
        }
    }

    public void evictOldSources(
            int currentChunkIndex,
            Map<Integer, AudioSource> readySources,
            Map<Integer, JSONArray> readyWordBoundaries,
            Set<Integer> inFlightIndices
    ) {
        if (readySources == null) {
            return;
        }
        try {
            int thresholdIndex = currentChunkIndex - MAX_PAST_CHUNKS_RETAINED;
            for (Map.Entry<Integer, AudioSource> entry : readySources.entrySet()) {
                int idx = entry.getKey();
                if (idx >= thresholdIndex) {
                    continue;
                }
                AudioSource src = readySources.remove(idx);
                if (src instanceof FileAudioSource) {
                    deleteFileSafely(((FileAudioSource) src).getFile());
                }
                removeMetadata(idx, readyWordBoundaries, inFlightIndices);
            }

            if (readySources.size() <= MAX_TOTAL_CACHE_FILES) {
                return;
            }
            List<Integer> sortedIndices = new ArrayList<>(readySources.keySet());
            Collections.sort(sortedIndices);
            int toRemove = readySources.size() - MAX_TOTAL_CACHE_FILES;
            for (int i = 0; i < toRemove && i < sortedIndices.size(); i++) {
                int idx = sortedIndices.get(i);
                if (idx >= currentChunkIndex) {
                    continue;
                }
                AudioSource src = readySources.remove(idx);
                if (src instanceof FileAudioSource) {
                    deleteFileSafely(((FileAudioSource) src).getFile());
                }
                removeMetadata(idx, readyWordBoundaries, inFlightIndices);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error in evictOldSources: " + e.getMessage());
        }
    }

    public void evictOldMemoryChunks(
            int currentChunkIndex,
            Map<Integer, byte[]> readyAudioBytes,
            Map<Integer, JSONArray> readyWordBoundaries,
            Set<Integer> inFlightIndices
    ) {
        if (readyAudioBytes == null) {
            return;
        }
        try {
            int thresholdIndex = currentChunkIndex - MAX_PAST_CHUNKS_RETAINED;
            for (Integer idx : new ArrayList<>(readyAudioBytes.keySet())) {
                if (idx == null || idx >= thresholdIndex) {
                    continue;
                }
                readyAudioBytes.remove(idx);
                removeMetadata(idx, readyWordBoundaries, inFlightIndices);
            }

            if (readyAudioBytes.size() <= MAX_TOTAL_CACHE_FILES) {
                return;
            }
            List<Integer> sortedIndices = new ArrayList<>(readyAudioBytes.keySet());
            Collections.sort(sortedIndices);
            int toRemove = readyAudioBytes.size() - MAX_TOTAL_CACHE_FILES;
            for (int i = 0; i < toRemove && i < sortedIndices.size(); i++) {
                Integer idx = sortedIndices.get(i);
                if (idx == null || idx >= currentChunkIndex) {
                    continue;
                }
                readyAudioBytes.remove(idx);
                removeMetadata(idx, readyWordBoundaries, inFlightIndices);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error in evictOldMemoryChunks: " + e.getMessage());
        }
    }
}
