package com.vula.stories.player.media3;

import com.vula.stories.tts.edge.EdgeAuth;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public final class EdgeStreamingSynthesizer {
    public interface Listener {
        void onAudio(byte[] bytes);
        void onWordBoundary(WordBoundary boundary);
        void onComplete();
        void onFailure(IOException error);
    }

    private final OkHttpClient httpClient;
    private final WebSocket.Factory webSockets;

    public EdgeStreamingSynthesizer() {
        this(new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build());
    }

    public EdgeStreamingSynthesizer(WebSocket.Factory webSockets) {
        this.webSockets = webSockets;
        this.httpClient = webSockets instanceof OkHttpClient client ? client : null;
    }

    public WebSocket synthesize(ReadAloudUtterance utterance, String voice, String rate, String pitch, Listener listener) {
        String sourceText = Normalizer.normalize(utterance.getText(), Normalizer.Form.NFC);
        SpeechTextMap textMap = new SpeechTextMap(utterance.getText());
        AtomicBoolean finished = new AtomicBoolean(false);
        String requestId = UUID.randomUUID().toString().replace("-", "");
        Request request = EdgeAuth.buildWebSocketRequest(EdgeAuth.buildWebSocketUrl());

        return webSockets.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                webSocket.send(EdgeAuth.buildSpeechConfigMessage());
                webSocket.send(EdgeAuth.buildSsmlMessage(requestId, voice, rate, pitch, sourceText));
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString payload) {
                if (finished.get()) return;
                byte[] frame = payload.toByteArray();
                if (frame.length < 2) return;
                ByteBuffer buffer = ByteBuffer.wrap(frame);
                int headerLength = buffer.getShort() & 0xFFFF;
                if (frame.length <= 2 + headerLength) return;
                String headers = new String(frame, 2, headerLength, StandardCharsets.UTF_8);
                if (!headers.contains("Path:audio")) return;
                int audioOffset = 2 + headerLength;
                byte[] audio = new byte[frame.length - audioOffset];
                System.arraycopy(frame, audioOffset, audio, 0, audio.length);
                listener.onAudio(audio);
            }

            @Override
            public void onMessage(WebSocket webSocket, String payload) {
                if (finished.get()) return;
                try {
                    if (payload.contains("Path:audio.metadata")) {
                        emitMetadata(payload, textMap, listener);
                    }
                    if (!payload.contains("Path:turn.end")) return;
                    if (!finished.compareAndSet(false, true)) return;
                    listener.onComplete();
                    webSocket.close(1000, "Complete");
                } catch (Exception error) {
                    failOnce(finished, listener, new IOException("Invalid Edge metadata", error));
                    webSocket.cancel();
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable error, Response response) {
                String status = response == null ? "" : " (HTTP " + response.code() + ")";
                failOnce(finished, listener, new IOException("Edge synthesis failed" + status + ": " + error.getMessage(), error));
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                failOnce(finished, listener, new IOException("Edge closed before turn.end: " + code + " " + reason));
                webSocket.close(code, reason);
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                failOnce(finished, listener, new IOException("Edge closed before turn.end: " + code + " " + reason));
            }
        });
    }

    public void shutdown() {
        if (httpClient == null) return;
        httpClient.dispatcher().executorService().shutdownNow();
        httpClient.connectionPool().evictAll();
    }

    private static void emitMetadata(
            String payload,
            SpeechTextMap textMap,
            Listener listener
    ) throws Exception {
        int bodyStart = payload.indexOf("\r\n\r\n");
        if (bodyStart < 0) return;
        JSONObject root = new JSONObject(payload.substring(bodyStart + 4).trim());
        JSONArray metadata = root.optJSONArray("Metadata");
        if (metadata == null) return;

        for (int index = 0; index < metadata.length(); index++) {
            JSONObject item = metadata.optJSONObject(index);
            if (item == null || !"WordBoundary".equalsIgnoreCase(item.optString("Type"))) continue;
            JSONObject data = item.optJSONObject("Data");
            if (data == null) continue;
            JSONObject textData = data.optJSONObject("text");
            String rawWord = textData == null ? "" : textData.optString("Text", "").trim();
            if (rawWord.isEmpty()) continue;
            long startTimeMs = data.optLong("Offset", 0L) / 10_000L;
            WordBoundary word = textMap.find(rawWord, startTimeMs, data.optLong("Duration", 0L) / 10_000L);
            if (word != null) listener.onWordBoundary(word);
        }
    }

    private static void failOnce(AtomicBoolean finished, Listener listener, IOException error) {
        if (!finished.compareAndSet(false, true)) return;
        listener.onFailure(error);
    }
}
