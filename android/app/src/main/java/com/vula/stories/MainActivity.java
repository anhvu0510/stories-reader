package com.vula.stories;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeTTSPlugin.class);
        registerPlugin(EdgeTTSNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Completely disable native Android WebView scrollbars and overscroll indicators
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            // Intelligent Android Back navigation:
            // 1. Close any open BottomSheet or Modal dialog first via Escape event
            // 2. If no modal is open and user is on a sub-route (e.g. reader or chapter list), navigate back
            // 3. Only exit the application if on the root library screen with no open dialogs
            String jsCheck =
                "(function() {" +
                "  var dialog = document.querySelector('[role=\"dialog\"], [aria-modal=\"true\"]');" +
                "  if (dialog) {" +
                "    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));" +
                "    return true;" +
                "  }" +
                "  var path = window.location.pathname;" +
                "  if (path !== '/' && path !== '/library' && window.history.length > 1) {" +
                "    window.history.back();" +
                "    return true;" +
                "  }" +
                "  return false;" +
                "})()";

            webView.evaluateJavascript(jsCheck, value -> {
                if (!"true".equals(value)) {
                    runOnUiThread(() -> super.onBackPressed());
                }
            });
            return;
        }
        super.onBackPressed();
    }
}
