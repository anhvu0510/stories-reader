package com.vula.stories.player.media3;

import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import java.util.concurrent.atomic.AtomicReference;

public final class Media3ReadAloudBridge {
    public interface Listener {
        void onSnapshot(PlaybackSnapshot snapshot);
        void onUtteranceStart(String sessionId, int utteranceIndex, ReadAloudUtterance utterance);
        void onWordBoundary(String sessionId, int utteranceIndex, ReadAloudUtterance utterance, WordBoundary boundary);
        void onCompleted(String sessionId);
        void onError(String sessionId, int utteranceIndex, String code, String message);
    }

    private static final AtomicReference<ReadAloudSessionRequest> PENDING_REQUEST = new AtomicReference<>();
    private static volatile Listener listener;
    private static volatile PlaybackSnapshot latestSnapshot = PlaybackSnapshot.idle();

    private Media3ReadAloudBridge() {}

    public static void registerListener(Listener nextListener) {
        listener = nextListener;
        PlaybackSnapshot snapshot = latestSnapshot;
        if (nextListener != null && !snapshot.getSessionId().isEmpty()) nextListener.onSnapshot(snapshot);
    }

    public static void unregisterListener(Listener currentListener) {
        if (listener == currentListener) listener = null;
    }

    public static PlaybackSnapshot getLatestSnapshot() {
        return latestSnapshot;
    }

    public static void start(Context context, ReadAloudSessionRequest request) {
        PENDING_REQUEST.set(request);
        Intent intent = command(context, NativeReadAloudService.ACTION_START);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void pause(Context context) { context.startService(command(context, NativeReadAloudService.ACTION_PAUSE)); }
    public static void resume(Context context) { context.startService(command(context, NativeReadAloudService.ACTION_RESUME)); }
    public static void stop(Context context) { context.startService(command(context, NativeReadAloudService.ACTION_STOP)); }

    public static void seek(Context context, int utteranceIndex) {
        Intent intent = command(context, NativeReadAloudService.ACTION_SEEK);
        intent.putExtra(NativeReadAloudService.EXTRA_UTTERANCE_INDEX, utteranceIndex);
        context.startService(intent);
    }

    static ReadAloudSessionRequest consumePendingRequest() {
        return PENDING_REQUEST.getAndSet(null);
    }

    static void publishSnapshot(PlaybackSnapshot snapshot) {
        latestSnapshot = snapshot;
        Listener currentListener = listener;
        if (currentListener != null) currentListener.onSnapshot(snapshot);
    }

    static void publishUtteranceStart(String sessionId, int index, ReadAloudUtterance utterance) {
        Listener currentListener = listener;
        if (currentListener != null) currentListener.onUtteranceStart(sessionId, index, utterance);
    }

    static void publishWordBoundary(String sessionId, int index, ReadAloudUtterance utterance, WordBoundary boundary) {
        Listener currentListener = listener;
        if (currentListener != null) currentListener.onWordBoundary(sessionId, index, utterance, boundary);
    }

    static void publishCompleted(String sessionId) {
        Listener currentListener = listener;
        if (currentListener != null) currentListener.onCompleted(sessionId);
    }

    static void publishError(String sessionId, int index, String code, String message) {
        Listener currentListener = listener;
        if (currentListener != null) currentListener.onError(sessionId, index, code, message);
    }

    private static Intent command(Context context, String action) {
        return new Intent(context, NativeReadAloudService.class).setAction(action);
    }
}
