package com.vula.stories.tts;

import android.media.MediaMetadataRetriever;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deep Module tính toán mốc thời gian từng từ (Word Boundaries) cho giọng đọc Native Android:
 * 
 * Vấn đề gốc rễ trước đây:
 * 1. Thuật toán cũ chia tuyến tính tổng thời lượng file cho số ký tự (charLen / totalChars),
 *    dẫn đến từ ngắn (ở, và, có) bị gán thời lượng siêu ngắn (40ms-50ms) gây giật chữ, nhảy cóc.
 * 2. Bỏ qua hoàn toàn khoảng lặng đầu file (leading silence ~150ms), khiến highlight bật sáng
 *    ngay khi loa chưa kịp phát ra âm thanh.
 * 3. Bỏ qua khoảng dừng nghỉ của dấu câu (dấu phẩy nghỉ 250ms, dấu chấm nghỉ 450ms). Khi gặp
 *    dấu câu, giọng đọc dừng lại nhưng highlight vẫn chạy tiếp, gây trôi lệch tích lũy (timing drift)
 *    lên tới 1-2 giây về cuối câu.
 * 4. Tokenizer cũ dùng regex "\\S+" dính cả dấu ngoặc kép, dấu chấm, dấu phẩy vào charIndex/charLength,
 *    làm DOM highlighter bôi đen lệch vị trí văn bản.
 * 
 * Giải pháp của module này:
 * - Tách từ thông minh chỉ lấy phần chữ cái/số [\\p{L}\\p{N}]+ để charIndex và charLength luôn chuẩn xác.
 * - Mô hình âm học tiếng Việt (Vietnamese Phonetic Timing Model):
 *   + Trừ hao khoảng lặng mở đầu (leading silence) và kết thúc (trailing silence).
 *   + Dành riêng khoảng thời gian nghỉ cho các dấu câu (phẩy, chấm, hỏi, than, ngoặc kép).
 *   + Phân bổ trọng số âm tiết cân bằng (base weight 1.0 + phụ tố ký tự) phù hợp ngôn ngữ đơn lập.
 */
public class NativeWordBoundaryEstimator {

    private static final String TAG = "NativeWbEstimator";

    // Khoảng lặng mở đầu file WAV của Android TTS trước khi từ đầu tiên phát âm (giây)
    public static final double LEADING_SILENCE_SEC = 0.14;

    // Khoảng lặng kết thúc câu trước khi chuyển sang câu tiếp theo (giây)
    public static final double TRAILING_SILENCE_SEC = 0.16;

    // Thời gian nghỉ cho dấu ngắt câu mạnh (chấm, hỏi, than, ba chấm) (giây)
    public static final double PERIOD_PAUSE_SEC = 0.40;

    // Thời gian nghỉ cho dấu ngắt vế câu (phẩy, chấm phẩy, hai chấm, gạch ngang) (giây)
    public static final double COMMA_PAUSE_SEC = 0.24;

    // Thời gian nghỉ cho dấu ngoặc kép, ngoặc đơn (giây)
    public static final double QUOTE_PAUSE_SEC = 0.12;

    // Khoảng thở chuyển âm tự nhiên giữa 2 từ thông thường (giây)
    public static final double INTER_WORD_GAP_SEC = 0.04;

    // Thời lượng phát âm tối thiểu cho một âm tiết tiếng Việt (giây)
    public static final double MIN_WORD_DURATION_SEC = 0.14;

    // Trọng số cơ sở cho một âm tiết tiếng Việt (nguyên âm + thanh điệu)
    public static final double BASE_SYLLABLE_WEIGHT = 1.0;

    // Trọng số gia tăng cho mỗi ký tự vượt quá 2 ký tự (phụ âm ghép, vần dài)
    public static final double CHAR_COMPONENT_WEIGHT = 0.12;

