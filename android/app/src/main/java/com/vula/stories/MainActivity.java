package com.vula.stories;

import android.os.Bundle;
import android.view.View;
import android.view.ActionMode;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private ActionMode currentSelectionMode;

    @Override
    public void onActionModeStarted(ActionMode mode) {
        super.onActionModeStarted(mode);
        currentSelectionMode = mode;
        if (mode.getType() != ActionMode.TYPE_FLOATING || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        // Reader selections use the app's speaker control, never the system toolbar.
        // Preserve selection handles and normal input-field menus outside reader content.
        String shouldHide = "(function(){"
                + "var s=window.getSelection(),c=document.getElementById('main-story-content');"
                + "return !!(s&&s.rangeCount&&!s.isCollapsed&&c&&c.contains(s.getRangeAt(0).startContainer));"
                + "})()";
        webView.evaluateJavascript(shouldHide, value -> {
            if (!"true".equals(value) || currentSelectionMode != mode) return;
            if (!(webView instanceof ReaderWebView)) return;
            ((ReaderWebView) webView).suppressSelectionMenu(mode);
        });
    }

    @Override
    public void onActionModeFinished(ActionMode mode) {
        if (currentSelectionMode == mode) clearSelectionMode(mode);
        super.onActionModeFinished(mode);
    }

    private void clearSelectionMode(ActionMode mode) {
        currentSelectionMode = null;
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (!(webView instanceof ReaderWebView)) return;
        ((ReaderWebView) webView).clearSelectionMode(mode);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeTTSPlugin.class);
        registerPlugin(EdgeTTSNativePlugin.class);
        registerPlugin(BiometricPlugin.class);
        registerPlugin(ReaderGesturesPlugin.class);
        super.onCreate(savedInstanceState);

        // Completely disable native Android WebView scrollbars and overscroll indicators
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        }

        // Register modern OnBackPressedCallback for Android 10-15+ edge swipe-back gesture & navigation buttons
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleIntelligentBack();
            }
        });
    }

    private void handleIntelligentBack() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            // Intelligent Android Back navigation:
            // 1. Close any open BottomSheet or Modal dialog first via Escape event
            // 2. Support both HashRouter (#/...) and BrowserRouter paths
            // 3. Only exit the application if on the root library screen with no open dialogs
            String jsCheck =
                "(function() {" +
                "  var dialog = document.querySelector('[role=\"dialog\"], [aria-modal=\"true\"], [data-sheet-open=\"true\"]');" +
                "  if (dialog) {" +
                "    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));" +
                "    return true;" +
                "  }" +
                "  var hash = window.location.hash || '';" +
                "  var path = window.location.pathname || '';" +
                "  var isSubRoute = (hash && hash !== '#/' && hash !== '#/library') || (path !== '/' && path !== '/library' && path !== '/index.html');" +
                "  if (isSubRoute) {" +
                "    if (window.history.length > 1) {" +
                "      window.history.back();" +
                "    } else {" +
                "      window.location.hash = '#/';" +
                "    }" +
                "    return true;" +
                "  }" +
                "  return false;" +
                "})()";

            webView.evaluateJavascript(jsCheck, value -> {
                if (!"true".equals(value)) {
                    runOnUiThread(() -> {
                        finish();
                    });
                }
            });
            return;
        }
        finish();
    }

    @Override
    public void onBackPressed() {
        handleIntelligentBack();
    }
}
