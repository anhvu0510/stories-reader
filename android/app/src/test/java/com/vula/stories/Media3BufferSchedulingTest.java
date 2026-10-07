package com.vula.stories;

import com.vula.stories.player.media3.AppendableAudioSource;
import com.vula.stories.player.media3.NativeReadAloudService;
import com.vula.stories.player.media3.ReadAloudSessionRequest;
import com.vula.stories.player.media3.ReadAloudUtterance;
import org.junit.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
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
}
