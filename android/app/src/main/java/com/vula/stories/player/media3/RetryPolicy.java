package com.vula.stories.player.media3;

public final class RetryPolicy {
    private final int maxRetries;
    private final long baseDelayMs;
    private final long maxDelayMs;

    public RetryPolicy(int maxRetries, long baseDelayMs, long maxDelayMs) {
        this.maxRetries = Math.max(0, maxRetries);
        this.baseDelayMs = Math.max(0L, baseDelayMs);
        this.maxDelayMs = Math.max(this.baseDelayMs, maxDelayMs);
    }

    public boolean canRetry(int completedAttempts) {
        return completedAttempts < maxRetries;
    }

    public long delayMillis(int attempt, double jitterFraction) {
        int safeAttempt = Math.max(0, Math.min(attempt, 30));
        long exponentialDelay = baseDelayMs * (1L << safeAttempt);
        long boundedDelay = Math.min(maxDelayMs, exponentialDelay);
        double boundedJitter = Math.max(-0.5, Math.min(0.5, jitterFraction));
        return Math.max(0L, Math.round(boundedDelay * (1.0 + boundedJitter)));
    }
}
