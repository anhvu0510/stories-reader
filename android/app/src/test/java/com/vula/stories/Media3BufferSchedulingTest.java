package com.vula.stories;

import com.vula.stories.player.media3.AppendableAudioSource;
import com.vula.stories.player.media3.NativeReadAloudService;
import com.vula.stories.player.media3.ReadAloudSessionRequest;
import com.vula.stories.player.media3.ReadAloudUtterance;
import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.io.IOException;
import com.vula.stories.player.media3.ReadAloudPlaybackControl;
import com.vula.stories.player.media3.PlaybackStateMachine;
import com.vula.stories.player.media3.PlaybackSnapshot;
import java.util.ArrayList;
import java.util.AbstractList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertFalse;

/** Runs the real service scheduler while holding synthesis tasks instead of opening sockets. */
public class Media3BufferSchedulingTest {
    private static final class CountingUtterances extends AbstractList<ReadAloudUtterance> {
        private int reads;
        @Override public int size() { return 10000; }
        @Override public ReadAloudUtterance get(int index) {
            reads++;
            return new ReadAloudUtterance("u" + index, index, 0, 200, "Câu dài. ".repeat(25), index);
        }
    }
    private static final class HoldingExecutor extends AbstractExecutorService {
        private final List<Runnable> tasks = new ArrayList<>();
        @Override public void execute(Runnable task) { tasks.add(task); }
        @Override public void shutdown() {}
        @Override public List<Runnable> shutdownNow() { return Collections.emptyList(); }
        @Override public boolean isShutdown() { return false; }
        @Override public boolean isTerminated() { return false; }
        @Override public boolean awaitTermination(long timeout, TimeUnit unit) { return false; }
    }

    private static void set(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static void schedule(NativeReadAloudService service, int index) throws Exception {
        Method method = NativeReadAloudService.class.getDeclaredMethod("scheduleBuffer", int.class);
        method.setAccessible(true);
        method.invoke(service, index);
    }

    private NativeReadAloudService service(HoldingExecutor executor, Set<Integer> scheduled,
            ConcurrentHashMap<Integer, AppendableAudioSource> sources) throws Exception {
        NativeReadAloudService service = new NativeReadAloudService();
        String text = "Đây là câu dài cần nạp trước câu kế tiếp. ".repeat(5);
        List<ReadAloudUtterance> utterances = new ArrayList<>();
        for (int index = 0; index < 5; index++) {
            utterances.add(new ReadAloudUtterance("u" + index, index, 0, text.length(), text, index));
            sources.putIfAbsent(index, new AppendableAudioSource());
        }
        set(service, "request", new ReadAloudSessionRequest("buffer-test", utterances, 0,
                "voice", "+0%", "+0Hz", "Book", "Chapter"));
        set(service, "synthesisExecutor", executor);
        set(service, "sources", sources);
        set(service, "scheduledIndices", scheduled);
        return service;
    }

    @Test
    public void longCurrentSentenceStillStartsNextSynthesisBeforePlaybackTransitions() throws Exception {
        HoldingExecutor executor = new HoldingExecutor();
        Set<Integer> scheduled = new HashSet<>();
        NativeReadAloudService service = service(executor, scheduled, new ConcurrentHashMap<>());
        schedule(service, 0);
        assertEquals(new HashSet<>(Arrays.asList(0, 1)), scheduled);
        assertEquals(2, executor.tasks.size());
    }

    @Test
    public void completedCurrentAudioRefillsUpcomingWindowInsteadOfPlanningItselfAgain() throws Exception {
        HoldingExecutor executor = new HoldingExecutor();
        Set<Integer> scheduled = new HashSet<>(Arrays.asList(0));
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        AppendableAudioSource completed = new AppendableAudioSource();
        completed.complete();
        sources.put(0, completed);
        NativeReadAloudService service = service(executor, scheduled, sources);
        schedule(service, 0);
        assertTrue("Next audio must already be loading while sentence zero is playing", scheduled.contains(1));
        assertTrue("A free slot must schedule future audio", executor.tasks.size() > 0);
    }

    @Test
    public void longChapterSchedulingOnlyReadsTheBoundedUpcomingWindow() throws Exception {
        HoldingExecutor executor = new HoldingExecutor();
        NativeReadAloudService service = service(executor, new HashSet<>(), new ConcurrentHashMap<>());
        CountingUtterances utterances = new CountingUtterances();
        set(service, "request", new ReadAloudSessionRequest("long-chapter", utterances, 0,
                "voice", "+0%", "+0Hz", "Book", "Chapter"));
        schedule(service, 0);
        assertTrue("Scheduler read " + utterances.reads + " utterances on the playback thread", utterances.reads <= 19);
        schedule(service, 0);
        assertEquals("Repeated scheduling must not duplicate synthesis", 2, executor.tasks.size());
    }

    private static ReadAloudPlaybackControl player(int index, long position, List<String> calls) {
        int[] cursor = {index};
        long[] milliseconds = {position};
        return new ReadAloudPlaybackControl() {
            @Override public int currentIndex() { return cursor[0]; }
            @Override public long positionMs() { return milliseconds[0]; }
            @Override public boolean playWhenReady() { return true; }
            @Override public void replaceSource(int target, AppendableAudioSource source) { calls.add("replace:" + target); }
            @Override public void seek(int target, long targetPosition) {
                cursor[0] = target;
                milliseconds[0] = targetPosition;
                calls.add("seek:" + target + ":" + targetPosition);
            }
            @Override public void prepare() { calls.add("prepare"); }
            @Override public void play() { calls.add("play"); }
            @Override public void pause() { calls.add("pause"); }
        };
    }

    private static Object get(Object target, String name) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
    }

