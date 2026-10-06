package com.vula.stories.tts.system;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Bao bọc và quản lý vòng đời TextToSpeech của Android (Deep Module).
 * Phụ trách khởi tạo engine, chuyển đổi giọng đọc (Voice), tốc độ và cao độ.
 */
public class AndroidSpeechEngine {

    private static final String TAG = "AndroidSpeechEngine";

    public interface InitCallback {
        void onInitialized(boolean success);
    }

    private final Context context;
    private TextToSpeech tts;
    private boolean isInitialized = false;
    private final List<Runnable> pendingTasks = new ArrayList<>();

    public AndroidSpeechEngine(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized void initialize(String enginePackage, InitCallback callback) {
        shutdown();

        TextToSpeech.OnInitListener listener = status -> {
            synchronized (AndroidSpeechEngine.this) {
                isInitialized = (status == TextToSpeech.SUCCESS);
                if (isInitialized) {
                    executePendingTasks();
                } else {
                    Log.e(TAG, "Khởi tạo TTS thất bại với mã: " + status);
                    pendingTasks.clear();
                }
                if (callback != null) {
                    callback.onInitialized(isInitialized);
                }
            }
        };

        if (enginePackage != null && !enginePackage.trim().isEmpty()) {
            tts = new TextToSpeech(context, listener, enginePackage.trim());
            return;
        }
        tts = new TextToSpeech(context, listener);
    }

    private void executePendingTasks() {
        for (Runnable task : pendingTasks) {
            try {
                task.run();
            } catch (Exception ex) {
                Log.e(TAG, "Lỗi thực thi hàng đợi khởi tạo: " + ex.getMessage(), ex);
            }
        }
        pendingTasks.clear();
    }

    public synchronized void runWhenReady(Runnable task) {
        if (isInitialized && tts != null) {
            task.run();
            return;
        }
        pendingTasks.add(task);
    }

    public boolean isAvailable() {
        return isInitialized && tts != null;
    }

    public TextToSpeech getRawTts() {
        return tts;
    }

    public void setProgressListener(UtteranceProgressListener listener) {
        if (tts != null) {
            tts.setOnUtteranceProgressListener(listener);
        }
    }

    public List<TextToSpeech.EngineInfo> getEngines() {
        if (tts == null) {
            return Collections.emptyList();
        }
        List<TextToSpeech.EngineInfo> engines = tts.getEngines();
        return (engines != null) ? engines : Collections.emptyList();
    }

    public String getDefaultEngine() {
        return (tts != null) ? tts.getDefaultEngine() : "";
    }

    public Set<Voice> getVoices() {
        if (tts == null) {
            return Collections.emptySet();
        }
        Set<Voice> voices = tts.getVoices();
        return (voices != null) ? voices : Collections.emptySet();
    }

    public Voice findMatchingVoice(String voiceName) {
        if (tts == null || voiceName == null || voiceName.trim().isEmpty()) {
            return null;
        }
        Set<Voice> voices = tts.getVoices();
        if (voices == null) {
            return null;
        }
        String target = voiceName.trim();
        for (Voice v : voices) {
            if (v.getName().equalsIgnoreCase(target)) {
                return v;
            }
        }
        return null;
    }

    public void applyVoiceSettings(String voiceName, Float rate, Float pitch) {
        if (tts == null) {
            return;
        }
        try {
            if (rate != null) {
                tts.setSpeechRate(rate);
            }
            if (pitch != null) {
                tts.setPitch(pitch);
            }
            Voice matched = findMatchingVoice(voiceName);
            if (matched != null) {
                tts.setVoice(matched);
                return;
            }
            tts.setLanguage(new Locale("vi", "VN"));
        } catch (Exception ex) {
            Log.w(TAG, "Lỗi cài đặt giọng đọc: " + ex.getMessage());
        }
    }

    public int speak(String text, int queueMode, Bundle params, String utteranceId) {
        if (tts == null) {
            return TextToSpeech.ERROR;
        }
        return tts.speak(text, queueMode, params, utteranceId);
    }

    public void stop() {
        if (tts != null) {
            tts.stop();
        }
    }

    public synchronized void shutdown() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ex) {
                Log.w(TAG, "Lỗi tắt TextToSpeech: " + ex.getMessage());
            }
            tts = null;
            isInitialized = false;
        }
    }
}
