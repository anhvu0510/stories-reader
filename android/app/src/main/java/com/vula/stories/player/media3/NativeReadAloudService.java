package com.vula.stories.player.media3;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.DefaultMediaNotificationProvider;
import com.vula.stories.player.ReadAloudArtwork;
import com.vula.stories.R;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BiConsumer;

import okhttp3.WebSocket;

@UnstableApi
public final class NativeReadAloudService extends MediaSessionService {
    private static final String TAG = "NativeReadAloudService";
    private static final int LOW_WATERMARK_MS = 4_000;
    private static final int TARGET_WATERMARK_MS = 11_000;
    private static final long SNAPSHOT_INTERVAL_MS = 250L;
    private static final int MAX_CONCURRENT_SYNTHESIS = 2;

    public static final String ACTION_START = "com.vula.stories.media3.START";
    public static final String ACTION_PAUSE = "com.vula.stories.media3.PAUSE";
    public static final String ACTION_RESUME = "com.vula.stories.media3.RESUME";
    public static final String ACTION_STOP = "com.vula.stories.media3.STOP";
    public static final String ACTION_SEEK = "com.vula.stories.media3.SEEK";
    public static final String EXTRA_UTTERANCE_INDEX = "utteranceIndex";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService synthesisExecutor = Executors.newFixedThreadPool(MAX_CONCURRENT_SYNTHESIS);
    private final AdaptiveBufferPolicy bufferPolicy = new AdaptiveBufferPolicy(LOW_WATERMARK_MS, TARGET_WATERMARK_MS);
    private final RetryPolicy retryPolicy = new RetryPolicy(3, 250L, 2_000L);
    private final PlaybackStateMachine stateMachine = new PlaybackStateMachine();
    private final Map<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
    private final Map<Integer, List<WordBoundary>> boundaries = new ConcurrentHashMap<>();
    private final Map<Integer, WebSocket> sockets = new ConcurrentHashMap<>();
    private final Map<Integer, Integer> retryCounts = new ConcurrentHashMap<>();
    private final Set<Integer> scheduledIndices = Collections.synchronizedSet(new HashSet<>());
    private final Set<Integer> inFlightIndices = ConcurrentHashMap.newKeySet();
    private final Set<Integer> fallbackIndices = Collections.synchronizedSet(new HashSet<>());
    private final List<MediaSource> playlistSources = new ArrayList<>();
    private BiConsumer<Runnable, Long> retryScheduler = (task, delay) -> mainHandler.postDelayed(task, delay);

