package com.vula.stories.player.media3;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class AdaptiveBufferPolicy {
    // Sixteen 700 ms utterances cover the service's 11 s target without scanning a whole chapter.
    public static final int MAX_LOOKAHEAD_UTTERANCES = 16;
    private final long lowWatermarkMs;
    private final long targetWatermarkMs;
    private final List<Long> synthesisTimes = new ArrayList<>();
    private long adaptiveTargetMs;

    public AdaptiveBufferPolicy(long lowWatermarkMs, long targetWatermarkMs) {
        if (lowWatermarkMs < 0L || targetWatermarkMs < lowWatermarkMs) {
            throw new IllegalArgumentException("Invalid audio buffer watermarks");
        }
        this.lowWatermarkMs = lowWatermarkMs;
        this.targetWatermarkMs = targetWatermarkMs;
        this.adaptiveTargetMs = targetWatermarkMs;
    }

    public void observeSynthesis(long elapsedMs) {
        synthesisTimes.add(Math.max(0L, elapsedMs));
        if (synthesisTimes.size() > 8) synthesisTimes.remove(0);
        long slowest = Collections.max(synthesisTimes);
        adaptiveTargetMs = Math.max(targetWatermarkMs, Math.min(30_000L, slowest * 2L + 2_000L));
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
            if (offset > 1 && plannedDurationMs >= adaptiveTargetMs) break;
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
