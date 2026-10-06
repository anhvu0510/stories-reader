package com.vula.stories.tts.edge;

import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONObject;

import okhttp3.OkHttpClient;

/**
 * Xử lý yêu cầu tổng hợp âm thanh đơn lẻ (Single-shot Synthesis).
 * Nhận văn bản, gọi WebSocket và đóng gói kết quả nhị phân Base64 kèm ranh giới từ ngữ.
 */
public class EdgeSingleSynthesizer {

    public interface Callback {
        void onSuccess(String base64Audio, JSArray wordBoundaries);
        void onError(int statusCode, String message);
    }

    private final EdgeWebSocketClient client;

    public EdgeSingleSynthesizer(OkHttpClient httpClient) {
        this.client = new EdgeWebSocketClient(httpClient);
    }

    public void synthesize(
            String text,
            String voice,
            String rate,
            String pitch,
            Callback callback
    ) {
        if (text == null || text.trim().isEmpty()) {
            if (callback != null) {
                callback.onError(400, "Văn bản rỗng");
            }
            return;
        }

        JSArray wordBoundaries = new JSArray();
        client.synthesize(text, voice, rate, pitch, new EdgeWebSocketClient.SynthesisListener() {
            @Override
            public void onOpen() {
                // Kết nối mở thành công
            }

            @Override
            public void onAudioChunk(byte[] chunk) {
                // Nhận chunk âm thanh
            }

            @Override
            public void onWordBoundary(JSONObject boundary) {
                if (boundary == null) {
                    return;
                }
                JSObject item = new JSObject();
                item.put("offset", boundary.optLong("offset", 0));
                item.put("duration", boundary.optLong("duration", 0));
                item.put("text", boundary.optString("text", ""));
                item.put("charIndex", boundary.optInt("charIndex", 0));
                item.put("charLength", boundary.optInt("charLength", 0));
                wordBoundaries.put(item);
            }

            @Override
            public void onComplete(byte[] fullAudio) {
                if (fullAudio == null || fullAudio.length == 0) {
                    if (callback != null) {
                        callback.onError(500, "Không nhận được dữ liệu âm thanh");
                    }
                    return;
                }
                String base64 = Base64.encodeToString(fullAudio, Base64.NO_WRAP);
                if (callback != null) {
                    callback.onSuccess(base64, wordBoundaries);
                }
            }

            @Override
            public void onFailure(int statusCode, String message, Throwable cause) {
                if (callback != null) {
                    callback.onError(statusCode, message != null ? message : "Lỗi kết nối");
                }
            }
        });
    }
}
