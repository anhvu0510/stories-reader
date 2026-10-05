package com.vula.stories.player.media3;

public final class PlaybackSnapshot {
    public enum State {
        IDLE,
        CONNECTING,
        BUFFERING,
        PLAYING,
        SEEKING,
        PAUSED,
        COMPLETED,
        ERROR
    }

    private final String sessionId;
    private final State state;
    private final int utteranceIndex;
    private final long positionMs;
    private final long bufferedDurationMs;
    private final int rebufferCount;
    private final String errorCode;
    private final long firstAudioLatencyMs;
    private final long lastBufferingDurationMs;

    public PlaybackSnapshot(
            String sessionId,
            State state,
            int utteranceIndex,
            long positionMs,
            long bufferedDurationMs,
            int rebufferCount,
            String errorCode
    ) {
        this(sessionId, state, utteranceIndex, positionMs, bufferedDurationMs, rebufferCount, errorCode, -1L, -1L);
    }

    public PlaybackSnapshot(
            String sessionId,
            State state,
            int utteranceIndex,
            long positionMs,
            long bufferedDurationMs,
            int rebufferCount,
            String errorCode,
            long firstAudioLatencyMs,
            long lastBufferingDurationMs
    ) {
        this.sessionId = sessionId;
        this.state = state;
        this.utteranceIndex = utteranceIndex;
        this.positionMs = positionMs;
        this.bufferedDurationMs = bufferedDurationMs;
        this.rebufferCount = rebufferCount;
        this.errorCode = errorCode;
        this.firstAudioLatencyMs = firstAudioLatencyMs;
        this.lastBufferingDurationMs = lastBufferingDurationMs;
    }

    public static PlaybackSnapshot idle() {
        return new PlaybackSnapshot("", State.IDLE, -1, 0L, 0L, 0, null);
    }

    public String getSessionId() { return sessionId; }
    public State getState() { return state; }
    public int getUtteranceIndex() { return utteranceIndex; }
    public long getPositionMs() { return positionMs; }
    public long getBufferedDurationMs() { return bufferedDurationMs; }
    public int getRebufferCount() { return rebufferCount; }
    public String getErrorCode() { return errorCode; }
    public long getFirstAudioLatencyMs() { return firstAudioLatencyMs; }
    public long getLastBufferingDurationMs() { return lastBufferingDurationMs; }

    public PlaybackSnapshot withMetrics(long firstAudioLatency, long lastBufferingDuration) {
        return new PlaybackSnapshot(
                sessionId,
                state,
                utteranceIndex,
                positionMs,
                bufferedDurationMs,
                rebufferCount,
                errorCode,
                firstAudioLatency,
                lastBufferingDuration
        );
    }
}
