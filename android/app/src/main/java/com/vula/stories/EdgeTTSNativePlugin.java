package com.vula.stories;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.RemoteLogger;
import com.vula.stories.player.media3.Media3PlaybackAdapter;
import com.vula.stories.tts.edge.AudioCacheManager;
import com.vula.stories.tts.edge.EdgePrefetchQueue;
import com.vula.stories.tts.edge.EdgeSingleSynthesizer;
import com.vula.stories.tts.edge.EdgeStreamingCoordinator;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import org.json.JSONObject;

/**
 * Capacitor Plugin cho Edge TTS (Thin IPC Controller).
 * Chỉ tiếp nhận yêu cầu từ Web Layer, kiểm tra tham số và ủy quyền cho EdgeStreamingCoordinator.
 */
@CapacitorPlugin(name = "EdgeTTSNative")
public class EdgeTTSNativePlugin extends Plugin {

    private static final String TAG = "EdgeTTSNativePlugin";

    private EdgeStreamingCoordinator coordinator;
    private Media3PlaybackAdapter media3Adapter;
    private EdgeSingleSynthesizer synthesizer;

    @Override
    public void load() {
        super.load();
        OkHttpClient httpClient = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .build();

        AudioCacheManager cacheManager = new AudioCacheManager(getContext());
        EdgePrefetchQueue prefetchQueue = new EdgePrefetchQueue(getContext());
        synthesizer = new EdgeSingleSynthesizer(httpClient);
        media3Adapter = new Media3PlaybackAdapter(this::notifyListeners);
        media3Adapter.register();

        coordinator = new EdgeStreamingCoordinator(
                getContext(), cacheManager, prefetchQueue, media3Adapter, createEventListener()
        );

        BreadcrumbTracker.add(TAG, "EdgeTTSNativePlugin loaded");
    }

    private EdgeStreamingCoordinator.PlaybackEventListener createEventListener() {
        return new EdgeStreamingCoordinator.PlaybackEventListener() {
            @Override
            public void onChunkStart(int chunkIndex) {
                JSObject data = new JSObject();
                data.put("chunkIndex", chunkIndex);
                notifyListeners("onChunkStart", data);
            }

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                JSObject ev = new JSObject();
                ev.put("chunkIndex", chunkIndex);
                ev.put("charIndex", charIndex);
                ev.put("charLength", charLength);
                ev.put("text", text);
                notifyListeners("onWordBoundary", ev);
            }

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
                JSObject state = new JSObject();
                state.put("isPlaying", isPlaying);
                state.put("isPaused", isPaused);
                state.put("isBuffering", isBuffering);
                notifyListeners("onPlaybackStateChange", state);
            }

            @Override
            public void onPlaybackComplete() {
                notifyListeners("onPlaybackComplete", new JSObject());
            }