    // Regex tìm từ tiếng Việt hoặc số nguyên thủy
    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}\\p{N}]+");

    /**
     * Cấu trúc thông tin âm học của một từ trong câu văn.
     */
    public static class WordToken {
        public final String text;
        public final int charIndex;
        public final int charLength;
        public double pauseAfterSec;
        public double phoneticWeight;

        public WordToken(String text, int charIndex, int charLength) {
            this.text = text;
            this.charIndex = charIndex;
            this.charLength = charLength;
            this.pauseAfterSec = 0.0;
            // Tính trọng số âm học dựa trên độ dài âm tiết tiếng Việt
            this.phoneticWeight = BASE_SYLLABLE_WEIGHT + CHAR_COMPONENT_WEIGHT * Math.max(0, charLength - 2);
        }
    }

    /**
     * Bóc tách câu văn thành danh sách các từ sạch, xác định khoảng dừng dấu câu theo sau mỗi từ.
     */
    public static List<WordToken> tokenize(String text) {
        List<WordToken> tokens = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) return tokens;

        Matcher matcher = WORD_PATTERN.matcher(text);
        List<int[]> spans = new ArrayList<>();
        while (matcher.find()) {
            spans.add(new int[]{matcher.start(), matcher.end()});
        }

        for (int i = 0; i < spans.size(); i++) {
            int[] current = spans.get(i);
            int start = current[0];
            int end = current[1];
            String wordText = text.substring(start, end);
            WordToken token = new WordToken(wordText, start, end - start);

            // Xác định phần ký tự nằm giữa từ này và từ tiếp theo (chứa dấu câu)
            int nextStart = (i + 1 < spans.size()) ? spans.get(i + 1)[0] : text.length();
            String separator = text.substring(end, nextStart);

            token.pauseAfterSec = determinePauseDuration(separator, i == spans.size() - 1);
            tokens.add(token);
        }

        return tokens;
    }

    /**
     * Xác định thời lượng ngắt nghỉ dựa trên dấu câu theo sau từ.
     */
    private static double determinePauseDuration(String separator, boolean isLastWord) {
        if (isLastWord) {
            return 0.0; // Khoảng lặng cuối câu do TRAILING_SILENCE_SEC đảm nhiệm
        }
        if (separator == null || separator.isEmpty()) {
            return INTER_WORD_GAP_SEC;
        }

        if (separator.contains(".") || separator.contains("?") || separator.contains("!") || separator.contains("…")) {
            return PERIOD_PAUSE_SEC;
        }
        if (separator.contains(",") || separator.contains(";") || separator.contains(":") || separator.contains("—") || separator.contains("–") || separator.contains("-")) {
            return COMMA_PAUSE_SEC;
        }
        if (separator.contains("\"") || separator.contains("”") || separator.contains("“") || separator.contains(")")) {
            return QUOTE_PAUSE_SEC;
        }

        return INTER_WORD_GAP_SEC;
    }

    /**
     * Đọc thời lượng thực tế của file âm thanh .wav (tính bằng mili-giây).
     * Ưu tiên đọc trực tiếp từ WAV header chuẩn để đạt hiệu năng tối đa và độ chính xác microsecond.
     */
    public static long getWavDurationMs(File wavFile) {
        if (wavFile == null || !wavFile.exists() || wavFile.length() < 44) {
            return 0;
        }

        // Bước 1: Đọc nhanh từ WAV Header (44 bytes đầu)
        try (InputStream is = new FileInputStream(wavFile)) {
            byte[] header = new byte[44];
            int read = is.read(header);
            if (read >= 44) {
                String riff = new String(header, 0, 4);
                String wave = new String(header, 8, 4);
                if ("RIFF".equals(riff) && "WAVE".equals(wave)) {
                    int byteRate = (header[28] & 0xFF) |
                            ((header[29] & 0xFF) << 8) |
                            ((header[30] & 0xFF) << 16) |
                            ((header[31] & 0xFF) << 24);

                    int dataSize = (header[40] & 0xFF) |
                            ((header[41] & 0xFF) << 8) |
                            ((header[42] & 0xFF) << 16) |
                            ((header[43] & 0xFF) << 24);

                    if (byteRate > 0 && dataSize > 0) {
                        return (long) ((dataSize * 1000.0) / byteRate);
                    }
                }
            }
        } catch (Exception ignored) {}

        // Bước 2: Fallback sang MediaMetadataRetriever
        try (MediaMetadataRetriever mmr = new MediaMetadataRetriever()) {
            mmr.setDataSource(wavFile.getAbsolutePath());
            String durStr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (durStr != null) {
                return Long.parseLong(durStr);
            }
        } catch (Exception ignored) {}

        return 0;
    }

    /**
     * Tính toán danh sách mốc thời gian từng từ (Word Boundaries) theo mô hình âm học tiếng Việt.
     * 
     * @param chunkIndex Chỉ số câu trong danh sách chương
     * @param text Nội dung câu văn bản gốc
     * @param wavFile File âm thanh .wav do Android TTS tổng hợp
     * @return JSONArray chứa các mốc thời gian JSON chuẩn {text, charIndex, charLength, startSeconds, endSeconds}
     */
    public static JSONArray estimateBoundaries(int chunkIndex, String text, File wavFile) {
        JSONArray boundaries = new JSONArray();
        if (text == null || text.trim().isEmpty()) return boundaries;

        List<WordToken> tokens = tokenize(text);
        if (tokens.isEmpty()) return boundaries;

        long durationMs = wavFile != null ? getWavDurationMs(wavFile) : 0;
        if (durationMs <= 0) {
            // Dự toán an toàn: trung bình 15 ký tự / giây + 300ms mở đầu
            durationMs = Math.max(600, (long) ((text.length() / 14.0) * 1000.0) + 300);
        }

        double totalDurationSec = (double) durationMs / 1000.0;

        // Trừ hao khoảng lặng đầu và đuôi
        double leadingSilence = Math.min(LEADING_SILENCE_SEC, totalDurationSec * 0.15);
        double trailingSilence = Math.min(TRAILING_SILENCE_SEC, totalDurationSec * 0.15);
        double availableSpeechSec = Math.max(0.2, totalDurationSec - leadingSilence - trailingSilence);

        // Tính tổng thời gian tạm dừng của các dấu câu
        double totalRawPauseSec = 0.0;
        double totalPhoneticWeight = 0.0;
        for (WordToken token : tokens) {
            totalRawPauseSec += token.pauseAfterSec;
            totalPhoneticWeight += token.phoneticWeight;
        }

        // Đảm bảo các khoảng nghỉ dấu câu không chiếm quá 45% tổng thời lượng câu
        double maxAllowedPauseTotal = availableSpeechSec * 0.45;
        double pauseScale = (totalRawPauseSec > maxAllowedPauseTotal && totalRawPauseSec > 0)
                ? maxAllowedPauseTotal / totalRawPauseSec
                : 1.0;

        double totalAdjustedPauseSec = totalRawPauseSec * pauseScale;
        double speechPoolSec = Math.max(tokens.size() * MIN_WORD_DURATION_SEC, availableSpeechSec - totalAdjustedPauseSec);

        // Phân bổ mốc thời gian cho từng từ
        double currentSec = leadingSilence;
        for (int i = 0; i < tokens.size(); i++) {
            WordToken token = tokens.get(i);
            double weightRatio = totalPhoneticWeight > 0 ? (token.phoneticWeight / totalPhoneticWeight) : (1.0 / tokens.size());
            double wordDur = Math.max(MIN_WORD_DURATION_SEC, speechPoolSec * weightRatio);

            double startSec = currentSec;
            double endSec = Math.min(totalDurationSec, startSec + wordDur);

            try {
                JSONObject wb = new JSONObject();
                wb.put("text", token.text);
                wb.put("charIndex", token.charIndex);
                wb.put("charLength", token.charLength);
                wb.put("startSeconds", startSec);
                wb.put("endSeconds", endSec);
                boundaries.put(wb);
            } catch (Exception ignored) {}

            double pauseSec = token.pauseAfterSec * pauseScale;
            currentSec = endSec + pauseSec;
        }

        return boundaries;
    }
}