    private static void fail(NativeReadAloudService service, int index, int attempt,
            AppendableAudioSource source) throws Exception {
        Method method = NativeReadAloudService.class.getDeclaredMethod("handleSynthesisFailure",
                ReadAloudSessionRequest.class, int.class, int.class, AppendableAudioSource.class, IOException.class);
        method.setAccessible(true);
        method.invoke(service, get(service, "request"), index, attempt, source, new IOException("Connection reset"));
    }

    @Test
    public void failedLookaheadDoesNotInterruptHealthyCurrentPlayback() throws Exception {
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        NativeReadAloudService service = service(new HoldingExecutor(), new HashSet<>(Arrays.asList(0, 1)), sources);
        set(service, "playbackControl", player(0, 1200L, new ArrayList<>()));
        PlaybackStateMachine machine = (PlaybackStateMachine) get(service, "stateMachine");
        machine.start("buffer-test", 0);
        machine.transition("buffer-test", PlaybackSnapshot.State.PLAYING, 0, 1200L, 4000L);
        fail(service, 1, 2, sources.get(1));
        assertEquals(PlaybackSnapshot.State.PLAYING, machine.snapshot().getState());
        assertEquals(0, machine.snapshot().getUtteranceIndex());
    }

    @Test
    public void partiallyReceivedAudioIsRetriedInsteadOfBeingDeclaredTerminal() throws Exception {
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        NativeReadAloudService service = service(new HoldingExecutor(), new HashSet<>(Arrays.asList(0)), sources);
        List<String> calls = new ArrayList<>();
        set(service, "playbackControl", player(0, 1200L, calls));
        AppendableAudioSource partial = sources.get(0);
        partial.append(new byte[]{1, 2, 3});
        fail(service, 0, 0, partial);
        assertTrue("A retry must use a clean source, not append a second MP3 to partial audio", sources.get(0) != partial);
        assertEquals(0, sources.get(0).size());
        assertFalse("The replacement source must still wait for retry audio", sources.get(0).isCompleted());
        assertTrue("Recovery must preserve playback time inside the same sentence", calls.contains("seek:0:1200"));
    }

