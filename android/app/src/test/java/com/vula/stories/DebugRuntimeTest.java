package com.vula.stories;

import static org.junit.Assert.assertEquals;
import org.junit.Test;
import org.json.JSONObject;

public class DebugRuntimeTest {
    @Test
    public void runtimeUsesTheApkBuildType() {
        assertEquals(BuildConfig.DEBUG, new DebugRuntime().isDebugBuild());
    }

    @Test
    public void debugDisablesNativeOtaWithoutReplacingOtherPluginSettings() throws Exception {
        JSONObject plugin = new JSONObject().put("autoUpdate", true).put("channel", "existing");
        DebugCapConfig.disableUpdater(plugin);
        assertEquals(false, plugin.getBoolean("autoUpdate"));
        assertEquals(0, plugin.getInt("periodCheckDelay"));
        assertEquals("existing", plugin.getString("channel"));
    }
}
