package com.vula.stories.tts.edge;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Phân tích cú pháp khung tin (frames) và siêu dữ liệu WordBoundary nhận từ Edge TTS WebSocket.
 * Tuân thủ quy tắc Flat Guard Clauses và duy nhất 1 ranh giới bắt lỗi cấp cao nhất.
 */
public final class EdgeMetadataParser {

    private static final String TAG = "EdgeMetadataParser";
    private static final String PATH_AUDIO_METADATA = "Path:audio.metadata";
    private static final String PATH_TURN_START = "Path:turn.start";
    private static final String PATH_TURN_END = "Path:turn.end";
    private static final String PATH_RESPONSE = "Path:response";
    private static final String HEADER_DELIMITER = "\r\n\r\n";

    private EdgeMetadataParser() {
        // Lớp tiện ích tĩnh, ngăn khởi tạo
    }

    public static boolean isMetadataFrame(String textMsg) {
        return textMsg != null && textMsg.contains(PATH_AUDIO_METADATA);
    }

    public static boolean isTurnStart(String textMsg) {
        return textMsg != null && textMsg.contains(PATH_TURN_START);
    }

    public static boolean isTurnEnd(String textMsg) {
        return textMsg != null && textMsg.contains(PATH_TURN_END);
    }

    public static boolean isResponse(String textMsg) {
        return textMsg != null && textMsg.contains(PATH_RESPONSE);
    }

    /**
     * Bóc tách danh sách WordBoundary từ khung tin WebSocket metadata.
     * Cập nhật searchOffset để đảm bảo định vị tuần tự các từ trong câu.
     */
    public static List<JSONObject> parseWordBoundaries(String textMsg, String foldedSourceText, int[] searchOffset) {
        if (textMsg == null || foldedSourceText == null || !textMsg.contains(PATH_AUDIO_METADATA)) {
            return Collections.emptyList();
        }

        int jsonStart = textMsg.indexOf(HEADER_DELIMITER);
        if (jsonStart < 0) {
            return Collections.emptyList();
        }

        try {
            String jsonStr = textMsg.substring(jsonStart + HEADER_DELIMITER.length()).trim();
            JSONObject obj = new JSONObject(jsonStr);
            JSONArray metadataList = obj.optJSONArray("Metadata");
            if (metadataList == null || metadataList.length() == 0) {
                return Collections.emptyList();
            }

            List<JSONObject> parsedBoundaries = new ArrayList<>();
            int currentOffset = (searchOffset != null && searchOffset.length > 0) ? searchOffset[0] : 0;

            for (int i = 0; i < metadataList.length(); i++) {
                JSONObject meta = metadataList.optJSONObject(i);
                if (meta == null || !"WordBoundary".equalsIgnoreCase(meta.optString("Type"))) {
                    continue;
                }

                JSONObject data = meta.optJSONObject("Data");
                if (data == null) {
                    continue;
                }

                JSONObject textData = data.optJSONObject("text");
                String rawWord = textData != null ? textData.optString("Text", "") : "";
                if (rawWord.trim().isEmpty()) {
                    continue;
                }

                String normWord = Normalizer.normalize(rawWord.trim(), Normalizer.Form.NFC);
                String cleanWord = normWord.toLowerCase(Locale.ROOT);
                String stripped = cleanWord.replaceAll("^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$", "");
                if (stripped.isEmpty()) {
                    continue;
                }

                int charIndex = foldedSourceText.indexOf(cleanWord, currentOffset);
                int matchedLen = cleanWord.length();

                if (charIndex < 0) {
                    charIndex = foldedSourceText.indexOf(stripped, currentOffset);
                    matchedLen = stripped.length();
                }

                // Fallback lùi 6 ký tự để bù trừ độ lệch do dấu câu bao bọc
                if (charIndex < 0 && currentOffset > 0) {
                    int fallbackOffset = Math.max(0, currentOffset - 6);
                    charIndex = foldedSourceText.indexOf(stripped, fallbackOffset);
                    matchedLen = stripped.length();
                }

                // Fallback tìm lại từ đầu câu nếu searchOffset bị trượt
                if (charIndex < 0) {
                    charIndex = foldedSourceText.indexOf(stripped, 0);
                    matchedLen = stripped.length();
                }

                if (charIndex < 0) {
                    continue;
                }

                currentOffset = charIndex + matchedLen;
                long offsetTicks = data.optLong("Offset", 0);
                long durationTicks = data.optLong("Duration", 0);

                JSONObject wb = new JSONObject();
                wb.put("text", rawWord);
                wb.put("charIndex", charIndex);
                wb.put("charLength", matchedLen);
                wb.put("startSeconds", (double) offsetTicks / 10000000.0);
                wb.put("endSeconds", (double) (offsetTicks + durationTicks) / 10000000.0);

                parsedBoundaries.add(wb);
            }

            if (searchOffset != null && searchOffset.length > 0) {
                searchOffset[0] = currentOffset;
            }

            return parsedBoundaries;
        } catch (Exception e) {
            Log.w(TAG, "Lỗi phân tích cú pháp metadata WebSocket từ Edge TTS: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Bóc tách và đẩy trực tiếp vào JSONArray đích theo cách an toàn luồng.
     */
    public static void appendWordBoundaries(String textMsg, String foldedSourceText, int[] searchOffset, JSONArray targetArray) {
        if (targetArray == null) {
            return;
        }

        List<JSONObject> items = parseWordBoundaries(textMsg, foldedSourceText, searchOffset);
        if (items.isEmpty()) {
            return;
        }

        synchronized (targetArray) {
            for (JSONObject item : items) {
                targetArray.put(item);
            }
        }
    }
}
