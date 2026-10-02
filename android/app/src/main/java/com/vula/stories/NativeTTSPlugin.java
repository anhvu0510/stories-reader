package com.vula.stories;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin {
    private static final String TAG = "NativeTTSPlugin";
    private TextToSpeech tts;
    private boolean isInitialized = false;
    private final List<Runnable> pendingInitTasks = new ArrayList<>();
    private PluginCall currentSpeakCall = null;

    @Override
    public void load() {
        super.load();
        initTTS(null);
    }

    private synchronized void initTTS(String enginePackage) {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception e) {
                Log.w(TAG, "Error shutting down previous TTS: " + e.getMessage());
            }
            tts = null;
            isInitialized = false;
        }

        TextToSpeech.OnInitListener listener = status -> {
            synchronized (NativeTTSPlugin.this) {
                if (status == TextToSpeech.SUCCESS) {
                    isInitialized = true;
                    Log.i(TAG, "TTS initialized successfully");
                    setupUtteranceListener();
                    for (Runnable task : pendingInitTasks) {
                        try {
                            task.run();
                        } catch (Exception e) {
                            Log.e(TAG, "Error executing pending task: " + e.getMessage());
                        }
                    }
                    pendingInitTasks.clear();
                } else {
                    isInitialized = false;
                    Log.e(TAG, "TTS initialization failed with code: " + status);
                    pendingInitTasks.clear();
                }
            }
        };

        if (enginePackage != null && !enginePackage.trim().isEmpty()) {
            tts = new TextToSpeech(getContext(), listener, enginePackage.trim());
        } else {
            tts = new TextToSpeech(getContext(), listener);
        }
    }

    private void setupUtteranceListener() {
        if (tts == null) return;
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onStart", data);
            }

            @Override
            public void onDone(String utteranceId) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onDone", data);
                synchronized (NativeTTSPlugin.this) {
                    if (currentSpeakCall != null) {
                        currentSpeakCall.resolve(data);
                        currentSpeakCall = null;
                    }
                }
            }

            @Override
            public void onError(String utteranceId) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("error", "Playback failed");
                notifyListeners("onError", data);
                synchronized (NativeTTSPlugin.this) {
                    if (currentSpeakCall != null) {
                        currentSpeakCall.reject("Playback failed for " + utteranceId);
                        currentSpeakCall = null;
                    }
                }
            }

            @Override
            public void onRangeStart(String utteranceId, int start, int end, int frame) {
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("start", start);
                data.put("end", end);
                notifyListeners("onRangeStart", data);
            }
        });
    }

    private void runWhenReady(Runnable runnable, PluginCall call) {
        synchronized (this) {
            if (isInitialized && tts != null) {
                runnable.run();
            } else {
                pendingInitTasks.add(runnable);
            }
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", isInitialized && tts != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void getEngines(PluginCall call) {
        runWhenReady(() -> {
            try {
                List<TextToSpeech.EngineInfo> engines = tts.getEngines();
                JSArray jsEngines = new JSArray();
                String defaultEngine = tts.getDefaultEngine();
                if (engines != null) {
                    for (TextToSpeech.EngineInfo e : engines) {
                        JSObject obj = new JSObject();
                        obj.put("name", e.name);
                        obj.put("label", e.label);
                        obj.put("isDefault", e.name.equalsIgnoreCase(defaultEngine));
                        jsEngines.put(obj);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("engines", jsEngines);
                ret.put("defaultEngine", defaultEngine);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get engines: " + e.getMessage());
            }
        }, call);
    }

    @PluginMethod
    public void setEngine(PluginCall call) {
        String engine = call.getString("engine");
        if (engine == null || engine.trim().isEmpty()) {
            call.reject("Engine package name is required");
            return;
        }
        initTTS(engine.trim());
        runWhenReady(() -> {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("engine", engine);
            call.resolve(ret);
        }, call);
    }

    @PluginMethod
    public void getVoices(PluginCall call) {
        runWhenReady(() -> {
            try {
                Set<Voice> voices = tts.getVoices();
                JSArray jsVoices = new JSArray();
                if (voices != null) {
                    for (Voice v : voices) {
                        Locale loc = v.getLocale();
                        String langTag = loc != null ? loc.toLanguageTag() : "";
                        String lang = loc != null ? loc.getLanguage() : "";

                        JSObject obj = new JSObject();
                        obj.put("name", v.getName());
                        obj.put("lang", langTag);
                        obj.put("language", lang);
                        obj.put("displayName", (loc != null ? loc.getDisplayName() : v.getName()) + " (" + v.getName() + ")");
                        obj.put("quality", v.getQuality());
                        obj.put("latency", v.getLatency());
                        obj.put("requiresNetwork", v.isNetworkConnectionRequired());
                        jsVoices.put(obj);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("voices", jsVoices);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get voices: " + e.getMessage());
            }
        }, call);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        runWhenReady(() -> {
            String text = call.getString("text", "");
            String voiceName = call.getString("voice", null);
            Float rate = call.getFloat("rate", 1.0f);
            Float pitch = call.getFloat("pitch", 1.0f);
            String utteranceId = call.getString("utteranceId", String.valueOf(System.currentTimeMillis()));

            if (text == null || text.trim().isEmpty()) {
                call.resolve();
                return;
            }

            try {
                if (rate != null) {
                    tts.setSpeechRate(rate);
                }
                if (pitch != null) {
                    tts.setPitch(pitch);
                }

                if (voiceName != null && !voiceName.trim().isEmpty()) {
                    Set<Voice> voices = tts.getVoices();
                    if (voices != null) {
                        for (Voice v : voices) {
                            if (v.getName().equalsIgnoreCase(voiceName.trim())) {
                                tts.setVoice(v);
                                break;
                            }
                        }
                    }
                } else {
                    // Try setting Vietnamese locale by default
                    tts.setLanguage(new Locale("vi", "VN"));
                }

                synchronized (NativeTTSPlugin.this) {
                    currentSpeakCall = call;
                }

                Bundle params = new Bundle();
                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
                int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
                if (result != TextToSpeech.SUCCESS) {
                    synchronized (NativeTTSPlugin.this) {
                        currentSpeakCall = null;
                    }
                    call.reject("TTS speak failed with code: " + result);
                }
            } catch (Exception e) {
                synchronized (NativeTTSPlugin.this) {
                    currentSpeakCall = null;
                }
                call.reject("TTS speak error: " + e.getMessage());
            }
        }, call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            if (tts != null) {
                tts.stop();
            }
            synchronized (this) {
                if (currentSpeakCall != null) {
                    currentSpeakCall.resolve();
                    currentSpeakCall = null;
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error stopping TTS: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
            }
            tts = null;
        }
        super.handleOnDestroy();
    }
}
