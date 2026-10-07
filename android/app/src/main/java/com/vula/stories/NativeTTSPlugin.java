package com.vula.stories;

import com.vula.stories.player.NativeSpeechQueueManager;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.tts.system.AndroidSpeechEngine;
import com.vula.stories.tts.system.NativeTTSCoordinator;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Capacitor Plugin cho Native TTS (Thin IPC Controller).
 * Chỉ tiếp nhận yêu cầu từ Web Layer, kiểm tra tham số và ủy quyền cho AndroidSpeechEngine & NativeTTSCoordinator.
 */
@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin {

    private static final String TAG = "NativeTTSPlugin";

    private AndroidSpeechEngine speechEngine;
    private NativeTTSCoordinator coordinator;

    @Override
    public void load() {
        super.load();
        speechEngine = new AndroidSpeechEngine(getContext());
        coordinator = new NativeTTSCoordinator(getContext(), speechEngine, createEventListener());
        speechEngine.initialize(null, success -> {
            BreadcrumbTracker.add(TAG, "NativeTTS initialized: " + success);
        });
        BreadcrumbTracker.add(TAG, "NativeTTSPlugin loaded");
    }

    private NativeTTSCoordinator.PlaybackEventListener createEventListener() {
        return new NativeTTSCoordinator.PlaybackEventListener() {
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
            public void onUtteranceStart(String utteranceId) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onStart", data);
            }

            @Override
            public void onUtteranceDone(String utteranceId) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onDone", data);
            }

            @Override
            public void onUtteranceError(String utteranceId, String error) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("error", error);
                data.put("message", error);
                data.put("chunkIndex", NativeSpeechQueueManager.parseChunkIndex(utteranceId));
                notifyListeners("onError", data);
            }

            @Override
            public void onUtteranceRangeStart(String utteranceId, int start, int end) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("start", start);
                data.put("end", end);
                notifyListeners("onRangeStart", data);
            }
        };
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", speechEngine != null && speechEngine.isAvailable());
        call.resolve(ret);
    }

    @PluginMethod
    public void getEngines(PluginCall call) {
        speechEngine.runWhenReady(() -> {
            List<TextToSpeech.EngineInfo> engines = speechEngine.getEngines();
            String defaultEngine = speechEngine.getDefaultEngine();
            JSArray jsEngines = new JSArray();
            for (TextToSpeech.EngineInfo e : engines) {
                JSObject obj = new JSObject();
                obj.put("name", e.name);
                obj.put("label", e.label);
                obj.put("isDefault", e.name.equalsIgnoreCase(defaultEngine));
                jsEngines.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("engines", jsEngines);
            ret.put("defaultEngine", defaultEngine);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setEngine(PluginCall call) {
        String engine = call.getString("engine");
        if (engine == null || engine.trim().isEmpty()) {
            call.reject("Engine package name is required");
            return;
        }
        speechEngine.initialize(engine.trim(), success -> {
            JSObject ret = new JSObject();
            ret.put("success", success);
            ret.put("engine", engine);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getVoices(PluginCall call) {
        speechEngine.runWhenReady(() -> {
            Set<Voice> voices = speechEngine.getVoices();
            JSArray jsVoices = new JSArray();
            for (Voice v : voices) {
                Locale loc = v.getLocale();
                JSObject obj = new JSObject();
                obj.put("name", v.getName());
                obj.put("lang", loc != null ? loc.toLanguageTag() : "");
                obj.put("language", loc != null ? loc.getLanguage() : "");
                obj.put("displayName", (loc != null ? loc.getDisplayName() : v.getName()) + " (" + v.getName() + ")");
                obj.put("quality", v.getQuality());
                obj.put("latency", v.getLatency());
                obj.put("requiresNetwork", v.isNetworkConnectionRequired());
                jsVoices.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("voices", jsVoices);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void playChapter(PluginCall call) {
        JSArray chunksArray = call.getArray("chunks");
        if (chunksArray == null || chunksArray.length() == 0) {
            call.reject("Chunks list cannot be empty", "INVALID_INPUT");
            return;
        }

        int startIndex = call.getInt("startIndex", 0);
        int startCharIndex = call.getInt("startCharIndex", 0);
        String voice = call.getString("voice", null);
        Float rate = call.getFloat("rate", 1.0f);
        Float pitch = call.getFloat("pitch", 1.0f);
        String bookTitle = call.getString("bookTitle", "Stories Reader");
        String chapterTitle = call.getString("chapterTitle", "Chương đọc");

        List<String> chunkList = new ArrayList<>();
        for (int i = 0; i < chunksArray.length(); i++) {
            chunkList.add(chunksArray.optString(i, ""));
        }

        speechEngine.runWhenReady(() -> {
            coordinator.playChapter(chunkList, startIndex, startCharIndex, voice, rate, pitch, bookTitle, chapterTitle);
            call.resolve();
        });
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
        int chunkIndex = call.getInt("chunkIndex", -1);
        if (chunkIndex < 0) {
            call.reject("Invalid chunk index: " + chunkIndex, "INVALID_INDEX");
            return;
        }
        if (coordinator != null) {
            coordinator.seek(chunkIndex);
        }
        call.resolve();
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }

        speechEngine.runWhenReady(() -> {
            String voice = call.getString("voice", null);
            Float rate = call.getFloat("rate", 1.0f);
            Float pitch = call.getFloat("pitch", 1.0f);
            String utteranceId = call.getString("utteranceId", String.valueOf(System.currentTimeMillis()));

            coordinator.speak(text, voice, rate, pitch, utteranceId, new NativeTTSCoordinator.SpeakCallback() {
                @Override
                public void onDone(String id) {
                    JSObject data = new JSObject();
                    data.put("utteranceId", id);
                    call.resolve(data);
                }

                @Override
                public void onError(String id, String error) {
                    call.reject(error);
                }
            });
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (coordinator != null) {
            coordinator.stop(true);
        }
        if (speechEngine != null) {
            speechEngine.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        BreadcrumbTracker.add(TAG, "Native device TTS cache cleared");
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (coordinator != null) {
            coordinator.destroy();
        }
        super.handleOnDestroy();
    }
}
