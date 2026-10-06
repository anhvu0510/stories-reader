package com.vula.stories;

import android.graphics.Rect;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import java.lang.reflect.Proxy;
import org.junit.Test;
import static org.junit.Assert.*;

public class ReaderSelectionActionModeCallbackTest {
    private static final class RecordingCallback extends ActionMode.Callback2 {
        int created;
        int prepared;
        int destroyed;
        int positioned;
        @Override public boolean onCreateActionMode(ActionMode mode, Menu menu) { created++; return true; }
        @Override public boolean onPrepareActionMode(ActionMode mode, Menu menu) { prepared++; return false; }
        @Override public boolean onActionItemClicked(ActionMode mode, MenuItem item) { return true; }
        @Override public void onDestroyActionMode(ActionMode mode) { destroyed++; }
        @Override public void onGetContentRect(ActionMode mode, View view, Rect rect) { positioned++; }
    }

    @Test public void hidesMenuAcrossSelectionUpdatesWithoutEndingSelection() {
        RecordingCallback original = new RecordingCallback();
        ReaderSelectionActionModeCallback callback = new ReaderSelectionActionModeCallback(original);
        int[] clears = {0};
        Menu menu = (Menu) Proxy.newProxyInstance(Menu.class.getClassLoader(), new Class<?>[]{Menu.class},
                (proxy, method, args) -> { if (method.getName().equals("clear")) clears[0]++; return null; });

        assertTrue(callback.onCreateActionMode(null, menu));
        assertFalse(callback.onPrepareActionMode(null, menu));
        assertEquals(0, clears[0]);
        callback.suppressMenu(menu);
        assertEquals(1, clears[0]);
        assertTrue(callback.onPrepareActionMode(null, menu));
        assertTrue(callback.onPrepareActionMode(null, menu));
        assertEquals(3, clears[0]);
        assertEquals(0, original.destroyed);
        callback.onGetContentRect(null, null, null);
        assertEquals(1, original.positioned);
        callback.onDestroyActionMode(null);
        assertEquals(1, original.destroyed);
    }
}
