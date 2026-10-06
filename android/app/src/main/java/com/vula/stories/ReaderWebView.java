package com.vula.stories;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import com.getcapacitor.CapacitorWebView;

/** Capacitor WebView with a selection-menu policy independent of playback state. */
public class ReaderWebView extends CapacitorWebView {
    private ReaderSelectionActionModeCallback selectionCallback;

    public ReaderWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        if (type != ActionMode.TYPE_FLOATING) return super.startActionMode(callback, type);
        ReaderSelectionActionModeCallback wrapped = new ReaderSelectionActionModeCallback(callback);
        selectionCallback = wrapped;
        ActionMode mode = super.startActionMode(wrapped, type);
        if (mode == null && selectionCallback == wrapped) selectionCallback = null;
        return mode;
    }

    void suppressSelectionMenu(ActionMode mode) {
        if (selectionCallback == null || !selectionCallback.belongsTo(mode)) return;
        selectionCallback.suppressMenu(mode.getMenu());
        mode.invalidate();
        mode.hide(2000L);
    }

    void clearSelectionMode(ActionMode mode) {
        if (selectionCallback == null || !selectionCallback.belongsTo(mode)) return;
        selectionCallback = null;
    }
}
