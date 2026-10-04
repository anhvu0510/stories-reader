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
import com.vula.stories.player.PrefetchRetryManager;
import com.vula.stories.player.StoriesAudioBridge;
import com.vula.stories.tts.NativeWordBoundaryEstimator;
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
public class NativeTTSPlugin extends Plugin implements StoriesAudioBridge.AudioControlListener {
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
    // Dữ liệu frame vị trí từ thu thập từ onRangeStart của Android TTS Engine (nếu được hỗ trợ)
    private final Map<Integer, List<int[]>> chunkRangeStarts = new ConcurrentHashMap<>();

    // Thông tin metadata phục vụ thanh điều khiển âm thanh trên Notification & Lock Screen
    private String currentBookTitle = "Stories Reader";
    private String currentChapterTitle = "Chương đọc";

    private String currentVoice = null;
    private Float currentRate = 1.0f;
    private Float currentPitch = 1.0f;
    private volatile boolean isStreamingPlaying = false;
    // Chỉ số câu mục tiêu đang hoặc chuẩn bị phát (tránh deadlock khi player.getCurrentChunkIndex() khởi tạo là -1)
    private int currentPlayIndex = 0;

    // Quản lý cơ chế thử lại cuốn chiếu (Linear Backoff Retry) khi gặp sự cố
    private final PrefetchRetryManager retryManager = new PrefetchRetryManager();

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
                currentPlayIndex = chunkIndex;
                JSObject chunkData = new JSObject();
                chunkData.put("chunkIndex", chunkIndex);
                notifyListeners("onChunkStart", chunkData);