            @Override
            public void onPlaybackError(int index, String message) {
                JSObject data = new JSObject();
                data.put("chunkIndex", index);
                data.put("message", message);
                notifyListeners("onError", data);
            }
        };
    }

    @PluginMethod
    public void setGatewayUrl(PluginCall call) {
        String url = call.getString("gatewayUrl", "");
        if (!url.isEmpty()) {
            RemoteLogger.setGatewayUrl(url);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        new com.vula.stories.player.media3.EdgeTimelineCache(
                new java.io.File(getContext().getCacheDir(), com.vula.stories.player.media3.EdgeTimelineCache.DIRECTORY),
                com.vula.stories.player.media3.EdgeTimelineCache.DEFAULT_BUDGET_BYTES).clear();
        if (coordinator != null) {
            coordinator.clearCache();
        }
        call.resolve();
    }

    @PluginMethod
    public void synthesize(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Text cannot be empty", "INVALID_INPUT");
            return;
        }

        String voice = call.getString("voice", "vi-VN-HoaiMyNeural");
        String rate = call.getString("rate", "+0%");
        String pitch = call.getString("pitch", "+0Hz");
        String gatewayUrl = call.getString("gatewayUrl", "");
        if (!gatewayUrl.isEmpty()) {
            RemoteLogger.setGatewayUrl(gatewayUrl);
        }

        synthesizer.synthesize(text, voice, rate, pitch, new EdgeSingleSynthesizer.Callback() {
            @Override
            public void onSuccess(String base64Audio, JSArray wordBoundaries) {
                JSObject ret = new JSObject();
                ret.put("audioBase64", base64Audio);
                ret.put("mimeType", "audio/mpeg");
                ret.put("wordBoundaries", wordBoundaries);
                call.resolve(ret);
            }

            @Override
            public void onError(int statusCode, String message) {
                JSONObject errDetails = new JSONObject();
                try {
                    errDetails.put("voice", voice);
                    errDetails.put("rate", rate);
                    errDetails.put("textLength", text.length());
                    errDetails.put("statusCode", statusCode);
                    errDetails.put("fullText", text);
                } catch (Exception ignored) {
                }
                RemoteLogger.log("EdgeTTSNative_Stream", "error",
                        "[EdgeTTS] Kết nối Edge WebSocket thất bại (code: " + statusCode + ") - Nội dung: \""
                                + RemoteLogger.formatSnippet(text) + "\"", message, errDetails);

                JSObject details = new JSObject();
                details.put("statusCode", statusCode);
                details.put("message", message);
                call.reject("Edge TTS WebSocket failed: " + message, "EDGE_TTS_FAIL", details);
            }
        });
    }

    @PluginMethod
    public void playChapter(PluginCall call) {
        JSArray chunksArray = call.getArray("chunks");
        if (chunksArray == null || chunksArray.length() == 0) {
            call.reject("Chunks array cannot be empty", "INVALID_INPUT");
            return;
        }

        String gatewayUrl = call.getString("gatewayUrl", "");
        if (!gatewayUrl.isEmpty()) {
            RemoteLogger.setGatewayUrl(gatewayUrl);
        }

        int startIndex = call.getInt("startIndex", 0);
        String voice = call.getString("voice", "vi-VN-HoaiMyNeural");
        String pitch = call.getString("pitch", "+0Hz");
        String bufferMode = call.getString("bufferMode", "file");
        String bookTitle = call.getString("bookTitle", "Stories Reader");
        String chapterTitle = call.getString("chapterTitle", "Chương đọc");
        String rate = parsePlaybackRate(call);

        if ("media3".equalsIgnoreCase(bufferMode)) {
            startMedia3Session(call, chunksArray, startIndex, voice, rate, pitch, bookTitle, chapterTitle);
            return;
        }

        List<String> chunks = new ArrayList<>();
        for (int i = 0; i < chunksArray.length(); i++) {
            chunks.add(chunksArray.optString(i, ""));
        }

        coordinator.startStreaming(chunks, startIndex, voice, rate, pitch, bufferMode, bookTitle, chapterTitle);
        call.resolve();
    }

    private String parsePlaybackRate(PluginCall call) {
        if (!call.hasOption("rate")) {
            return "+0%";
        }
        try {
            double r = call.getDouble("rate");
            int pct = (int) Math.round((r - 1.0) * 100);
            return (pct >= 0 ? "+" : "") + pct + "%";
        } catch (Exception ex) {
            return call.getString("rate", "+0%");
        }
    }

    private void startMedia3Session(
            PluginCall call, JSArray chunksArray, int startIndex,
            String voice, String rate, String pitch, String bookTitle, String chapterTitle
    ) {
        coordinator.stop(false);
        String sessionId = call.getString("sessionId", UUID.randomUUID().toString());
        boolean ok = media3Adapter.startPlayback(
                getContext(), chunksArray, call.getArray("utterances"), startIndex,
                voice, rate, pitch, bookTitle, chapterTitle, sessionId
        );
        if (!ok) {
            call.reject("Utterances array cannot be empty", "INVALID_INPUT");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void pausePlayback(PluginCall call) {
        if (coordinator != null) {
            coordinator.pause();
        }
        call.resolve();
    }

    @PluginMethod
    public void resumePlayback(PluginCall call) {
        if (coordinator != null) {
            coordinator.resume();
        }
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        if (coordinator != null) {
            coordinator.stop(true);
        }
        call.resolve();
    }

    @PluginMethod
    public void seekToChunk(PluginCall call) {
        int targetIndex = call.getInt("chunkIndex", 0);
        if (media3Adapter != null && media3Adapter.isMedia3Active()) {
            media3Adapter.seek(getContext(), targetIndex);
            call.resolve();
            return;
        }
        if (coordinator != null) {
            coordinator.seek(targetIndex);
        }
        call.resolve();
    }

    @PluginMethod
    public void getPlaybackSnapshot(PluginCall call) {
        if (media3Adapter != null) {
            call.resolve(media3Adapter.getLatestSnapshotJs());
            return;
        }
        call.resolve(new JSObject());
    }

    @Override
    protected void handleOnDestroy() {
        if (coordinator != null) {
            coordinator.destroy();
        }
        super.handleOnDestroy();
    }
}