    @Test
    public void seekStartsItsTargetBeforeObsoletePrefetchJobsFinish() throws Exception {
        HoldingExecutor executor = new HoldingExecutor();
        Set<Integer> scheduled = new HashSet<>(Arrays.asList(0, 1));
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        NativeReadAloudService service = service(executor, scheduled, sources);
        set(service, "inFlightIndices", new HashSet<>(Arrays.asList(0, 1)));
        List<String> calls = new ArrayList<>();
        set(service, "playbackControl", player(0, 1200L, calls));
        Method seek = NativeReadAloudService.class.getDeclaredMethod("seekTo", int.class);
        seek.setAccessible(true);
        seek.invoke(service, 3);
        assertEquals(new HashSet<>(Arrays.asList(3, 4)), scheduled);
        assertEquals(2, executor.tasks.size());
        assertEquals(3, ((ReadAloudPlaybackControl) get(service, "playbackControl")).currentIndex());
        assertEquals(0L, ((ReadAloudPlaybackControl) get(service, "playbackControl")).positionMs());
    }

    @Test
    public void cancelledRetryCannotRestartAudioAfterASeek() throws Exception {
        HoldingExecutor executor = new HoldingExecutor();
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        NativeReadAloudService service = service(executor, new HashSet<>(Arrays.asList(0)), sources);
        set(service, "inFlightIndices", new HashSet<>(Arrays.asList(0)));
        set(service, "playbackControl", player(0, 1200L, new ArrayList<>()));
        List<Runnable> retries = new ArrayList<>();
        java.util.function.BiConsumer<Runnable, Long> scheduler = (task, delay) -> retries.add(task);
        set(service, "retryScheduler", scheduler);
        fail(service, 0, 0, sources.get(0));
        Method seek = NativeReadAloudService.class.getDeclaredMethod("seekTo", int.class);
        seek.setAccessible(true);
        seek.invoke(service, 3);
        int taskCount = executor.tasks.size();
        retries.get(0).run();
        assertEquals("Cancelled generation must not re-enter the synthesis queue", taskCount, executor.tasks.size());
    }

    @Test
    public void speedAffectsLookaheadDurationInsteadOfUnderbufferingFastSpeech() throws Exception {
        NativeReadAloudService service = service(new HoldingExecutor(), new HashSet<>(), new ConcurrentHashMap<>());
        ReadAloudSessionRequest original = (ReadAloudSessionRequest) get(service, "request");
        Method estimate = NativeReadAloudService.class.getDeclaredMethod("estimateDurationMs", ReadAloudUtterance.class);
        estimate.setAccessible(true);
        long normal = (Long) estimate.invoke(service, original.getUtterances().get(0));
        set(service, "request", new ReadAloudSessionRequest("speed", original.getUtterances(), 0,
                "voice", "+80%", "+0Hz", "Book", "Chapter"));
        long fast = (Long) estimate.invoke(service, original.getUtterances().get(0));
        assertTrue(fast < normal);
        assertEquals(normal / 1.8, fast, 1.0);
    }

    @Test
    public void seekingBackToFailedAudioRestartsSynthesisInsteadOfReusingAFailedSource() throws Exception {
        HoldingExecutor executor = new HoldingExecutor();
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        NativeReadAloudService service = service(executor, new HashSet<>(Arrays.asList(0)), sources);
        set(service, "playbackControl", player(0, 1200L, new ArrayList<>()));
        sources.get(0).fail(new IOException("Connection reset"));
        Method seek = NativeReadAloudService.class.getDeclaredMethod("seekTo", int.class);
        seek.setAccessible(true);
        seek.invoke(service, 0);
        assertFalse(sources.get(0).isCompleted());
        assertEquals(2, executor.tasks.size());
    }

    @Test
    public void cachedSeekKeepsUsefulPrefetchAndDoesNotRebuildThePlaylist() throws Exception {
        ConcurrentHashMap<Integer, AppendableAudioSource> sources = new ConcurrentHashMap<>();
        NativeReadAloudService service = service(new HoldingExecutor(), new HashSet<>(Arrays.asList(0, 3, 4)), sources);
        set(service, "inFlightIndices", new HashSet<>(Arrays.asList(0, 4)));
        sources.get(3).append(new byte[]{1, 2, 3});
        sources.get(3).complete();
        List<String> calls = new ArrayList<>();
        set(service, "playbackControl", player(0, 1200L, calls));
        Method seek = NativeReadAloudService.class.getDeclaredMethod("seekTo", int.class);
        seek.setAccessible(true);
        seek.invoke(service, 3);
        assertEquals(Arrays.asList("seek:3:0", "play"), calls);
    }
}
