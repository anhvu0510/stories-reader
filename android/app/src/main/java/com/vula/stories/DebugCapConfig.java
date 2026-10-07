package com.vula.stories;

import android.content.Context;
import com.getcapacitor.CapConfig;
import com.getcapacitor.PluginConfig;
import org.json.JSONException;
import org.json.JSONObject;

/** Preserve bundled configuration while disabling the native OTA scheduler in debug. */
final class DebugCapConfig extends CapConfig {
    DebugCapConfig(Context context) { super(context.getAssets(), null); }

    @Override
    public boolean isWebContentsDebuggingEnabled() { return true; }

    @Override
    public PluginConfig getPluginConfiguration(String id) {
        PluginConfig plugin = super.getPluginConfiguration(id);
        if (!"CapacitorUpdater".equals(id)) return plugin;
        disableUpdater(plugin.getConfigJSON());
        return plugin;
    }

    static void disableUpdater(JSONObject plugin) {
        try {
            plugin.put("autoUpdate", false);
            plugin.put("periodCheckDelay", 0);
        } catch (JSONException error) {
            throw new IllegalStateException("Cannot disable debug OTA", error);
        }
    }
}
