package com.vula.stories.tts.edge;

import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * Quản lý kết nối mạng WebSocket tới máy chủ Bing Edge TTS.
 * Đóng gói quy trình bắt tay, gửi SSML, phân giải luồng âm thanh nhị phân và siêu dữ liệu từ ngữ.
 */
public class EdgeWebSocketClient {

    private static final String TAG = "EdgeWebSocketClient";

    public interface SynthesisListener {
        void onOpen();
        void onAudioChunk(byte[] chunk);
        void onWordBoundary(JSONObject boundary);
        void onComplete(byte[] fullAudio);
        void onFailure(int statusCode, String message, Throwable cause);
    }

    private final OkHttpClient httpClient;

    public EdgeWebSocketClient() {
        this(new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build());
    }

    public EdgeWebSocketClient(OkHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * Bắt đầu phiên tổng hợp giọng nói cho một đoạn văn bản.
     */
    public WebSocket synthesize(
            String text,
            String voice,
            String rate,
            String pitch,
            SynthesisListener listener
    ) {
        if (text == null || text.trim().isEmpty()) {
            if (listener != null) {
                listener.onFailure(400, "Văn bản rỗng", null);
            }
            return null;
        }

        String requestId = UUID.randomUUID().toString().replace("-", "");
        String sourceText = Normalizer.normalize(text, Normalizer.Form.NFC);
        String foldedSourceText = sourceText.toLowerCase(Locale.ROOT);
        int[] searchOffset = {0};

        ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
        AtomicBoolean isCompleted = new AtomicBoolean(false);

        String wssUrl = EdgeAuth.buildWebSocketUrl();
        Request request = EdgeAuth.buildWebSocketRequest(wssUrl);

        return httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                try {
                    webSocket.send(EdgeAuth.buildSpeechConfigMessage());
                    webSocket.send(EdgeAuth.buildSsmlMessage(requestId, voice, rate, pitch, sourceText));
                    if (listener != null) {
                        listener.onOpen();
                    }
                } catch (Exception ex) {
                    Log.e(TAG, "Lỗi khi gửi cấu hình bắt tay SSML: " + ex.getMessage());
                    if (listener != null) {
                        listener.onFailure(500, "Lỗi gửi SSML", ex);
                    }
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                byte[] audio = EdgeAudioFrameExtractor.extractAudioBytes(bytes);
                if (audio == null || audio.length == 0) {
                    return;
                }

                synchronized (audioBuffer) {
                    audioBuffer.write(audio, 0, audio.length);
                }

                if (listener != null) {
                    listener.onAudioChunk(audio);
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, String textMsg) {
                if (textMsg == null) {
                    return;
                }

                if (EdgeMetadataParser.isMetadataFrame(textMsg)) {
                    List<JSONObject> boundaries = EdgeMetadataParser.parseWordBoundaries(textMsg, foldedSourceText, searchOffset);
                    if (listener != null && !boundaries.isEmpty()) {
                        for (JSONObject wb : boundaries) {
                            listener.onWordBoundary(wb);
                        }
                    }
                    return;
                }

                if (EdgeMetadataParser.isTurnEnd(textMsg)) {
                    if (!isCompleted.compareAndSet(false, true)) {
                        return;
                    }
                    byte[] fullAudio;
                    synchronized (audioBuffer) {
                        fullAudio = audioBuffer.toByteArray();
                    }
                    if (listener != null) {
                        listener.onComplete(fullAudio);
                    }
                    webSocket.close(1000, "Hoàn tất tổng hợp");
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                if (!isCompleted.compareAndSet(false, true)) {
                    return;
                }
                int statusCode = response != null ? response.code() : 0;
                String errorMsg = t != null ? t.getMessage() : "Lỗi mạng WebSocket không xác định";
                Log.w(TAG, "Kết nối WebSocket Edge TTS thất bại (" + statusCode + "): " + errorMsg);
                if (listener != null) {
                    listener.onFailure(statusCode, errorMsg, t);
                }
            }
        });
    }

    public void shutdown() {
        if (httpClient != null) {
            httpClient.dispatcher().executorService().shutdownNow();
            httpClient.connectionPool().evictAll();
        }
    }
}