                String playText = (chunkIndex >= 0 && chunkIndex < currentChunks.size()) ? currentChunks.get(chunkIndex) : "";
                JSONObject playDetails = new JSONObject();
                try {
                    playDetails.put("chunkIndex", chunkIndex);
                    playDetails.put("totalChunks", currentChunks.size());
                    playDetails.put("snippet", RemoteLogger.formatSnippet(playText));
                } catch (Exception ignored) {}
                RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Đang đọc câu " + (chunkIndex + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(playText) + "\"", null, playDetails);

                // Cập nhật thông tin câu đọc và trạng thái phát lên thanh điều khiển Notification & Lock Screen
                StoriesAudioBridge.updatePlayback(
                        getContext(),
                        currentBookTitle,
                        currentChapterTitle,
                        playText,
                        true,
                        chunkIndex > 0,
                        chunkIndex < currentChunks.size() - 1
                );
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

                // Đồng bộ trạng thái Play/Pause lên thanh thông báo và màn hình khóa
                int currentIdx = player != null ? player.getCurrentChunkIndex() : 0;
                String currentText = (currentIdx >= 0 && currentIdx < currentChunks.size()) ? currentChunks.get(currentIdx) : "";
                StoriesAudioBridge.updatePlayback(
                        getContext(),
                        currentBookTitle,
                        currentChapterTitle,
                        currentText,
                        isPlaying,
                        currentIdx > 0,
                        currentIdx < currentChunks.size() - 1
                );
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
                    try {
                        int index = Integer.parseInt(utteranceId.substring("stream_chunk_".length()));
                        if (frame >= 0) {
                            chunkRangeStarts.computeIfAbsent(index, k -> Collections.synchronizedList(new ArrayList<>())).add(new int[]{start, end, frame});
                        }
                    } catch (Exception ignored) {}
                    return; // Streaming word boundary được đồng bộ qua GaplessStreamPlayer
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
                    readyDetails.put("snippet", RemoteLogger.formatSnippet(text));
                } catch (Exception ignored) {}
                RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Đã nạp xong audio câu " + (index + 1) + "/" + currentChunks.size() + " (" + chunkFile.length() + " bytes): \"" + RemoteLogger.formatSnippet(text) + "\"", null, readyDetails);

                // Xóa bộ đếm retry khi nạp thành công
                retryManager.recordSuccess(index);

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
            chunkRangeStarts.remove(index);
            String text = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
            handlePrefetchFailure(index, text, "SYNTH_PROGRESS_ERROR");
        } catch (Exception ignored) {}
    }

    /**
     * Tính toán vị trí từng từ và thời lượng (startSeconds, endSeconds) cho câu văn.
     * 1. Ưu tiên sử dụng frame thực tế từ Android TTS Engine (onRangeStart) nếu có hỗ trợ.
     * 2. Fallback sang Deep Module NativeWordBoundaryEstimator tính toán theo mô hình âm học tiếng Việt
     *    (bù trừ khoảng lặng đầu/cuối, phân bổ thời gian cho dấu câu ngắt nghỉ và trọng số âm tiết).
     */
    private JSONArray computeWordBoundaries(int chunkIndex, String text, File wavFile) {
        if (text == null || text.trim().isEmpty()) return new JSONArray();

        List<int[]> rangeStarts = chunkRangeStarts.remove(chunkIndex);
        if (rangeStarts != null && !rangeStarts.isEmpty()) {
            JSONArray boundaries = tryBuildBoundariesFromRangeStarts(text, wavFile, rangeStarts);
            if (boundaries != null && boundaries.length() > 0) {
                return boundaries;
            }
        }

        return NativeWordBoundaryEstimator.estimateBoundaries(chunkIndex, text, wavFile);
    }

    /**
     * Thử xây dựng danh sách word boundaries dựa trên frame audio thực tế do Android TTS engine cung cấp.
     */
    private JSONArray tryBuildBoundariesFromRangeStarts(String text, File wavFile, List<int[]> rangeStarts) {
        if (rangeStarts == null || rangeStarts.isEmpty() || text == null) return null;

        long durationMs = NativeWordBoundaryEstimator.getWavDurationMs(wavFile);
        if (durationMs <= 0) return null;

        // Ước tính sample rate từ thời lượng và frame lớn nhất
        int maxFrame = 0;
        for (int[] r : rangeStarts) {
            if (r[2] > maxFrame) maxFrame = r[2];
        }
        if (maxFrame <= 0) return null;

        double totalSec = (double) durationMs / 1000.0;
        double estimatedSampleRate = (double) maxFrame / Math.max(0.1, totalSec - 0.2);
        if (estimatedSampleRate < 8000 || estimatedSampleRate > 96000) {
            return null;
        }

        JSONArray boundaries = new JSONArray();
        for (int i = 0; i < rangeStarts.size(); i++) {
            int[] r = rangeStarts.get(i);
            int start = r[0];
            int end = r[1];
            int frame = r[2];

            if (start >= 0 && end <= text.length() && start < end) {
                String rawWord = text.substring(start, end).trim();
                if (!rawWord.isEmpty()) {
                    double startSec = (double) frame / estimatedSampleRate;
                    double endSec = (i + 1 < rangeStarts.size())
                            ? (double) rangeStarts.get(i + 1)[2] / estimatedSampleRate
                            : Math.min(totalSec, startSec + 0.3);

                    try {
                        JSONObject wb = new JSONObject();
                        wb.put("text", rawWord);
                        wb.put("charIndex", start);
                        wb.put("charLength", end - start);
                        wb.put("startSeconds", startSec);
                        wb.put("endSeconds", Math.max(startSec + 0.1, endSec));
                        boundaries.put(wb);
                    } catch (Exception ignored) {}
                }
            }
        }

        return boundaries.length() > 0 ? boundaries : null;
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
            currentBookTitle = call.getString("bookTitle", "Stories Reader");
            currentChapterTitle = call.getString("chapterTitle", "Chương đọc");

            // Dừng luồng phát cũ trước khi khởi tạo luồng mới
            stopPlaybackInternal(false);

            // Đăng ký nhận sự kiện điều khiển từ thanh thông báo / màn hình khóa SAU KHI dừng luồng cũ
            StoriesAudioBridge.registerListener(this);

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
            retryManager.reset();

            // Tổng hợp và phát câu khởi đầu
            int validStart = Math.max(0, Math.min(startIndex, currentChunks.size() - 1));
            currentPlayIndex = validStart;
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
                    handlePrefetchFailure(index, text, "ErrorCode: " + result);
                }
            } catch (Exception ex) {
                Log.e(TAG, "Error submitting synthesizeToFile for chunk " + index, ex);
                inFlightIndices.remove(index);
                handlePrefetchFailure(index, text, ex.getMessage());
            }
        });
    }

    /**
     * Tự động thử lại khi tổng hợp audio câu gặp sự cố (Linear Backoff Retry):
     */
    private void handlePrefetchFailure(int index, String text, String errMsg) {
        if (!isStreamingPlaying) return;

        JSONObject failDetails = new JSONObject();
        try {
            failDetails.put("chunkIndex", index);
            failDetails.put("totalChunks", currentChunks.size());
            failDetails.put("snippet", RemoteLogger.formatSnippet(text));
            failDetails.put("error", errMsg);
        } catch (Exception ignored) {}

        if (retryManager.canRetry(index)) {
            int attempt = retryManager.recordFailure(index);
            long delayMs = retryManager.getDelayMs(index);

            RemoteLogger.log("NativeTTS_Stream", "warn",
                    "[NativeTTS:Stream] Lỗi tổng hợp audio câu " + (index + 1) + "/" + currentChunks.size()
                            + " (" + errMsg + "), thử lại lần " + attempt + "/" + PrefetchRetryManager.DEFAULT_MAX_RETRIES + " sau " + delayMs + "ms...",
                    errMsg, failDetails);

            mainHandler.postDelayed(() -> {
                if (isStreamingPlaying && !readyAudioFiles.containsKey(index)) {
                    prefetchChunk(index);
                }
            }, delayMs);
        } else {
            RemoteLogger.log("NativeTTS_Stream", "error",
                    "[NativeTTS:Stream] Thất bại tổng hợp audio câu " + (index + 1) + "/" + currentChunks.size()
                            + " sau " + PrefetchRetryManager.DEFAULT_MAX_RETRIES + " lần thử: " + errMsg + " - Nội dung: \"" + RemoteLogger.formatSnippet(text) + "\"",
                    errMsg, failDetails);

            if (index == currentPlayIndex && !player.hasCurrentPlayer()) {
                RemoteLogger.log("NativeTTS_Stream", "warn",
                        "[NativeTTS:Stream] Tự động bỏ qua câu lỗi " + (index + 1) + " để tiếp tục câu " + (index + 2) + "/" + currentChunks.size(),
                        null, failDetails);
                int next = index + 1;
                if (next < currentChunks.size()) {
                    seekToChunkInternal(next);
                } else {
                    stopPlaybackInternal(false);
                    notifyListeners("onPlaybackComplete", new JSObject());
                }
            }
        }
    }

    /**
     * Khi file audio của 1 câu đã sẵn sàng trên đĩa:
     * - Nếu là câu hiện tại cần đọc: Bắt đầu phát ngay bằng player.start().
     * - Nếu là câu kế tiếp: Kết nối gối đầu gapless 0ms bằng player.prepareNext().
     */
    private void onChunkAudioReady(int index) {
        if (!isStreamingPlaying) return;

        // Nếu là câu hiện tại cần đọc và player chưa phát: Khởi động phát ngay (tránh bế tắc logic khi player.currentChunkIndex = -1)
        if (index == currentPlayIndex && !player.hasCurrentPlayer()) {
            player.start(index, readyAudioFiles.get(index));
        } else if (index == currentPlayIndex + 1 && player.hasCurrentPlayer() && !player.hasNextPlayer()) {
            player.prepareNext(index, readyAudioFiles.get(index));
            String nextText = (index >= 0 && index < currentChunks.size()) ? currentChunks.get(index) : "";
            JSONObject nextDetails = new JSONObject();
            try {
                nextDetails.put("chunkIndex", index);
                nextDetails.put("totalChunks", currentChunks.size());
                nextDetails.put("snippet", RemoteLogger.formatSnippet(nextText));
            } catch (Exception ignored) {}
            RemoteLogger.log("NativeTTS_Stream", "info", "[NativeTTS:Stream] Đã chuẩn bị gapless câu tiếp theo " + (index + 1) + "/" + currentChunks.size() + ": \"" + RemoteLogger.formatSnippet(nextText) + "\"", null, nextDetails);
        }

        maintainRollingBuffer();
    }

    private void handleChunkCompleted(int completedIndex) {
        if (!isStreamingPlaying) return;

        int nextIdx = completedIndex + 1;
        currentPlayIndex = nextIdx;
        if (nextIdx < currentChunks.size()) {
            // Nếu GaplessStreamPlayer đã tự động chuyển sang nextPlayer (0ms gapless transition)
            if (player.hasCurrentPlayer() && player.getCurrentChunkIndex() == nextIdx) {
                maintainRollingBuffer();
                return;
            }

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

        int currentIdx = (player != null && player.hasCurrentPlayer()) ? player.getCurrentChunkIndex() : currentPlayIndex;
        cacheManager.evictOldChunks(currentIdx, readyAudioFiles, readyWordBoundaries, inFlightIndices);

        // 1. Ưu tiên tuyệt đối: Nếu câu hiện tại chưa có audio thì nạp ngay
        if (!readyAudioFiles.containsKey(currentPlayIndex) && currentPlayIndex >= 0 && currentPlayIndex < currentChunks.size()) {
            prefetchChunk(currentPlayIndex);
            return;
        }

        // 2. Chuẩn bị nextPlayer gapless transition nếu câu tiếp theo đã sẵn sàng trong cache
        int nextIdx = currentIdx + 1;
        if (nextIdx < currentChunks.size() && readyAudioFiles.containsKey(nextIdx) && !player.hasNextPlayer() && player.hasCurrentPlayer()) {
            player.prepareNext(nextIdx, readyAudioFiles.get(nextIdx));
        }

        // 3. Nạp trước liên tục các câu kế tiếp (Rolling Buffer)
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
        chunkRangeStarts.clear();
        retryManager.reset();

        // Hủy đăng ký listener và tắt thông báo trên thanh trạng thái / màn hình khóa
        StoriesAudioBridge.unregisterListener(this);
        StoriesAudioBridge.stopPlayback(getContext());

        if (resetPosition) {
            player.reset();
        } else {
            player.stop();
        }
    }

    /**
     * Chuyển đến vị trí câu chỉ định (seek):
     * Dùng chung cho cả lệnh từ Web và lệnh từ nút Next / Previous trên Notification.
     */
    public void seekToChunkInternal(int chunkIndex) {
        if (chunkIndex < 0 || chunkIndex >= currentChunks.size()) return;

        currentPlayIndex = chunkIndex;
        inFlightIndices.clear();
        player.stop();
        retryManager.reset();

        if (readyAudioFiles.containsKey(chunkIndex)) {
            player.start(chunkIndex, readyAudioFiles.get(chunkIndex));
        } else {
            prefetchChunk(chunkIndex);
        }
        maintainRollingBuffer();
    }

    @PluginMethod
    public void seekToChunk(PluginCall call) {
        int chunkIndex = call.getInt("chunkIndex", -1);
        if (chunkIndex < 0 || chunkIndex >= currentChunks.size()) {
            call.reject("Invalid chunk index: " + chunkIndex, "INVALID_INDEX");
            return;
        }

        seekToChunkInternal(chunkIndex);
        call.resolve();
    }

    // ==========================================
    // Callbacks điều khiển từ Notification / Lock Screen (StoriesAudioBridge.AudioControlListener)
    // ==========================================

    @Override
    public void onPlayRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null && player.isPaused()) {
                    player.resume();
                    maintainRollingBuffer();
                }
            });
        }
    }

    @Override
    public void onPauseRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null && player.isPlayingSafely()) {
                    player.pause();
                }
            });
        }
    }

    @Override
    public void onNextRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null) {
                    int currentIdx = player.hasCurrentPlayer() ? player.getCurrentChunkIndex() : currentPlayIndex;
                    int next = currentIdx + 1;
                    if (next < currentChunks.size()) {
                        seekToChunkInternal(next);
                    }
                }
            });
        }
    }

    @Override
    public void onPreviousRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && player != null) {
                    int currentIdx = player.hasCurrentPlayer() ? player.getCurrentChunkIndex() : currentPlayIndex;
                    int prev = currentIdx - 1;
                    if (prev >= 0) {
                        seekToChunkInternal(prev);
                    }
                }
            });
        }
    }

    @Override
    public void onStopRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                stopPlaybackInternal(true);
            });
        }
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