    private ExoPlayer player;
    private ReadAloudPlaybackControl playbackControl = new ReadAloudPlaybackControl() {
        @Override public int currentIndex() { return player.getCurrentMediaItemIndex(); }
        @Override public long positionMs() { return player.getCurrentPosition(); }
        @Override public boolean playWhenReady() { return player.getPlayWhenReady(); }
        @Override public void replaceSource(int index, AppendableAudioSource source) {
            playlistSources.set(index, createProgressiveMediaSource(index, source));
            player.setMediaSources(playlistSources, false);
        }
        @Override public void seek(int index, long positionMs) { player.seekTo(index, positionMs); }
        @Override public void prepare() { player.prepare(); }
        @Override public void play() { player.play(); }
        @Override public void pause() { player.pause(); }
    };
    private MediaSession mediaSession;
    private EdgeStreamingSynthesizer synthesizer;
    private volatile ReadAloudSessionRequest request;
    private final PlaybackWordBoundaryTracker wordBoundaryTracker = new PlaybackWordBoundaryTracker();
    private long lastSnapshotAt;
    private long sessionStartedAt;
    private long bufferingStartedAt;
    private long firstAudioLatencyMs = -1L;
    private long lastBufferingDurationMs = -1L;

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            publishProgress();
            emitDueWordBoundary();
            if (request != null) mainHandler.postDelayed(this, 20L);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        DefaultMediaNotificationProvider notificationProvider = new DefaultMediaNotificationProvider.Builder(this).build();
        notificationProvider.setSmallIcon(R.drawable.ic_stat_read_aloud);
        setMediaNotificationProvider(notificationProvider);
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(LOW_WATERMARK_MS, TARGET_WATERMARK_MS, 250, 500)
                .build();
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .build();
        player = new ExoPlayer.Builder(this).setLoadControl(loadControl).build();
        player.setAudioAttributes(audioAttributes, true);
        player.addListener(createPlayerListener());
        mediaSession = new MediaSession.Builder(this, player).build();
        // Direct bridge commands never connect a MediaController/onGetSession.
        // Register here so Media3 observes buffering and starts its foreground notification.
        addSession(mediaSession);
        synthesizer = new EdgeStreamingSynthesizer();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) return super.onStartCommand(intent, flags, startId);
        String action = intent.getAction();
        if (ACTION_START.equals(action)) startPendingRequest();
        if (ACTION_PAUSE.equals(action)) pausePlayback();
        if (ACTION_RESUME.equals(action)) resumePlayback();
        if (ACTION_STOP.equals(action)) stopSession();
        if (ACTION_SEEK.equals(action)) seekTo(intent.getIntExtra(EXTRA_UTTERANCE_INDEX, 0));
        return super.onStartCommand(intent, flags, startId);
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onDestroy() {
        stopSession();
        synthesisExecutor.shutdownNow();
        synthesizer.shutdown();
        mediaSession.release();
        player.release();
        super.onDestroy();
    }

    private void startPendingRequest() {
        ReadAloudSessionRequest pendingRequest = Media3ReadAloudBridge.consumePendingRequest();
        if (pendingRequest == null || pendingRequest.getUtterances().isEmpty()) {
            stopSelf();
            return;
        }
        cancelSynthesis();
        player.stop();
        player.clearMediaItems();
        sources.clear();
        boundaries.clear();
        scheduledIndices.clear();
        inFlightIndices.clear();
        fallbackIndices.clear();
        retryCounts.clear();
        request = pendingRequest;
        sessionStartedAt = System.currentTimeMillis();
        bufferingStartedAt = sessionStartedAt;
        firstAudioLatencyMs = -1L;
        lastBufferingDurationMs = -1L;
        wordBoundaryTracker.reset();
        stateMachine.start(request.getSessionId(), request.getStartIndex());
        publishSnapshot();

        playlistSources.clear();
        for (int index = 0; index < request.getUtterances().size(); index++) {
            AppendableAudioSource source = new AppendableAudioSource();
            sources.put(index, source);
            playlistSources.add(createProgressiveMediaSource(index, source));
        }
        player.setMediaSources(playlistSources, request.getStartIndex(), 0L);
        player.prepare();
        player.play();
        triggerNotificationUpdate();
        scheduleBuffer(request.getStartIndex());
        mainHandler.removeCallbacks(progressTicker);
        mainHandler.post(progressTicker);
    }

    private MediaSource createProgressiveMediaSource(int index, AppendableAudioSource source) {
        ReadAloudUtterance utterance = request.getUtterances().get(index);
        MediaMetadata metadata = new MediaMetadata.Builder()
                .setTitle(request.getChapterTitle())
                .setArtist(request.getBookTitle())
                .setDescription(utterance.getText())
                .setAlbumTitle(request.getBookTitle())
                .setArtworkData(ReadAloudArtwork.getPng(this), MediaMetadata.PICTURE_TYPE_FRONT_COVER)
                .build();
        MediaItem item = new MediaItem.Builder()
                .setMediaId(utterance.getId())
                .setUri("memory://stories/" + request.getSessionId() + "/" + index + ".mp3")
                .setMimeType("audio/mpeg")
                .setMediaMetadata(metadata)
                .build();
        return new ProgressiveMediaSource.Factory(source.factory()).createMediaSource(item);
    }

    private void scheduleBuffer(int currentIndex) {
        if (request == null) return;
        if (currentIndex < 0 || currentIndex >= request.getUtterances().size()) return;
        int windowSize = Math.min(request.getUtterances().size() - currentIndex,
                AdaptiveBufferPolicy.MAX_LOOKAHEAD_UTTERANCES + 1);
        List<Long> estimates = new ArrayList<>();
        for (int index = currentIndex; index < currentIndex + windowSize; index++) {
            estimates.add(estimateDurationMs(request.getUtterances().get(index)));
        }
        List<Integer> planned = bufferPolicy.planIndices(currentIndex, request.getUtterances().size(), estimates);
        for (Integer index : planned) {
            if (inFlightIndices.size() >= MAX_CONCURRENT_SYNTHESIS) break;
            startSynthesis(index, 0);
        }
    }

    private void startSynthesis(int index, int attempt) {
        if (request == null || index < 0 || index >= request.getUtterances().size()) return;
        if (!scheduledIndices.add(index) && attempt == 0) return;
        ReadAloudSessionRequest activeRequest = request;
        ReadAloudUtterance utterance = activeRequest.getUtterances().get(index);
        AppendableAudioSource source = sources.get(index);
        if (source == null) return;
        inFlightIndices.add(index);

        synthesisExecutor.submit(() -> {
            if (!isActiveSource(activeRequest, index, source)) return;
            WebSocket socket = synthesizer.synthesize(
                    utterance,
                    activeRequest.getVoice(),
                    activeRequest.getRate(),
                    activeRequest.getPitch(),
                    new EdgeStreamingSynthesizer.Listener() {
                        @Override
                        public void onAudio(byte[] bytes) {
                            if (!isActiveSource(activeRequest, index, source)) return;
                            source.append(bytes);
                        }

                        @Override
                        public void onWordBoundary(WordBoundary boundary) {
                            if (!isActiveSource(activeRequest, index, source)) return;
                            boundaries.computeIfAbsent(index, ignored -> Collections.synchronizedList(new ArrayList<>())).add(boundary);
                        }

                        @Override
                        public void onComplete() {
                            if (!isActiveSource(activeRequest, index, source)) return;
                            source.complete();
                            sockets.remove(index);
                            inFlightIndices.remove(index);
                            mainHandler.post(() -> {
                                if (!isActiveSource(activeRequest, index, source)) return;
                                scheduleBuffer(player.getCurrentMediaItemIndex());
                            });
                        }

                        @Override
                        public void onFailure(IOException error) {
                            if (!isActiveSource(activeRequest, index, source)) return;
                            sockets.remove(index);
                            mainHandler.post(() -> {
                                if (!isActiveSource(activeRequest, index, source)) return;
                                handleSynthesisFailure(activeRequest, index, attempt, source, error);
                            });
                        }
                    }
            );
            if (!isActiveSource(activeRequest, index, source)) {
                socket.cancel();
                return;
            }
            sockets.put(index, socket);
        });
    }

    private void handleSynthesisFailure(
            ReadAloudSessionRequest activeRequest,
            int index,
            int attempt,
            AppendableAudioSource source,
            IOException error
    ) {
        if (!isActiveSource(activeRequest, index, source)) return;
        int completedAttempts = attempt + 1;
        retryCounts.put(index, completedAttempts);
        if (retryPolicy.canRetry(completedAttempts)) {
            AppendableAudioSource retrySource = resetSynthesisSource(index);
            source.fail(error);
            double jitter = (Math.random() - 0.5) * 0.4;
            long delayMs = retryPolicy.delayMillis(attempt, jitter);
            retryScheduler.accept(() -> {
                if (!isActiveSource(activeRequest, index, retrySource)) return;
                startSynthesis(index, completedAttempts);
            }, delayMs);
            return;
        }
        source.fail(error);
        inFlightIndices.remove(index);
        if (index != playbackControl.currentIndex()) {
            scheduleBuffer(playbackControl.currentIndex());
            return;
        }
        failPlayback(index, "SYNTHESIS_FAILED", error.getMessage());
    }

    private AppendableAudioSource resetSynthesisSource(int index) {
        int currentIndex = playbackControl.currentIndex();
        long position = playbackControl.positionMs();
        boolean wasPlaying = playbackControl.playWhenReady();
        AppendableAudioSource replacement = new AppendableAudioSource();
        sources.put(index, replacement);
        boundaries.remove(index);
        fallbackIndices.remove(index);
        playbackControl.replaceSource(index, replacement);
        playbackControl.seek(currentIndex, position);
        if (index != currentIndex) return replacement;
        wordBoundaryTracker.reset();
        playbackControl.prepare();
        if (wasPlaying) playbackControl.play();
        return replacement;
    }

    private void prioritizeSynthesis(int targetIndex) {
        AppendableAudioSource target = sources.get(targetIndex);
        if (target != null && target.isCompleted() && target.getFailure() == null) return;
        for (Integer index : new ArrayList<>(inFlightIndices)) {
            if (index == targetIndex || index == targetIndex + 1) continue;
            AppendableAudioSource oldSource = sources.get(index);
            resetSynthesisSource(index);
            scheduledIndices.remove(index);
            inFlightIndices.remove(index);
            retryCounts.remove(index);
            WebSocket socket = sockets.remove(index);
            if (socket != null) socket.cancel();
            if (oldSource != null) oldSource.fail(new IOException("Synthesis superseded by seek"));
        }
    }

    private Player.Listener createPlayerListener() {
        return new Player.Listener() {
            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                if (request == null) return;
                int index = player.getCurrentMediaItemIndex();
                if (index < 0 || index >= request.getUtterances().size()) return;
                wordBoundaryTracker.reset();
                ReadAloudUtterance utterance = request.getUtterances().get(index);
                Media3ReadAloudBridge.publishUtteranceStart(request.getSessionId(), index, utterance);
                scheduleBuffer(index);
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                publishPlayerState(playbackState);
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                handlePlayerError(error);
            }
        };
    }

    private void publishPlayerState(int playbackState) {
        if (request == null) return;
        if (playbackState == Player.STATE_IDLE && stateMachine.snapshot().getState() == PlaybackSnapshot.State.ERROR) return;
        int index = Math.max(0, player.getCurrentMediaItemIndex());
        PlaybackSnapshot.State state = PlaybackSnapshot.State.IDLE;
        if (playbackState == Player.STATE_BUFFERING) state = PlaybackSnapshot.State.BUFFERING;
        if (playbackState == Player.STATE_READY && player.getPlayWhenReady()) state = PlaybackSnapshot.State.PLAYING;
        if (playbackState == Player.STATE_READY && !player.getPlayWhenReady()) state = PlaybackSnapshot.State.PAUSED;
        if (playbackState == Player.STATE_ENDED) state = PlaybackSnapshot.State.COMPLETED;
        long now = System.currentTimeMillis();
        if (state == PlaybackSnapshot.State.BUFFERING && bufferingStartedAt <= 0L) bufferingStartedAt = now;
        if (state == PlaybackSnapshot.State.PLAYING && firstAudioLatencyMs < 0L) firstAudioLatencyMs = now - sessionStartedAt;
        if (state == PlaybackSnapshot.State.PLAYING && bufferingStartedAt > 0L) {
            lastBufferingDurationMs = now - bufferingStartedAt;
            bufferingStartedAt = 0L;
        }
        stateMachine.transition(request.getSessionId(), state, index, player.getCurrentPosition(), bufferedDurationMs());
        publishSnapshot();
        if (state != PlaybackSnapshot.State.COMPLETED) return;
        Media3ReadAloudBridge.publishCompleted(request.getSessionId());
    }

    private void handlePlayerError(PlaybackException error) {
        if (request == null) return;
        int index = player.getCurrentMediaItemIndex();
        AppendableAudioSource source = sources.get(index);
        if (source != null && source.getFailure() != null) {
            failPlayback(index, "SYNTHESIS_FAILED", source.getFailure().getMessage());
            return;
        }
        if (source != null && source.isCompleted() && source.size() > 0 && fallbackIndices.add(index)
                && activateCompletedFileFallback(index, source.snapshot())) return;
        failPlayback(index, "DECODER_FAILED", error.getMessage());
    }

    private void failPlayback(int index, String code, String message) {
        PlaybackSnapshot snapshot = stateMachine.snapshot();
        if (snapshot.getState() == PlaybackSnapshot.State.ERROR && snapshot.getUtteranceIndex() == index
                && code.equals(snapshot.getErrorCode())) return;
        playbackControl.pause();
        stateMachine.fail(request.getSessionId(), index, code);
        publishSnapshot();
        Media3ReadAloudBridge.publishError(request.getSessionId(), index, code, message);
    }

    private boolean activateCompletedFileFallback(int index, byte[] audio) {
        try {
            File file = new File(getCacheDir(), "media3-fallback-" + request.getSessionId() + "-" + index + ".mp3");
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(audio);
            }
            MediaItem fallbackItem = new MediaItem.Builder()
                    .setMediaId(request.getUtterances().get(index).getId())
                    .setUri(Uri.fromFile(file))
                    .setMediaMetadata(player.getMediaItemAt(index).mediaMetadata)
                    .build();
            player.replaceMediaItem(index, fallbackItem);
            player.prepare();
            player.seekTo(index, 0L);
            player.play();
            return true;
        } catch (IOException fallbackError) {
            Log.e(TAG, "Failed to activate completed-file fallback index=" + index, fallbackError);
            return false;
        }
    }

    private void emitDueWordBoundary() {
        if (request == null || !player.isPlaying()) return;
        int index = player.getCurrentMediaItemIndex();
        List<WordBoundary> words = boundaries.get(index);
        WordBoundary boundary = wordBoundaryTracker.findDueBoundary(words, player.getCurrentPosition());
        if (boundary == null) return;
        Media3ReadAloudBridge.publishWordBoundary(
                request.getSessionId(),
                index,
                request.getUtterances().get(index),
                boundary
        );
    }

    private void publishProgress() {
        if (request == null) return;
        long now = System.currentTimeMillis();
        if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
        lastSnapshotAt = now;
        PlaybackSnapshot snapshot = stateMachine.snapshot();
        stateMachine.transition(
                request.getSessionId(),
                snapshot.getState(),
                Math.max(0, player.getCurrentMediaItemIndex()),
                player.getCurrentPosition(),
                bufferedDurationMs()
        );
        publishSnapshot();
    }

    private void publishSnapshot() {
        Media3ReadAloudBridge.publishSnapshot(stateMachine.snapshot().withMetrics(firstAudioLatencyMs, lastBufferingDurationMs));
    }

    private long bufferedDurationMs() {
        return Math.max(0L, player.getBufferedPosition() - player.getCurrentPosition());
    }

    private long estimateDurationMs(ReadAloudUtterance utterance) {
        int characters = Math.max(1, utterance.getText().length());
        String rate = request.getRate().replace("%", "");
        double speed = Math.max(0.1, 1.0 + Double.parseDouble(rate) / 100.0);
        return Math.max(700L, Math.round((characters / 12.0) * 1_000L / speed));
    }

    private boolean isActive(ReadAloudSessionRequest candidate) {
        return request == candidate;
    }

    private boolean isActiveSource(ReadAloudSessionRequest candidate, int index, AppendableAudioSource source) {
        return isActive(candidate) && sources.get(index) == source;
    }

    private void pausePlayback() {
        if (request == null) return;
        player.pause();
        publishPlayerState(Player.STATE_READY);
    }

    private void resumePlayback() {
        if (request == null) return;
        int index = playbackControl.currentIndex();
        recoverFailedSynthesis(index);
        scheduleBuffer(index);
        player.play();
        publishPlayerState(player.getPlaybackState());
    }

    private void seekTo(int index) {
        if (request == null || index < 0 || index >= request.getUtterances().size()) return;
        wordBoundaryTracker.reset();
        stateMachine.transition(request.getSessionId(), PlaybackSnapshot.State.SEEKING, index, 0L, 0L);
        publishSnapshot();
        playbackControl.seek(index, 0L);
        recoverFailedSynthesis(index);
        prioritizeSynthesis(index);
        playbackControl.play();
        scheduleBuffer(index);
    }

    private void recoverFailedSynthesis(int index) {
        AppendableAudioSource source = sources.get(index);
        if (source == null || source.getFailure() == null) return;
        resetSynthesisSource(index);
        scheduledIndices.remove(index);
        inFlightIndices.remove(index);
        retryCounts.remove(index);
    }

    private void stopSession() {
        mainHandler.removeCallbacks(progressTicker);
        cancelSynthesis();
        if (player != null) {
            player.stop();
            player.clearMediaItems();
        }
        request = null;
        stopSelf();
    }

    private void cancelSynthesis() {
        inFlightIndices.clear();
        for (WebSocket socket : sockets.values()) socket.cancel();
        sockets.clear();
    }
}
