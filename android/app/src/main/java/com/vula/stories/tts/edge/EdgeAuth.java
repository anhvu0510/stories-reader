package com.vula.stories.tts.edge;

import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

import okhttp3.Request;

/**
 * Encapsulates Bing Edge TTS authentication tokens, headers, and SSML synthesis payloads.
 */
public class EdgeAuth {
    private static final String TAG = "EdgeAuth";

    public static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    public static final String CHROMIUM_FULL_VERSION = "143.0.3650.75";
    public static final String CHROMIUM_MAJOR_VERSION = "143";
    public static final String SEC_MS_GEC_VERSION = "1-143.0.3650.75";
    private static final long WIN_EPOCH = 11644473600L;

    public static String generateSecMsGec() {
        try {
            long nowSeconds = System.currentTimeMillis() / 1000L;
            long ticks = (nowSeconds + WIN_EPOCH) * 10000000L;
            ticks -= (ticks % 3000000000L);
            String strToHash = ticks + TRUSTED_CLIENT_TOKEN;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(strToHash.getBytes(StandardCharsets.US_ASCII));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02X", b));
            }
            return hex.toString();
        } catch (Exception e) {
            Log.e(TAG, "Failed to compute Sec-MS-GEC", e);
            return "";
        }
    }

    public static String buildWebSocketUrl() {
        String secMsGec = generateSecMsGec();
        return "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
                + "?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
                + "&Sec-MS-GEC=" + secMsGec
                + "&Sec-MS-GEC-Version=" + SEC_MS_GEC_VERSION;
    }

    public static Request buildWebSocketRequest(String wssUrl) {
        return new Request.Builder()
                .url(wssUrl)
                .addHeader("Pragma", "no-cache")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + CHROMIUM_MAJOR_VERSION + ".0.0.0 Safari/537.36 Edg/" + CHROMIUM_MAJOR_VERSION + ".0.0.0")
                .addHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                .addHeader("Accept-Language", "en-US,en;q=0.9")
                .addHeader("Accept-Encoding", "gzip, deflate, br, zstd")
                .build();
    }

    public static String getTimestampIso() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }

    public static String escapeXml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    public static String buildSpeechConfigMessage() {
        String configPayload = "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}";
        return "X-Timestamp: " + getTimestampIso() + "\r\n"
                + "Content-Type: application/json; charset=utf-8\r\n"
                + "Path: speech.config\r\n\r\n"
                + configPayload;
    }

    public static String buildSsmlMessage(String requestId, String voice, String rate, String pitch, String text) {
        String escaped = escapeXml(text != null ? text.trim() : "");
        String ssml = "<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xml:lang=\"vi-VN\">"
                + "<voice name=\"" + voice + "\">"
                + "<prosody rate=\"" + rate + "\" pitch=\"" + pitch + "\">"
                + escaped
                + "</prosody></voice></speak>";
        return "X-RequestId: " + requestId + "\r\n"
                + "Content-Type: application/ssml+xml\r\n"
                + "X-Timestamp: " + getTimestampIso() + "\r\n"
                + "Path: ssml\r\n\r\n"
                + ssml;
    }
}
