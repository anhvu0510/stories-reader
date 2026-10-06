package com.vula.stories;

import android.graphics.Rect;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;

/** Keeps Chromium's selection lifecycle while removing the reader's native menu. */
final class ReaderSelectionActionModeCallback extends ActionMode.Callback2 {
    private final ActionMode.Callback original;
    private boolean menuSuppressed;
    private ActionMode selectionMode;

    ReaderSelectionActionModeCallback(ActionMode.Callback original) {
        this.original = original;
    }

    void suppressMenu(Menu menu) {
        menuSuppressed = true;
        menu.clear();
    }

    boolean belongsTo(ActionMode mode) {
        return selectionMode == mode;
    }

    @Override
    public boolean onCreateActionMode(ActionMode mode, Menu menu) {
        selectionMode = mode;
        boolean created = original.onCreateActionMode(mode, menu);
        if (menuSuppressed) menu.clear();
        return created;
    }

    @Override
    public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
        boolean changed = original.onPrepareActionMode(mode, menu);
        if (!menuSuppressed) return changed;
        // WebView rebuilds its menu when selection handles move; remove it every time.
        menu.clear();
        return true;
    }

    @Override
    public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
        if (menuSuppressed) return false;
        return original.onActionItemClicked(mode, item);
    }

    @Override
    public void onDestroyActionMode(ActionMode mode) {
        original.onDestroyActionMode(mode);
    }

    @Override
    public void onGetContentRect(ActionMode mode, View view, Rect rect) {
        if (!(original instanceof ActionMode.Callback2)) {
            super.onGetContentRect(mode, view, rect);
            return;
        }
        ((ActionMode.Callback2) original).onGetContentRect(mode, view, rect);
    }
}
