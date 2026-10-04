package com.vula.stories.logging;

import org.json.JSONArray;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedList;
import java.util.Locale;

/**
 * Thread-safe Circular Ring-Buffer storing recent application breadcrumbs.
 * Attached to crash reports and error logs for deterministic debugging.
 */
public class BreadcrumbTracker {
    private static final int MAX_BREADCRUMBS = 30;
    private static final LinkedList<String> BREADCRUMBS = new LinkedList<>();
    private static final SimpleDateFormat TIME_FORMAT = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US);

    public static synchronized void add(String tag, String message) {
        if (message == null || message.trim().isEmpty()) return;
        String timestamp = TIME_FORMAT.format(new Date());
        String entry = "[" + timestamp + "][" + (tag != null ? tag : "App") + "] " + message.trim();
        BREADCRUMBS.addLast(entry);
        while (BREADCRUMBS.size() > MAX_BREADCRUMBS) {
            BREADCRUMBS.removeFirst();
        }
    }

    public static synchronized JSONArray getBreadcrumbsAsJson() {
        JSONArray arr = new JSONArray();
        for (String b : BREADCRUMBS) {
            arr.put(b);
        }
        return arr;
    }

    public static synchronized void clear() {
        BREADCRUMBS.clear();
    }
}
