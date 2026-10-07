package com.vula.stories;

import android.webkit.JavascriptInterface;

/** Read-only build identity. No persisted user setting can enable debug behavior. */
public final class DebugRuntime {
    @JavascriptInterface
    public boolean isDebugBuild() {
        return BuildConfig.DEBUG;
    }
}
