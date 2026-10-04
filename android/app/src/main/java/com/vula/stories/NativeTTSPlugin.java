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

import com.vula.stories.player.NativeSpeechQueueManager;
import com.vula.stories.player.StoriesAudioBridge;
import com.vula.stories.logging.BreadcrumbTracker;
import com.vula.stories.logging.RemoteLogger;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin implements StoriesAudioBridge.AudioControlListener {
    private static final String TAG = "NativeTTSPlugin";

    private TextToSpeech tts;
    private boolean isInitialized = false;
    private final List<Runnable> pendingInitTasks = new ArrayList<>();
    private PluginCall currentSpeakCall = null;
    private android.os.PowerManager.WakeLock wakeLock = null;

    // Ahead-of-time Direct Native Speech Queue Engine (Phương án 1: Real-time onRangeStart)
    private NativeSpeechQueueManager queueManager;
    private Handler mainHandler;

    // Thông tin metadata phục vụ thanh điều khiển âm thanh trên Notification & Lock Screen
    private String currentBookTitle = "Stories Reader";
    private String currentChapterTitle = "Chương đọc";

    private String currentVoice = null;
    private Float currentRate = 1.0f;
    private Float currentPitch = 1.0f;
    private volatile boolean isStreamingPlaying = false;
    // Chỉ số câu mục tiêu đang hoặc chuẩn bị phát
    private int currentPlayIndex = 0;

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

        // Khởi tạo Deep Module NativeSpeechQueueManager (Phương án 1: Phát trực tiếp và lắng nghe onRangeStart thời gian thực)
        queueManager = new NativeSpeechQueueManager();
        queueManager.setListener(new NativeSpeechQueueManager.SpeechStreamListener() {
            @Override
            public void onChunkStart(int chunkIndex) {
                currentPlayIndex = chunkIndex;
                JSObject chunkData = new JSObject();
                chunkData.put("chunkIndex", chunkIndex);
                notifyListeners("onChunkStart", chunkData);

                String playText = queueManager.getCurrentText();
                // Ghi log Logcat nội bộ thiết bị, không gửi RemoteLogger trên từng câu để tránh nghẽn mạng và spam gateway
                Log.d(TAG, "[NativeTTS:Direct] Đang đọc câu " + (chunkIndex + 1) + "/" + queueManager.getTotalChunks() + ": \"" + RemoteLogger.formatSnippet(playText) + "\"");

                // Cập nhật thông tin câu đọc và trạng thái phát lên thanh điều khiển Notification & Lock Screen
                StoriesAudioBridge.updatePlayback(
                        getContext(),
                        currentBookTitle,
                        currentChapterTitle,
                        playText,
                        true,
                        chunkIndex > 0,
                        chunkIndex < queueManager.getTotalChunks() - 1,
                        chunkIndex,
                        queueManager.getTotalChunks()
                );

                // Duy trì nạp trước các câu kế tiếp vào hàng đợi native (rolling queue)
                if (tts != null) {
                    queueManager.maintainQueue(tts, buildSpeechParams());
                }
            }

            @Override
            public void onWordBoundary(int chunkIndex, int charIndex, int charLength, String text) {
                // Sự kiện vị trí từ thời gian thực (0ms latency) từ Speech Engine trên máy!
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

                // Nếu đang trong tiến trình dừng hẳn luồng đọc (!isStreamingPlaying && !isPlaying),
                // ngắt ngay cập nhật Notification để tránh xung đột với lệnh dừng Service
                if (!isStreamingPlaying && !isPlaying) {
                    return;
                }

                int currentIdx = queueManager.getCurrentChunkIndex();
                String currentText = queueManager.getCurrentText();
                StoriesAudioBridge.updatePlayback(
                        getContext(),
                        currentBookTitle,
                        currentChapterTitle,
                        currentText,
                        isPlaying,
                        currentIdx > 0,
                        currentIdx < queueManager.getTotalChunks() - 1,
                        currentIdx,
                        queueManager.getTotalChunks()
                );
            }

            @Override
            public void onChunkCompleted(int completedIndex) {
                // Đã đọc xong một câu
            }

            @Override
            public void onAllCompleted() {
                JSObject doneData = new JSObject();
                notifyListeners("onPlaybackComplete", doneData);
                StoriesAudioBridge.stopPlayback(getContext());
                releaseWakeLock();
            }
        });

        BreadcrumbTracker.add(TAG, "NativeTTSPlugin loaded with NativeSpeechQueueManager");
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
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleChunkStart(utteranceId));
                    return;
                }
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                notifyListeners("onStart", data);
            }

            @Override
            public void onDone(String utteranceId) {
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleChunkDone(utteranceId));
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
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    mainHandler.post(() -> queueManager.handleChunkError(utteranceId, tts, buildSpeechParams()));
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
                if (utteranceId != null && utteranceId.startsWith(NativeSpeechQueueManager.UTTERANCE_PREFIX)) {
                    // Sự kiện vị trí từ thời gian thực (0ms latency) do chính Android Speech Engine kích hoạt!
                    mainHandler.post(() -> queueManager.handleRangeStart(utteranceId, start, end));
                    return;
                }
                JSObject data = new JSObject();
                data.put("utteranceId", utteranceId);
                data.put("start", start);
                data.put("end", end);
                notifyListeners("onRangeStart", data);
            }
        });
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
    // Ahead-of-time Direct Native Speech Queue Streaming Methods
    // Phương án 1: Phát âm thanh trực tiếp và bắt sự kiện onRangeStart thời gian thực (0ms latency)
    // ==========================================

    private Bundle buildSpeechParams() {
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_STREAM, String.valueOf(android.media.AudioManager.STREAM_MUSIC));
        return params;
    }

    /**
     * Bắt đầu phát toàn bộ một chương truyện (Phương án 1: Direct Native Speech Queue):
     * 1. Nạp danh sách các câu (chunks) vào NativeSpeechQueueManager.
     * 2. Áp dụng cấu hình giọng đọc, tốc độ (rate), cao độ (pitch).
     * 3. Giữ WakeLock ngăn hệ điều hành ngắt khi tắt màn hình.
     * 4. Bắt đầu phát ngay lập tức qua tts.speak() và xếp hàng đợi QUEUE_ADD.
     * 5. Nhận sự kiện onRangeStart từ Android TTS engine trong thời gian thực (0ms latency).
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

            List<String> chunkList = new ArrayList<>();
            for (int i = 0; i < chunksArray.length(); i++) {
                try {
                    chunkList.add(chunksArray.getString(i));
                } catch (Exception e) {
                    chunkList.add("");
                }
            }

            applyVoiceSettings();
            acquireWakeLock();

            isStreamingPlaying = true;
            queueManager.setChunks(chunkList, startIndex);
            queueManager.startSpeaking(tts, startIndex, buildSpeechParams());

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



    @PluginMethod
    public void pausePlayback(PluginCall call) {
        if (tts != null) {
            tts.stop();
        }
        if (queueManager != null) {
            queueManager.notifyPaused();
            StoriesAudioBridge.updatePlayback(
                    getContext(),
                    currentBookTitle,
                    currentChapterTitle,
                    queueManager.getCurrentText(),
                    false,
                    queueManager.getCurrentChunkIndex() > 0,
                    queueManager.getCurrentChunkIndex() < queueManager.getTotalChunks() - 1,
                    queueManager.getCurrentChunkIndex(),
                    queueManager.getTotalChunks()
            );
        }
        call.resolve();
    }

    @PluginMethod
    public void resumePlayback(PluginCall call) {
        if (tts != null && queueManager != null) {
            applyVoiceSettings();
            queueManager.startSpeaking(tts, queueManager.getCurrentChunkIndex(), buildSpeechParams());
            queueManager.notifyResumed();
        }
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        stopPlaybackInternal(true);
        call.resolve();
    }

    private void stopPlaybackInternal(boolean resetPosition) {
        isStreamingPlaying = false;
        if (tts != null) {
            tts.stop();
        }
        if (queueManager != null) {
            queueManager.notifyStopped();
        }

        // Hủy đăng ký listener và tắt thông báo trên thanh trạng thái / màn hình khóa
        StoriesAudioBridge.unregisterListener(this);
        StoriesAudioBridge.stopPlayback(getContext());
        releaseWakeLock();
    }

    /**
     * Chuyển đến vị trí câu chỉ định (seek):
     * Dùng chung cho cả lệnh từ Web và lệnh từ nút Next / Previous trên Notification.
     */
    public void seekToChunkInternal(int chunkIndex) {
        if (queueManager == null || chunkIndex < 0 || chunkIndex >= queueManager.getTotalChunks()) return;

        currentPlayIndex = chunkIndex;
        if (tts != null) {
            tts.stop();
            applyVoiceSettings();
            queueManager.startSpeaking(tts, chunkIndex, buildSpeechParams());
        }
    }

    @PluginMethod
    public void seekToChunk(PluginCall call) {
        int chunkIndex = call.getInt("chunkIndex", -1);
        if (queueManager == null || chunkIndex < 0 || chunkIndex >= queueManager.getTotalChunks()) {
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
                if (isStreamingPlaying && queueManager != null && queueManager.isPaused()) {
                    if (tts != null) {
                        applyVoiceSettings();
                        queueManager.startSpeaking(tts, queueManager.getCurrentChunkIndex(), buildSpeechParams());
                        queueManager.notifyResumed();
                    }
                }
            });
        }
    }

    @Override
    public void onPauseRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && queueManager != null && queueManager.isPlaying()) {
                    if (tts != null) {
                        tts.stop();
                    }
                    queueManager.notifyPaused();
                    StoriesAudioBridge.updatePlayback(
                            getContext(),
                            currentBookTitle,
                            currentChapterTitle,
                            queueManager.getCurrentText(),
                            false,
                            queueManager.getCurrentChunkIndex() > 0,
                            queueManager.getCurrentChunkIndex() < queueManager.getTotalChunks() - 1,
                            queueManager.getCurrentChunkIndex(),
                            queueManager.getTotalChunks()
                    );
                }
            });
        }
    }

    @Override
    public void onNextRequested() {
        if (mainHandler != null) {
            mainHandler.post(() -> {
                if (isStreamingPlaying && queueManager != null) {
                    int next = queueManager.getCurrentChunkIndex() + 1;
                    if (next < queueManager.getTotalChunks()) {
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
                if (isStreamingPlaying && queueManager != null) {
                    int prev = queueManager.getCurrentChunkIndex() - 1;
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
