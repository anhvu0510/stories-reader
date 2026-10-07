package com.vula.stories.player.media3;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Adapter chuyên biệt hóa việc tích hợp giữa Media3 ExoPlayer và Capacitor Plugin.
 * Đóng gói toàn bộ logic lắng nghe snapshot, utterance events, word boundary và parse DTO.
 */
public class Media3PlaybackAdapter implements Media3ReadAloudBridge.Listener {

    public interface EventDispatcher {
        void sendEvent(String eventName, JSObject data);
    }

    private final EventDispatcher eventDispatcher;
    private boolean isMedia3Active = false;
    private int currentPlayIndex = 0;
    private String activeSessionId;

    public Media3PlaybackAdapter(EventDispatcher eventDispatcher) {
        this.eventDispatcher = eventDispatcher;
    }

    public boolean isMedia3Active() {
        return isMedia3Active;
    }

    public int getCurrentPlayIndex() {
        return currentPlayIndex;
    }

    public void register() {
        Media3ReadAloudBridge.registerListener(this);
    }

    public void unregister() {
        Media3ReadAloudBridge.unregisterListener(this);
        isMedia3Active = false;
        activeSessionId = null;
    }

    public void pause(Context context) {
        Media3ReadAloudBridge.pause(context);
    }

    public void resume(Context context) {
        Media3ReadAloudBridge.resume(context);
    }

    public void stop(Context context) {
        Media3ReadAloudBridge.stop(context);
        unregister();
    }

    public void seek(Context context, int targetIndex) {
        Media3ReadAloudBridge.seek(context, targetIndex);
    }

    public JSObject getLatestSnapshotJs() {
        return snapshotToJs(Media3ReadAloudBridge.getLatestSnapshot());
    }

    public boolean startPlayback(
            Context context,
            JSArray chunksArray,
            JSArray utterancesArray,
            int startIndex,
            String voice,
            String rate,
            String pitch,
            String bookTitle,
            String chapterTitle,
            String requestedSessionId
    ) {
        List<String> legacyChunks = parseChunks(chunksArray);
        List<ReadAloudUtterance> utterances = parseUtterances(utterancesArray);
        if (utterances.isEmpty()) {
            utterances = ReadAloudRequestNormalizer.fromLegacyChunks(legacyChunks);
        }
        if (utterances.isEmpty()) {
            return false;
        }

        int safeStartIndex = Math.max(0, Math.min(startIndex, utterances.size() - 1));
        String sessionId = (requestedSessionId != null && !requestedSessionId.isEmpty())
                ? requestedSessionId
                : UUID.randomUUID().toString();

        currentPlayIndex = safeStartIndex;
        activeSessionId = sessionId;
        isMedia3Active = true;
        Media3ReadAloudBridge.registerListener(this);
        Media3ReadAloudBridge.start(
                context,
                new ReadAloudSessionRequest(
                        sessionId,
                        utterances,
                        safeStartIndex,
                        voice,
                        rate,
                        pitch,
                        bookTitle,
                        chapterTitle
                )
        );
        return true;
    }

    public static List<String> parseChunks(JSArray chunksArray) {
        if (chunksArray == null) {
            return Collections.emptyList();
        }
        List<String> chunks = new ArrayList<>();
        for (int index = 0; index < chunksArray.length(); index++) {
            chunks.add(chunksArray.optString(index, ""));
        }
        return chunks;
    }

    public static List<ReadAloudUtterance> parseUtterances(JSArray utterancesArray) {
        if (utterancesArray == null || utterancesArray.length() == 0) {
            return Collections.emptyList();
        }
        List<ReadAloudUtterance> utterances = new ArrayList<>();
        for (int index = 0; index < utterancesArray.length(); index++) {
            JSONObject item = utterancesArray.optJSONObject(index);
            if (item == null) {
                continue;
            }
            String text = item.optString("text", "").trim();
            if (text.isEmpty()) {
                continue;
            }
            utterances.add(new ReadAloudUtterance(
                    item.optString("id", "utterance-" + index),
                    item.optInt("paragraphIndex", index),
                    item.optInt("sourceStart", 0),
                    item.optInt("sourceLength", text.length()),
                    text,
                    item.optInt("sourceChunkIndex", index)
            ));
        }
        return utterances;
    }

