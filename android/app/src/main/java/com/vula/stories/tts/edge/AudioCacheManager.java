package com.vula.stories.tts.edge;

import android.content.Context;
import android.util.Log;

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
    public static final int BUFFER_LOOKAHEAD = 6;
    public static final int MAX_PAST_CHUNKS_RETAINED = 3;
    public static final int MAX_TOTAL_CACHE_FILES = 25;

    private final Context context;
    private final String cacheSubDir;
    private final String fileExtension;

    public AudioCacheManager(Context context) {
        this(context, "edge_tts_cache", ".mp3");
    }

    public AudioCacheManager(Context context, String cacheSubDir, String fileExtension) {
        this.context = context.getApplicationContext();
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

    public void cleanCacheDir(boolean purgeAll) {
        try {
            File dir = getCacheDir();
            File[] files = dir.listFiles();
            if (files != null) {
                long now = System.currentTimeMillis();
                for (File f : files) {
                    if (purgeAll || (now - f.lastModified() > 60 * 60 * 1000L)) {
                        f.delete();
                    }
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
            // Tier 1: Sliding Window - Delete chunks that are far behind current reading position
            int thresholdIndex = currentChunkIndex - MAX_PAST_CHUNKS_RETAINED;
            if (thresholdIndex > 0) {
                for (Map.Entry<Integer, File> entry : readyAudioFiles.entrySet()) {
                    int idx = entry.getKey();
                    if (idx < thresholdIndex) {
                        File file = readyAudioFiles.remove(idx);
                        if (file != null && file.exists()) {
                            file.delete();
                        }
                        if (readyWordBoundaries != null) readyWordBoundaries.remove(idx);
                        if (inFlightIndices != null) inFlightIndices.remove(idx);
                    }
                }
            }

            // Tier 2: Hard File Cap - If file count still exceeds quota, delete oldest
            if (readyAudioFiles.size() > MAX_TOTAL_CACHE_FILES) {
                List<Integer> sortedIndices = new ArrayList<>(readyAudioFiles.keySet());
                Collections.sort(sortedIndices);
                int toRemove = readyAudioFiles.size() - MAX_TOTAL_CACHE_FILES;
                for (int i = 0; i < toRemove && i < sortedIndices.size(); i++) {
                    int idx = sortedIndices.get(i);
                    if (idx < currentChunkIndex) { // Never delete current playing chunk
                        File file = readyAudioFiles.remove(idx);
                        if (file != null && file.exists()) {
                            file.delete();
                        }
                        if (readyWordBoundaries != null) readyWordBoundaries.remove(idx);
                        if (inFlightIndices != null) inFlightIndices.remove(idx);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error in evictOldChunks: " + e.getMessage());
        }
    }
}
