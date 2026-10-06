package com.vula.stories;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import android.view.MotionEvent;
import com.getcapacitor.CapacitorWebView;

/** Capacitor WebView with a selection-menu policy independent of playback state. */
public class ReaderWebView extends CapacitorWebView {
    private ReaderSelectionActionModeCallback selectionCallback;
    interface GestureDelegate { boolean onTouch(MotionEvent event); }
    private GestureDelegate gestureDelegate;
    private boolean nativeConsumed;

    void setGestureDelegate(GestureDelegate delegate) { gestureDelegate = delegate; }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (gestureDelegate == null) return super.dispatchTouchEvent(event);
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) nativeConsumed = false;
        boolean consume = gestureDelegate.onTouch(event);
        if (consume && !nativeConsumed && action != MotionEvent.ACTION_DOWN) cancelWebTouch(event);
        boolean owned = consume || nativeConsumed;
        nativeConsumed = owned;
        if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) nativeConsumed = false;
        if (owned) return true;
        return super.dispatchTouchEvent(event);
    }

    private void cancelWebTouch(MotionEvent source) {
        MotionEvent cancel = MotionEvent.obtain(source);
        cancel.setAction(MotionEvent.ACTION_CANCEL);
        super.dispatchTouchEvent(cancel);
        cancel.recycle();
    }

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