    @Override
    public void onSnapshot(PlaybackSnapshot snapshot) {
        if (activeSessionId == null) activeSessionId = snapshot.getSessionId();
        if (!matchesSession(snapshot.getSessionId())) return;
        boolean isTerminal = snapshot.getState() == PlaybackSnapshot.State.IDLE
                || snapshot.getState() == PlaybackSnapshot.State.COMPLETED
                || snapshot.getState() == PlaybackSnapshot.State.ERROR;
        isMedia3Active = !isTerminal;

        JSObject event = snapshotToJs(snapshot);
        eventDispatcher.sendEvent("onPlaybackSnapshot", event);

        JSObject legacyState = new JSObject();
        legacyState.put("sessionId", snapshot.getSessionId());
        legacyState.put("isPlaying", snapshot.getState() == PlaybackSnapshot.State.PLAYING);
        legacyState.put("isPaused", snapshot.getState() == PlaybackSnapshot.State.PAUSED);
        legacyState.put("isBuffering", snapshot.getState() == PlaybackSnapshot.State.CONNECTING
                || snapshot.getState() == PlaybackSnapshot.State.BUFFERING
                || snapshot.getState() == PlaybackSnapshot.State.SEEKING);
        eventDispatcher.sendEvent("onPlaybackStateChange", legacyState);
    }

    @Override
    public void onUtteranceStart(String sessionId, int utteranceIndex, ReadAloudUtterance utterance) {
        if (!matchesSession(sessionId)) return;
        currentPlayIndex = utteranceIndex;
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        event.put("chunkIndex", utterance.getSourceChunkIndex());
        event.put("utteranceIndex", utteranceIndex);
        event.put("paragraphIndex", utterance.getParagraphIndex());
        event.put("sourceStart", utterance.getSourceStart());
        event.put("sourceLength", utterance.getSourceLength());
        eventDispatcher.sendEvent("onChunkStart", event);
    }

    @Override
    public void onWordBoundary(String sessionId, int utteranceIndex, ReadAloudUtterance utterance, WordBoundary boundary) {
        if (!matchesSession(sessionId)) return;
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        event.put("chunkIndex", utterance.getSourceChunkIndex());
        event.put("utteranceIndex", utteranceIndex);
        event.put("paragraphIndex", utterance.getParagraphIndex());
        event.put("sourceStart", utterance.getSourceStart());
        event.put("sourceLength", utterance.getSourceLength());
        event.put("charIndex", boundary.getCharIndex());
        event.put("charLength", boundary.getCharLength());
        event.put("text", boundary.getText());
        eventDispatcher.sendEvent("onWordBoundary", event);
    }

    @Override
    public void onCompleted(String sessionId) {
        if (!matchesSession(sessionId)) return;
        isMedia3Active = false;
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        eventDispatcher.sendEvent("onPlaybackComplete", event);
    }

    @Override
    public void onError(String sessionId, int utteranceIndex, String code, String message) {
        if (!matchesSession(sessionId)) return;
        JSObject event = new JSObject();
        event.put("sessionId", sessionId);
        event.put("chunkIndex", utteranceIndex);
        event.put("code", code);
        event.put("message", message);
        eventDispatcher.sendEvent("onError", event);
    }

    private boolean matchesSession(String sessionId) {
        return activeSessionId != null && activeSessionId.equals(sessionId);
    }

    public static JSObject snapshotToJs(PlaybackSnapshot snapshot) {
        JSObject event = new JSObject();
        if (snapshot == null) {
            return event;
        }
        event.put("sessionId", snapshot.getSessionId());
        event.put("state", snapshot.getState().name());
        event.put("utteranceIndex", snapshot.getUtteranceIndex());
        event.put("positionMs", snapshot.getPositionMs());
        event.put("bufferedDurationMs", snapshot.getBufferedDurationMs());
        event.put("rebufferCount", snapshot.getRebufferCount());
        event.put("firstAudioLatencyMs", snapshot.getFirstAudioLatencyMs());
        event.put("lastBufferingDurationMs", snapshot.getLastBufferingDurationMs());
        if (snapshot.getErrorCode() != null) {
            event.put("errorCode", snapshot.getErrorCode());
        }
        return event;
    }
}
