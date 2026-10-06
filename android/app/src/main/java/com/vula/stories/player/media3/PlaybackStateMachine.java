package com.vula.stories.player.media3;

public final class PlaybackStateMachine {
    private PlaybackSnapshot snapshot = PlaybackSnapshot.idle();

    public synchronized void start(String sessionId, int utteranceIndex) {
        snapshot = new PlaybackSnapshot(
                sessionId,
                PlaybackSnapshot.State.CONNECTING,
                utteranceIndex,
                0L,
                0L,
                0,
                null
        );
    }

    public synchronized boolean transition(
            String sessionId,
            PlaybackSnapshot.State state,
            int utteranceIndex,
            long positionMs,
            long bufferedDurationMs
    ) {
        if (!snapshot.getSessionId().equals(sessionId)) return false;
        int rebufferCount = snapshot.getRebufferCount();
        if (state == PlaybackSnapshot.State.BUFFERING && snapshot.getState() == PlaybackSnapshot.State.PLAYING) {
            rebufferCount += 1;
        }
        snapshot = new PlaybackSnapshot(
                sessionId,
                state,
                utteranceIndex,
                Math.max(0L, positionMs),
                Math.max(0L, bufferedDurationMs),
                rebufferCount,
                null
        );
        return true;
    }

    public synchronized boolean fail(String sessionId, int utteranceIndex, String errorCode) {
        if (!snapshot.getSessionId().equals(sessionId)) return false;
        snapshot = new PlaybackSnapshot(
                sessionId,
                PlaybackSnapshot.State.ERROR,
                utteranceIndex,
                snapshot.getPositionMs(),
                snapshot.getBufferedDurationMs(),
                snapshot.getRebufferCount(),
                errorCode
        );
        return true;
    }

    public synchronized PlaybackSnapshot snapshot() {
        return snapshot;
    }
}
