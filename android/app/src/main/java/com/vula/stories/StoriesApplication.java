package com.vula.stories;

import android.app.Application;
import android.util.Log;

import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.CrashReporter;
import com.vula.stories.logging.RemoteLogger;

public class StoriesApplication extends Application {
    private static final String TAG = "StoriesApplication";

    @Override
    public void onCreate() {
        super.onCreate();
        // 1. Initialize centralized remote logger
        RemoteLogger.init(this);

        // 2. Register global uncaught exception crash handler
        CrashReporter.init(this);

        // 3. Drop initialization breadcrumb
        BreadcrumbTracker.add("App", "Application process initialized");
        Log.i(TAG, "StoriesApplication initialized with remote logging and crash handling");
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        BreadcrumbTracker.add("System", "onLowMemory warning triggered");
        RemoteLogger.log("System", "warn", "Application onLowMemory event triggered", null, null);
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        BreadcrumbTracker.add("System", "onTrimMemory level=" + level);
    }
}
