package com.vula.stories.player.media3;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class AdaptiveBufferPolicy {
    // Sixteen 700 ms utterances cover the service's 11 s target without scanning a whole chapter.
    public static final int MAX_LOOKAHEAD_UTTERANCES = 16;
    private final long lowWatermarkMs;
    private final long targetWatermarkMs;

    public AdaptiveBufferPolicy(long lowWatermarkMs, long targetWatermarkMs) {
        if (lowWatermarkMs < 0L || targetWatermarkMs < lowWatermarkMs) {
            throw new IllegalArgumentException("Invalid audio buffer watermarks");
        }
        this.lowWatermarkMs = lowWatermarkMs;
        this.targetWatermarkMs = targetWatermarkMs;
    }

    public boolean shouldBuffer(long bufferedDurationMs) {
        return bufferedDurationMs < lowWatermarkMs;
    }

    public List<Integer> planIndices(
            int currentIndex,
            int totalUtterances,
            List<Long> estimatedDurationsMs
    ) {
        if (currentIndex < 0 || currentIndex >= totalUtterances) return Collections.emptyList();

        List<Integer> indices = new ArrayList<>();
        indices.add(currentIndex);
        long plannedDurationMs = 0L;
        // Current playback is not lookahead. Always prepare at least the next utterance,
        // even when the current sentence alone exceeds the target watermark.
        for (int offset = 1; currentIndex + offset < totalUtterances && offset <= MAX_LOOKAHEAD_UTTERANCES; offset++) {
            if (offset > 1 && plannedDurationMs >= targetWatermarkMs) break;
            indices.add(currentIndex + offset);
            plannedDurationMs += durationAt(estimatedDurationsMs, offset);
        }
        return indices;
    }

    private long durationAt(List<Long> durations, int index) {
        if (durations == null || index >= durations.size()) return lowWatermarkMs;
        return Math.max(0L, durations.get(index));
    }
}
