package com.vula.stories.logging;

import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

/**
 * Global Uncaught Exception Handler & Crash Diagnostics.
 * Intercepts fatal crashes on all threads, aggregates device and memory telemetry,
 * and transmits synchronous logs to the Gateway server before process termination.
 */
public class CrashReporter implements Thread.UncaughtExceptionHandler {
    private static final String TAG = "CrashReporter";
    private static final String CRASH_DUMP_FILE = "pending_crash_dump.json";

    private final Context appContext;
    private final Thread.UncaughtExceptionHandler defaultHandler;

    public CrashReporter(Context context, Thread.UncaughtExceptionHandler defaultHandler) {
        this.appContext = context.getApplicationContext();
        this.defaultHandler = defaultHandler;
    }

    public static synchronized void init(Context context) {
        if (context == null) return;
        Context appCtx = context.getApplicationContext();
        Thread.UncaughtExceptionHandler currentHandler = Thread.getDefaultUncaughtExceptionHandler();
        if (!(currentHandler instanceof CrashReporter)) {
            Thread.setDefaultUncaughtExceptionHandler(new CrashReporter(appCtx, currentHandler));
            Log.i(TAG, "Global CrashReporter registered successfully");
        }

        // Check and deliver any pending offline crash dump from previous crash
        deliverPendingOfflineCrash(appCtx);
    }

    @Override
    public void uncaughtException(Thread thread, Throwable throwable) {
        try {
            Log.e(TAG, "FATAL CRASH detected on thread: " + thread.getName(), throwable);
            BreadcrumbTracker.add("CRASH", "Fatal exception on thread: " + thread.getName() + " -> " + throwable.getMessage());

            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);
            throwable.printStackTrace(pw);
            String fullStackTrace = sw.toString();

            JSONObject crashDetails = new JSONObject();
            crashDetails.put("crashType", "FATAL_UNCAUGHT_EXCEPTION");
            crashDetails.put("threadName", thread.getName());
            crashDetails.put("threadId", thread.getId());
            crashDetails.put("exceptionClass", throwable.getClass().getName());
            crashDetails.put("exceptionMessage", throwable.getMessage() != null ? throwable.getMessage() : "");

            // 1. Device Telemetry
            JSONObject deviceObj = new JSONObject();
            deviceObj.put("manufacturer", Build.MANUFACTURER);
            deviceObj.put("model", Build.MODEL);
            deviceObj.put("brand", Build.BRAND);
            deviceObj.put("androidVersion", Build.VERSION.RELEASE);
            deviceObj.put("sdkInt", Build.VERSION.SDK_INT);
            deviceObj.put("hardware", Build.HARDWARE);
            try {
                PackageInfo pInfo = appContext.getPackageManager().getPackageInfo(appContext.getPackageName(), 0);
                deviceObj.put("appVersionName", pInfo.versionName);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    deviceObj.put("appVersionCode", pInfo.getLongVersionCode());
                } else {
                    deviceObj.put("appVersionCode", pInfo.versionCode);
                }
            } catch (Exception ignored) {}
            crashDetails.put("device", deviceObj);

            // 2. Memory Telemetry
            JSONObject memObj = new JSONObject();
            Runtime runtime = Runtime.getRuntime();
            long maxMemMb = runtime.maxMemory() / (1024 * 1024);
            long totalMemMb = runtime.totalMemory() / (1024 * 1024);
            long freeMemMb = runtime.freeMemory() / (1024 * 1024);
            long usedMemMb = totalMemMb - freeMemMb;
            memObj.put("jvmUsedMb", usedMemMb);
            memObj.put("jvmFreeMb", freeMemMb);
            memObj.put("jvmMaxMb", maxMemMb);

            try {
                ActivityManager am = (ActivityManager) appContext.getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                    am.getMemoryInfo(mi);
                    memObj.put("systemAvailMb", mi.availMem / (1024 * 1024));
                    memObj.put("systemTotalMb", mi.totalMem / (1024 * 1024));
                    memObj.put("isLowMemory", mi.lowMemory);
                }
            } catch (Exception ignored) {}
            crashDetails.put("memory", memObj);

            // 3. Action Breadcrumbs
            crashDetails.put("breadcrumbs", BreadcrumbTracker.getBreadcrumbsAsJson());

            String fatalMessage = "[FATAL_CRASH] " + throwable.getClass().getSimpleName()
                    + " in '" + thread.getName() + "': " + throwable.getMessage();

            // Synchronous delivery with 3s budget before process kill
            boolean delivered = RemoteLogger.logSync("CrashReporter", "fatal", fatalMessage, fullStackTrace, crashDetails, 3);
            if (!delivered) {
                // Save offline dump to internal storage
                saveOfflineCrashDump(fatalMessage, fullStackTrace, crashDetails);
            }
        } catch (Throwable handlerError) {
            Log.e(TAG, "Error inside uncaughtException handler", handlerError);
        } finally {
            // Forward to original handler so Android OS can terminate the process cleanly
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        }
    }

    private void saveOfflineCrashDump(String message, String error, JSONObject details) {
        try {
            JSONObject dump = new JSONObject();
            dump.put("message", message);
            dump.put("error", error);
            dump.put("details", details);
            dump.put("timestamp", System.currentTimeMillis());

            File file = new File(appContext.getFilesDir(), CRASH_DUMP_FILE);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(dump.toString().getBytes(StandardCharsets.UTF_8));
            }
            Log.w(TAG, "Offline crash dump saved to " + file.getAbsolutePath());
        } catch (Exception ex) {
            Log.e(TAG, "Failed to persist offline crash dump", ex);
        }
    }

    private static void deliverPendingOfflineCrash(Context context) {
        new Thread(() -> {
            try {
                File file = new File(context.getFilesDir(), CRASH_DUMP_FILE);
                if (file.exists()) {
                    byte[] data = new byte[(int) file.length()];
                    try (FileInputStream fis = new FileInputStream(file)) {
                        int read = fis.read(data);
                        if (read > 0) {
                            String content = new String(data, StandardCharsets.UTF_8);
                            JSONObject dump = new JSONObject(content);
                            String msg = "[OFFLINE_CRASH_RECOVERED] " + dump.optString("message", "");
                            String err = dump.optString("error", "");
                            JSONObject details = dump.optJSONObject("details");
                            RemoteLogger.log("CrashReporter", "error", msg, err, details);
                        }
                    }
                    file.delete();
                    Log.i(TAG, "Pending offline crash delivered and deleted");
                }
            } catch (Exception ex) {
                Log.w(TAG, "Error checking offline crash dump", ex);
            }
        }).start();
    }
}
