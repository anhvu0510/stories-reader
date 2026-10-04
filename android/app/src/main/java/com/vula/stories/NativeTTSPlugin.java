package com.vula.stories;

import android.media.MediaMetadataRetriever;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.vula.stories.player.GaplessStreamPlayer;
import com.vula.stories.tts.edge.AudioCacheManager;
import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.RemoteLogger;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin {
    private static final String TAG = "NativeTTSPlugin";

    private TextToSpeech tts;
    private boolean isInitialized = false;
    private final List<Runnable> pendingInitTasks = new ArrayList<>();
    private PluginCall currentSpeakCall = null;
    private android.os.PowerManager.WakeLock wakeLock = null;

    // Ahead-of-time Gapless Streaming Engine
    private GaplessStreamPlayer player;
    private AudioCacheManager cacheManager;
    private Handler mainHandler;
    private final ExecutorService synthesisExecutor = Executors.newSingleThreadExecutor();

    private final List<String> currentChunks = new ArrayList<>();
    private final Map<Integer, File> readyAudioFiles = new ConcurrentHashMap<>();
    private final Map<Integer, JSONArray> readyWordBoundaries = new ConcurrentHashMap<>();
    private final Set<Integer> inFlightIndices = Collections.synchronizedSet(new HashSet<>());

    private String currentVoice = null;
    private Float currentRate = 1.0f;
    private Float currentPitch = 1.0f;
    private volatile boolean isStreamingPlaying = false;

    private synchronized void acquireWakeLock() {
        try {
            if (wakeLock == null && getContext() != null) {
                android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "stories:NativeTTSWakeLock");
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(20 * 60 * 1000L); // 20 minutes safety timeout
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire wake lock: " + e.getMessage());
        }
    }

    private synchronized void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not release wake lock: " + e.getMessage());
        }
    }

    @Override
    public void load() {
        super.load();
        mainHandler = new Handler(Looper.getMainLooper());
        cacheManager = new AudioCacheManager(getContext(), "native_device_tts_cache", ".wav");
        cacheManager.cleanCacheDir(false);

        player = new GaplessStreamPlayer(getContext(), new GaplessStreamPlayer.PlayerListener() {
            @Override
            public void onChunkStart(int chunkIndex) {
                JSObject chunkData = new JSObject();
                chunkData.put("chunkIndex", chunkIndex);
                notifyListeners("onChunkStart", chunkData);

                String playText = (chunkIndex >= 0 && chunkIndex < currentChunks.size()) ? currentChunks.get(chunkIndex) : "";
                JSONObject playDetails = new JSONObject();
                try {
                    playDetails.put("chunkIndex", chunkIndex);
                    playDetails.put("totalChunks", currentChunks.size());
                    playDetails.put("fullText", playText);
                } catch (Exception ignored) {}
                RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Đang đọc câu " + (chunkIndex + 1) + "/" + currentChunks.size() + ": \"" + playText + "\"", null, playDetails);
            }

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                JSObject ev = new JSObject();
                ev.put("chunkIndex", chunkIndex);
                ev.put("charIndex", charIndex);
                ev.put("charLength", charLength);
                ev.put("text", text);
                notifyListeners("onWordBoundary", ev);
            }

            @Override
            public void onPlaybackStateChange(boolean isPlaying, boolean isPaused, boolean isBuffering) {
                JSObject state = new JSObject();
                state.put("isPlaying", isPlaying);
                state.put("isPaused", isPaused);
                state.put("isBuffering", isBuffering);
                notifyListeners("onPlaybackStateChange", state);
            }

            @Override
            public void onChunkCompleted(int completedIndex) {
                handleChunkCompleted(completedIndex);
            }

            @Override
            public void onAllCompleted() {
                // Handled in handleChunkCompleted
            }
        });

        player.setWordBoundariesSource(readyWordBoundaries);
        BreadcrumbTracker.add(TAG, "NativeTTSPlugin loaded with GaplessStreamPlayer");
        initTTS(null);
    }

    private synchronized void initTTS(String enginePackage) {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception e) {
                Log.w(TAG, "Error shutting down previous TTS: " + e.getMessage());
            }
            tts = null;
            isInitialized = false;
        }

        TextToSpeech.OnInitListener listener = status -> {
            synchronized (NativeTTSPlugin.this) {
                if (status == TextToSpeech.SUCCESS) {
                    isInitialized = true;
                    Log.i(TAG, "TTS initialized successfully");
                    setupUtteranceListener();
                    for (Runnable task : pendingInitTasks) {
                        try {
                            task.run();
                        } catch (Exception e) {
                            Log.e(TAG, "Error executing pending task: " + e.getMessage());
                        }
                    }
                    pendingInitTasks.clear();
                } else {
                    isInitialized = false;
                    Log.e(TAG, "TTS initialization failed with code: " + status);
                    pendingInitTasks.clear();
                }
            }
        };

        if (enginePackage != null && !enginePackage.trim().isEmpty()) {
            tts = new TextToSpeech(getContext(), listener, enginePackage.trim());
        } else {
            tts = new TextToSpeech(getContext(), listener);
        }
    }

    private void setupUtteranceListener() {
        if (tts == null) return;
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith("stream_chunk_")) {
                    return; // Streaming chunk start handled via GaplessStreamPlayer
                }
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onStart", data);
            }

            @Override
            public void onDone(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith("stream_chunk_")) {
                    handleStreamUtteranceDone(utteranceId);
                    return;
                }

                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onDone", data);
                synchronized (NativeTTSPlugin.this) {
                    if (currentSpeakCall != null) {
                        currentSpeakCall.resolve(data);
                        currentSpeakCall = null;
                    }
                }
            }

            @Override
            public void onError(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith("stream_chunk_")) {
                    handleStreamUtteranceError(utteranceId);
                    return;
                }

                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("error", "Playback failed");
                notifyListeners("onError", data);
                synchronized (NativeTTSPlugin.this) {
                    if (currentSpeakCall != null) {
                        currentSpeakCall.reject("Playback failed for " + utteranceId);
                        currentSpeakCall = null;
                    }
                }
            }

            @Override
            public void onRangeStart(String utteranceId, int start, int end, int frame) {
                if (utteranceId != null && utteranceId.startsWith("stream_chunk_")) {
                    return; // Streaming word boundary handled via GaplessStreamPlayer
                }
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("start", start);
                data.put("end", end);
                notifyListeners("onRangeStart", data);
            }
        });
    }

    /**
     * Xử lý khi Android TextToSpeech tổng hợp xong 1 câu thành file .wav trên đĩa.
     * Tính toán word boundaries theo thời lượng thực tế của file âm thanh để phục vụ highlight mượt mà.
     */
    private void handleStreamUtteranceDone(String utteranceId) {
        try {
            int index = Integer.parseInt(utteranceId.substring("stream_chunk_".length()));
            inFlightIndices.remove(index);
            File chunkFile = cacheManager.getChunkFile(index);
            if (chunkFile.exists() && chunkFile.length() > 0) {
                String text = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
                JSONArray wb = computeWordBoundaries(index, text, chunkFile);
                readyWordBoundaries.put(index, wb);
                readyAudioFiles.put(index, chunkFile);

                JSONObject readyDetails = new JSONObject();
                try {
                    readyDetails.put("chunkIndex", index);
                    readyDetails.put("totalChunks", currentChunks.size());
                    readyDetails.put("bytes", chunkFile.length());
                    readyDetails.put("wordsCount", wb.length());
                    readyDetails.put("fullText", text);
                } catch (Exception ignored) {}
                RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Đã nạp xong audio câu " + (index + 1) + "/" + currentChunks.size() + " (" + chunkFile.length() + " bytes): \"" + text + "\"", null, readyDetails);

                // Chuyển sang main thread để kích hoạt phát hoặc nạp gối đầu gapless
                mainHandler.post(() -> onChunkAudioReady(index));
            }
        } catch (Exception ex) {
            Log.e(TAG, "Error handling onDone for streaming utterance: " + utteranceId, ex);
        }
    }

    /**
     * Xử lý khi tổng hợp câu bị lỗi. Giải phóng index khỏi danh sách đang xử lý (in-flight).
     */
    private void handleStreamUtteranceError(String utteranceId) {
        try {
            int index = Integer.parseInt(utteranceId.substring("stream_chunk_".length()));
            inFlightIndices.remove(index);
            String text = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
            JSONObject errDetails = new JSONObject();
            try {
                errDetails.put("chunkIndex", index);
                errDetails.put("totalChunks", currentChunks.size());
                errDetails.put("fullText", text);
            } catch (Exception ignored) {}
            RemoteLogger.log("NativeTTS_Stream", "error", "[NativeTTS:Stream] Lỗi tổng hợp audio câu " + (index + 1) + "/" + currentChunks.size() + ": \"" + text + "\"", "SYNTH_ERROR", errDetails);
        } catch (Exception ignored) {}
    }

    /**
     * Tính toán vị trí từng từ và thời lượng (startSeconds, endSeconds) cho câu văn.
     * Sử dụng thời lượng thực tế của file .wav để chia tỷ lệ chính xác, giúp bộ đếm 25ms của GaplessStreamPlayer
     * cập nhật vị trí highlight mượt mà từng từ theo tiến trình âm thanh.
     */
    private JSONArray computeWordBoundaries(int chunkIndex, String text, File wavFile) {
        JSONArray boundaries = new JSONArray();
        if (text == null || text.trim().isEmpty()) return boundaries;

        long durationMs = 0;
        try (MediaMetadataRetriever mmr = new MediaMetadataRetriever()) {
            mmr.setDataSource(wavFile.getAbsolutePath());
            String durStr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (durStr != null) {
                durationMs = Long.parseLong(durStr);
            }
        } catch (Exception ignored) {}

        if (durationMs <= 0) {
            durationMs = Math.max(500, (long) ((text.length() / 15.0) * 1000.0));
        }

        Pattern wordPattern = Pattern.compile("\\S+");
        Matcher matcher = wordPattern.matcher(text);
        List<int[]> words = new ArrayList<>();
        int totalWordChars = 0;
        while (matcher.find()) {
            int start = matcher.start();
            int end = matcher.end();
            int len = end - start;
            words.add(new int[]{start, len});
            totalWordChars += len;
        }

        if (!words.isEmpty() && durationMs > 0) {
            double totalSec = (double) durationMs / 1000.0;
            double currentSec = 0.0;
            for (int[] w : words) {
                int charIdx = w[0];
                int charLen = w[1];
                double wordWeight = (double) charLen / Math.max(1, totalWordChars);
                double wordDur = totalSec * wordWeight;

                try {
                    JSONObject wb = new JSONObject();
                    wb.put("text", text.substring(charIdx, charIdx + charLen));
                    wb.put("charIndex", charIdx);
                    wb.put("charLength", charLen);
                    wb.put("startSeconds", currentSec);
                    wb.put("endSeconds", currentSec + wordDur);
                    boundaries.put(wb);
                } catch (Exception ignored) {}

                currentSec += wordDur;
            }
        }
        return boundaries;
    }

    private void runWhenReady(Runnable runnable, PluginCall call) {
        synchronized (this) {
            if (isInitialized && tts != null) {
                runnable.run();
            } else {
                pendingInitTasks.add(runnable);
            }
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", isInitialized && tts != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void getEngines(PluginCall call) {
        runWhenReady(() -> {
            try {
                List<TextToSpeech.EngineInfo> engines = tts.getEngines();
                JSArray jsEngines = new JSArray();
                String defaultEngine = tts.getDefaultEngine();
                if (engines != null) {
                    for (TextToSpeech.EngineInfo e : engines) {
                        JSObject obj = new JSObject();
                        obj.put("name", e.name);
                        obj.put("label", e.label);
                        obj.put("isDefault", e.name.equalsIgnoreCase(defaultEngine));
                        jsEngines.put(obj);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("engines", jsEngines);
                ret.put("defaultEngine", defaultEngine);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get engines: " + e.getMessage());
            }
        }, call);
    }

    @PluginMethod
    public void setEngine(PluginCall call) {
        String engine = call.getString("engine");
        if (engine == null || engine.trim().isEmpty()) {
            call.reject("Engine package name is required");
            return;
        }
        initTTS(engine.trim());
        runWhenReady(() -> {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("engine", engine);
            call.resolve(ret);
        }, call);
    }

    @PluginMethod
    public void getVoices(PluginCall call) {
        runWhenReady(() -> {
            try {
                Set<Voice> voices = tts.getVoices();
                JSArray jsVoices = new JSArray();
                if (voices != null) {
                    for (Voice v : voices) {
                        Locale loc = v.getLocale();
                        String langTag = loc != null ? loc.toLanguageTag() : "";
                        String lang = loc != null ? loc.getLanguage() : "";

                        JSObject obj = new JSObject();
                        obj.put("name", v.getName());
                        obj.put("lang", langTag);
                        obj.put("language", lang);
                        obj.put("displayName", (loc != null ? loc.getDisplayName() : v.getName()) + " (" + v.getName() + ")");
                        obj.put("quality", v.getQuality());
                        obj.put("latency", v.getLatency());
                        obj.put("requiresNetwork", v.isNetworkConnectionRequired());
                        jsVoices.put(obj);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("voices", jsVoices);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get voices: " + e.getMessage());
            }
        }, call);
    }

    // ==========================================
    // Ahead-of-time Gapless Chapter Streaming Methods
    // Các phương thức phát chương cuốn chiếu gối đầu gapless 0ms
    // ==========================================

    /**
     * Bắt đầu phát toàn bộ một chương truyện:
     * 1. Nạp danh sách các câu (chunks).
     * 2. Áp dụng cấu hình giọng đọc, tốc độ (rate), cao độ (pitch).
     * 3. Giữ WakeLock ngăn hệ điều hành ngắt khi tắt màn hình.
     * 4. Bắt đầu tổng hợp câu đầu tiên và nạp trước sẵn (lookahead) tối đa 6 câu tiếp theo.
     */
    @PluginMethod
    public void playChapter(PluginCall call) {
        runWhenReady(() -> {
            JSArray chunksArray = call.getArray("chunks");
            if (chunksArray == null || chunksArray.length() == 0) {
                call.reject("Chunks list cannot be empty", "INVALID_INPUT");
                return;
            }

            int startIndex = call.getInt("startIndex", 0);
            currentVoice = call.getString("voice", null);
            currentRate = call.getFloat("rate", 1.0f);
            currentPitch = call.getFloat("pitch", 1.0f);

            // Dừng luồng phát cũ trước khi khởi tạo luồng mới
            stopPlaybackInternal(false);

            currentChunks.clear();
            for (int i = 0; i < chunksArray.length(); i++) {
                try {
                    currentChunks.add(chunksArray.getString(i));
                } catch (Exception e) {
                    currentChunks.add("");
                }
            }

            applyVoiceSettings();

            isStreamingPlaying = true;
            player.acquireWakeLock();

            // Tổng hợp và phát câu khởi đầu
            int validStart = Math.max(0, Math.min(startIndex, currentChunks.size() - 1));
            prefetchChunk(validStart);

            // Nạp trước cuốn chiếu (pre-warm) các câu tiếp theo vào bộ nhớ đệm
            int maxLookahead = Math.min(currentChunks.size() - 1, validStart + AudioCacheManager.BUFFER_LOOKAHEAD);
            for (int i = validStart + 1; i <= maxLookahead; i++) {
                prefetchChunk(i);
            }

            call.resolve();
        }, call);
    }

    /**
     * Áp dụng cấu hình tốc độ đọc, cao độ và tìm kiếm Voice tương thích trong hệ thống.
     */
    private void applyVoiceSettings() {
        if (tts == null) return;
        try {
            if (currentRate != null) {
                tts.setSpeechRate(currentRate);
            }
            if (currentPitch != null) {
                tts.setPitch(currentPitch);
            }
            if (currentVoice != null && !currentVoice.trim().isEmpty()) {
                Set<Voice> voices = tts.getVoices();
                if (voices != null) {
                    for (Voice v : voices) {
                        if (v.getName().equalsIgnoreCase(currentVoice.trim())) {
                            tts.setVoice(v);
                            return;
                        }
                    }
                }
            }
            tts.setLanguage(new Locale("vi", "VN"));
        } catch (Exception ex) {
            Log.w(TAG, "Error applying voice settings: " + ex.getMessage());
        }
    }

    /**
     * Nạp trước (prefetch) câu văn:
     * - Nếu file .wav đã tồn tại trên đĩa: nạp ngay từ cache và phát.
     * - Nếu chưa có: gửi yêu cầu tts.synthesizeToFile tổng hợp bất đồng bộ ra file .wav.
     */
    private void prefetchChunk(int index) {
        if (index < 0 || index >= currentChunks.size()) return;
        if (readyAudioFiles.containsKey(index) || inFlightIndices.contains(index)) return;

        File chunkFile = cacheManager.getChunkFile(index);
        if (chunkFile.exists() && chunkFile.length() > 0) {
            readyAudioFiles.put(index, chunkFile);
            readyWordBoundaries.put(index, computeWordBoundaries(index, currentChunks.get(index), chunkFile));
            mainHandler.post(() -> onChunkAudioReady(index));
            return;
        }

        inFlightIndices.add(index);
        String text = currentChunks.get(index);
        if (text == null || text.trim().isEmpty()) {
            inFlightIndices.remove(index);
            return;
        }

        synthesisExecutor.submit(() -> {
            try {
                applyVoiceSettings();
                Bundle params = new Bundle();
                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "stream_chunk_" + index);
                int result = tts.synthesizeToFile(text, params, chunkFile, "stream_chunk_" + index);
                if (result != TextToSpeech.SUCCESS) {
                    Log.e(TAG, "synthesizeToFile returned error code " + result + " for chunk " + index);
                    inFlightIndices.remove(index);
                }
            } catch (Exception ex) {
                Log.e(TAG, "Error submitting synthesizeToFile for chunk " + index, ex);
                inFlightIndices.remove(index);
            }
        });
    }

    /**
     * Khi file audio của 1 câu đã sẵn sàng trên đĩa:
     * - Nếu là câu hiện tại cần đọc: Bắt đầu phát ngay bằng player.start().
     * - Nếu là câu kế tiếp: Kết nối gối đầu gapless 0ms bằng player.prepareNext().
     */
    private void onChunkAudioReady(int index) {
        if (!isStreamingPlaying) return;

        int currentIdx = player.getCurrentChunkIndex();
        if (index == currentIdx && !player.hasCurrentPlayer()) {
            player.start(index, readyAudioFiles.get(index));
        } else if (index == currentIdx + 1 && player.hasCurrentPlayer() && !player.hasNextPlayer()) {
            player.prepareNext(index, readyAudioFiles.get(index));
            String nextText = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
            JSONObject nextDetails = new JSONObject();
            try {
                nextDetails.put("chunkIndex", index);
                nextDetails.put("totalChunks", currentChunks.size());
                nextDetails.put("fullText", nextText);
            } catch (Exception ignored) {}
            RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Đã chuẩn bị gapless câu tiếp theo " + (index + 1) + "/" + currentChunks.size() + ": \"" + nextText + "\"", null, nextDetails);
        }

        maintainRollingBuffer();
    }

    private void handleChunkCompleted(int completedIndex) {
        if (!isStreamingPlaying) return;

        int nextIdx = completedIndex + 1;
        if (nextIdx < currentChunks.size()) {
            JSObject state = new JSObject();
            state.put("isPlaying", true);
            state.put("isPaused", false);
            state.put("isBuffering", true);
            notifyListeners("onPlaybackStateChange", state);

            if (readyAudioFiles.containsKey(nextIdx)) {
                player.start(nextIdx, readyAudioFiles.get(nextIdx));
            } else {
                prefetchChunk(nextIdx);
            }
            maintainRollingBuffer();
        } else {
            JSONObject allDoneDetails = new JSONObject();
            try {
                allDoneDetails.put("totalChunks", currentChunks.size());
            } catch (Exception ignored) {}
            RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Hoàn tất đọc hết toàn bộ chương (" + currentChunks.size() + " câu)", null, allDoneDetails);

            stopPlaybackInternal(false);
            notifyListeners("onPlaybackComplete", new JSObject());
        }
    }

    private void maintainRollingBuffer() {
        if (!isStreamingPlaying || player.isPaused()) return;

        int currentIdx = player.getCurrentChunkIndex();
        cacheManager.evictOldChunks(currentIdx, readyAudioFiles, readyWordBoundaries, inFlightIndices);

        if (!readyAudioFiles.containsKey(currentIdx) && currentIdx >= 0) {
            prefetchChunk(currentIdx);
            return;
        }

        int nextIdx = currentIdx + 1;
        if (nextIdx < currentChunks.size() && readyAudioFiles.containsKey(nextIdx) && !player.hasNextPlayer() && player.hasCurrentPlayer()) {
            player.prepareNext(nextIdx, readyAudioFiles.get(nextIdx));
        }

        if (inFlightIndices.isEmpty()) {
            int maxLookahead = Math.min(currentChunks.size() - 1, currentIdx + AudioCacheManager.BUFFER_LOOKAHEAD);
            for (int i = currentIdx + 1; i <= maxLookahead; i++) {
                if (!readyAudioFiles.containsKey(i)) {
                    prefetchChunk(i);
                    break;
                }
            }
        }
    }

    @PluginMethod
    public void pausePlayback(PluginCall call) {
        player.pause();
        call.resolve();
    }

    @PluginMethod
    public void resumePlayback(PluginCall call) {
        player.resume();
        maintainRollingBuffer();
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        stopPlaybackInternal(true);
        call.resolve();
    }

    private void stopPlaybackInternal(boolean resetPosition) {
        isStreamingPlaying = false;
        inFlightIndices.clear();
        if (resetPosition) {
            player.reset();
        } else {
            player.stop();
        }
    }

    @PluginMethod
    public void seekToChunk(PluginCall call) {
        int chunkIndex = call.getInt("chunkIndex", -1);
        if (chunkIndex < 0 || chunkIndex >= currentChunks.size()) {
            call.reject("Invalid chunk index: " + chunkIndex, "INVALID_INDEX");
            return;
        }

        inFlightIndices.clear();
        player.stop();

        if (readyAudioFiles.containsKey(chunkIndex)) {
            player.start(chunkIndex, readyAudioFiles.get(chunkIndex));
        } else {
            prefetchChunk(chunkIndex);
        }
        maintainRollingBuffer();
        call.resolve();
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        cacheManager.cleanCacheDir(true);
        readyAudioFiles.clear();
        readyWordBoundaries.clear();
        BreadcrumbTracker.add(TAG, "Native device TTS cache cleared");
        call.resolve();
    }

    // ==========================================
    // Single-shot Legacy speak Method
    // ==========================================

    @PluginMethod
    public void speak(PluginCall call) {
        runWhenReady(() -> {
            String text = call.getString("text", "");
            String voiceName = call.getString("voice", null);
            Float rate = call.getFloat("rate", 1.0f);
            Float pitch = call.getFloat("pitch", 1.0f);
            String utteranceId = call.getString("utteranceId", String.valueOf(System.currentTimeMillis()));

            if (text == null || text.trim().isEmpty()) {
                call.resolve();
                return;
            }

            try {
                if (rate != null) {
                    tts.setSpeechRate(rate);
                }
                if (pitch != null) {
                    tts.setPitch(pitch);
                }

                if (voiceName != null && !voiceName.trim().isEmpty()) {
                    Set<Voice> voices = tts.getVoices();
                    if (voices != null) {
                        for (Voice v : voices) {
                            if (v.getName().equalsIgnoreCase(voiceName.trim())) {
                                tts.setVoice(v);
                                break;
                            }
                        }
                    }
                } else {
                    tts.setLanguage(new Locale("vi", "VN"));
                }

                synchronized (NativeTTSPlugin.this) {
                    currentSpeakCall = call;
                }

                acquireWakeLock();
                Bundle params = new Bundle();
                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
                int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
                if (result != TextToSpeech.SUCCESS) {
                    synchronized (NativeTTSPlugin.this) {
                        currentSpeakCall = null;
                    }
                    releaseWakeLock();
                    call.reject("TTS speak failed with code: " + result);
                }
            } catch (Exception e) {
                synchronized (NativeTTSPlugin.this) {
                    currentSpeakCall = null;
                }
                releaseWakeLock();
                call.reject("TTS speak error: " + e.getMessage());
            }
        }, call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            stopPlaybackInternal(true);
            releaseWakeLock();
            if (tts != null) {
                tts.stop();
            }
            synchronized (this) {
                if (currentSpeakCall != null) {
                    currentSpeakCall.resolve();
                    currentSpeakCall = null;
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error stopping TTS: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopPlaybackInternal(true);
        synthesisExecutor.shutdown();
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
        releaseWakeLock();
        super.handleOnDestroy();
    }
}
