package com.vula.stories;

import android.content.Context;
import android.content.ContextWrapper;
import com.vula.stories.player.GaplessStreamPlayer;
import com.vula.stories.player.gapless.PlayerSlot;
import org.junit.Test;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class GaplessCompletionTest {
    private static void set(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    @Test
    public void duplicateCompletionOfOldSlotCannotMarkNextSentenceAsRead() throws Exception {
        Context context = new ContextWrapper(null) {
            @Override public Context getApplicationContext() { return this; }
        };
        List<Integer> completed = new ArrayList<>();
        GaplessStreamPlayer player = new GaplessStreamPlayer(context, new GaplessStreamPlayer.PlayerListener() {
            @Override public void onChunkStart(int index) {}
            @Override public void onWordBoundary(int index, int start, int length, String text) {}
            @Override public void onPlaybackStateChange(boolean playing, boolean paused, boolean buffering) {}
            @Override public void onChunkCompleted(int index) { completed.add(index); }
            @Override public void onAllCompleted() {}
        });
        PlayerSlot current = new PlayerSlot();
        PlayerSlot next = new PlayerSlot();
        set(next, "isPrepared", true);
        set(next, "chunkIndex", 1);
        set(player, "currentSlot", current);
        set(player, "nextSlot", next);
        set(player, "currentChunkIndex", 0);
        set(player, "isPlaying", true);
        set(player, "currentSessionId", 1L);
        // Deliver the actual main-thread completion handler twice, as queued callbacks can arrive after handoff.
        Method completion = GaplessStreamPlayer.class.getDeclaredMethod("handleChunkCompletion", PlayerSlot.class, long.class);
        completion.setAccessible(true);
        completion.invoke(player, current, 1L);
        completion.invoke(player, current, 1L);
        Method failure = GaplessStreamPlayer.class.getDeclaredMethod("handleSlotError", PlayerSlot.class, int.class, int.class, long.class);
        failure.setAccessible(true);
        failure.invoke(player, current, 1, 0, 1L);
        assertEquals(Arrays.asList(0), completed);
        assertEquals(1, player.getCurrentChunkIndex());
        assertTrue(player.isPlaying());
    }
}
