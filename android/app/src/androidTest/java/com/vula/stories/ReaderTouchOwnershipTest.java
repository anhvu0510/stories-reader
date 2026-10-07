package com.vula.stories;

import static org.junit.Assert.assertTrue;
import android.os.SystemClock;
import android.view.MotionEvent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.lang.reflect.Field;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ReaderTouchOwnershipTest {
    private static final class SilentCall extends PluginCall {
        SilentCall(JSObject data) { super(null, "ReaderGestures", "test", "configureSheet", data); }
        @Override public void resolve() {}
    }

    @Test
    public void changingGestureConfigurationDoesNotReleaseTheUsersFinger() throws Exception {
        AtomicBoolean held = new AtomicBoolean();
        Field touching = ReaderGesturesPlugin.class.getDeclaredField("touching");
        touching.setAccessible(true);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                ReaderGesturesPlugin plugin = (ReaderGesturesPlugin) activity.getBridge().getPlugin("ReaderGestures").getInstance();
                long now = SystemClock.uptimeMillis();
                MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 300, 300, 0);
                MotionEvent up = MotionEvent.obtain(now, now + 1000, MotionEvent.ACTION_UP, 300, 300, 0);
                plugin.onTouch(down);
                plugin.configureSheet(new SilentCall(new JSObject().put("owner", "test").put("enabled", false)));
                try { held.set(touching.getBoolean(plugin)); }
                catch (IllegalAccessException error) { throw new IllegalStateException(error); }
                plugin.onTouch(up);
                down.recycle();
                up.recycle();
            });
            assertTrue("Configuration updates must preserve physical touch ownership until UP", held.get());
        }
    }
}
