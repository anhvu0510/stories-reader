package com.vula.stories;

import android.content.Context;
import android.content.ContextWrapper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.vula.stories.tts.system.AndroidSpeechEngine;
import org.junit.Test;
import static org.junit.Assert.assertSame;

public class AndroidSpeechEngineLifecycleTest {
    private static final class RecordingTts extends TextToSpeech {
        UtteranceProgressListener installed;
        RecordingTts() { super(null, null); }
        @Override public int setOnUtteranceProgressListener(UtteranceProgressListener listener) {
            installed = listener;
            return SUCCESS;
        }
    }

    private static final class Engine extends AndroidSpeechEngine {
        final RecordingTts recording = new RecordingTts();
        TextToSpeech.OnInitListener init;
        Engine() {
            super(new ContextWrapper(null) {
                @Override public Context getApplicationContext() { return this; }
            });
        }
        @Override protected TextToSpeech createTextToSpeech(TextToSpeech.OnInitListener listener, String enginePackage) {
            init = listener;
            return recording;
        }
    }

    @Test public void listenerInstalledBeforePendingSpeechAndPreservedAcrossEngineChanges() {
        Engine engine = new Engine();
        UtteranceProgressListener listener = new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) {}
            @Override public void onError(String id) {}
        };
        engine.setProgressListener(listener);
        engine.runWhenReady(() -> assertSame(listener, engine.recording.installed));
        engine.initialize(null, null);
        engine.init.onInit(TextToSpeech.SUCCESS);
        assertSame(listener, engine.recording.installed);
        engine.recording.installed = null;
        engine.initialize("second.engine", null);
        engine.init.onInit(TextToSpeech.SUCCESS);
        assertSame(listener, engine.recording.installed);
    }
}
