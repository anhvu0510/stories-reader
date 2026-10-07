package com.vula.stories.player.media3;

import static org.junit.Assert.assertTrue;
import android.app.ActivityManager;
import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.vula.stories.MainActivity;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ReadingForegroundTest {
    @Test
    public void replacingAReadingSessionIsNotStoppedByThePreviousStopCommand() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        CountDownLatch firstStarted = new CountDownLatch(1);
        CountDownLatch checkedReplacement = new CountDownLatch(1);
        AtomicBoolean survived = new AtomicBoolean();
        Media3ReadAloudBridge.Listener listener = new Media3ReadAloudBridge.Listener() {
            @Override public void onSnapshot(PlaybackSnapshot snapshot) {
                if ("replace-first".equals(snapshot.getSessionId())) firstStarted.countDown();
                if (!"replace-second".equals(snapshot.getSessionId()) || snapshot.getState() != PlaybackSnapshot.State.CONNECTING) return;
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    PlaybackSnapshot latest = Media3ReadAloudBridge.getLatestSnapshot();
                    ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
                    boolean running = manager.getRunningServices(50).stream().anyMatch(service ->
                            service.service.getClassName().equals(NativeReadAloudService.class.getName()) && service.foreground);
                    survived.set(running && "replace-second".equals(latest.getSessionId())
                            && latest.getState() != PlaybackSnapshot.State.IDLE);
                    checkedReplacement.countDown();
                }, 1500);
            }
            @Override public void onUtteranceStart(String id, int index, ReadAloudUtterance utterance) {}
            @Override public void onWordBoundary(String id, int index, ReadAloudUtterance utterance, WordBoundary boundary) {}
            @Override public void onCompleted(String id) {}
            @Override public void onError(String id, int index, String code, String message) {}
        };
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Media3ReadAloudBridge.registerListener(listener);
            String text = "Một đoạn đủ dài để kiểm tra việc chuyển phiên đang đọc. ".repeat(30);
            ReadAloudUtterance utterance = new ReadAloudUtterance("first", 0, 0, text.length(), text, 0);
            Media3ReadAloudBridge.start(context, new ReadAloudSessionRequest("replace-first",
                    Collections.singletonList(utterance), 0, "vi-VN-HoaiMyNeural", "+0%", "+0Hz", "Test", "Test"));
            assertTrue(firstStarted.await(5, TimeUnit.SECONDS));
            Media3ReadAloudBridge.stop(context);
            Media3ReadAloudBridge.start(context, new ReadAloudSessionRequest("replace-second",
                    Collections.singletonList(utterance), 0, "vi-VN-HoaiMyNeural", "+0%", "+0Hz", "Test", "Test"));
            assertTrue(checkedReplacement.await(5, TimeUnit.SECONDS));
            assertTrue("The previous stop must not destroy a newer start", survived.get());
        } finally {
            Media3ReadAloudBridge.stop(context);
            Media3ReadAloudBridge.unregisterListener(listener);
        }
    }

    @Test
    public void foregroundIsEstablishedBeforeConnectingToSpeech() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        CountDownLatch connecting = new CountDownLatch(1);
        AtomicBoolean foreground = new AtomicBoolean();
        Media3ReadAloudBridge.Listener listener = new Media3ReadAloudBridge.Listener() {
            @Override public void onSnapshot(PlaybackSnapshot snapshot) {
                if (!"foreground-test".equals(snapshot.getSessionId()) || connecting.getCount() == 0) return;
                ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
                foreground.set(manager.getRunningServices(50).stream().anyMatch(service ->
                        service.service.getClassName().equals(NativeReadAloudService.class.getName()) && service.foreground));
                connecting.countDown();
            }
            @Override public void onUtteranceStart(String id, int index, ReadAloudUtterance utterance) {}
            @Override public void onWordBoundary(String id, int index, ReadAloudUtterance utterance, WordBoundary boundary) {}
            @Override public void onCompleted(String id) {}
            @Override public void onError(String id, int index, String code, String message) {}
        };
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Media3ReadAloudBridge.registerListener(listener);
            ReadAloudUtterance utterance = new ReadAloudUtterance("first", 0, 0, 12, "Một câu thử.", 0);
            Media3ReadAloudBridge.start(context, new ReadAloudSessionRequest("foreground-test",
                    Collections.singletonList(utterance), 0, "vi-VN-HoaiMyNeural", "+0%", "+0Hz", "Test", "Test"));
            assertTrue(connecting.await(5, TimeUnit.SECONDS));
            assertTrue("Service must be foreground before waiting on network/audio", foreground.get());
        } finally {
            Media3ReadAloudBridge.stop(context);
            Media3ReadAloudBridge.unregisterListener(listener);
        }
    }
}
