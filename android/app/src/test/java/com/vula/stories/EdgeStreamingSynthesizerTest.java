package com.vula.stories;

import com.vula.stories.player.media3.EdgeStreamingSynthesizer;
import com.vula.stories.player.media3.ReadAloudUtterance;
import com.vula.stories.player.media3.WordBoundary;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class EdgeStreamingSynthesizerTest {
    private static final class Socket implements WebSocket {
        @Override public Request request() { return new Request.Builder().url("https://example.org").build(); }
        @Override public long queueSize() { return 0L; }
        @Override public boolean send(String text) { return true; }
        @Override public boolean send(ByteString bytes) { return true; }
        @Override public boolean close(int code, String reason) { return true; }
        @Override public void cancel() {}
    }
    private static final class Events implements EdgeStreamingSynthesizer.Listener {
        int failures;
        int completions;
        int audioFrames;
        @Override public void onAudio(byte[] bytes) { audioFrames++; }
        @Override public void onWordBoundary(WordBoundary word) {}
        @Override public void onComplete() { completions++; }
        @Override public void onFailure(IOException error) { failures++; }
    }
    private static WebSocketListener listener(Events events) {
        WebSocketListener[] captured = new WebSocketListener[1];
        EdgeStreamingSynthesizer synth = new EdgeStreamingSynthesizer((request, callback) -> {
            captured[0] = callback;
            return new Socket();
        });
        synth.synthesize(new ReadAloudUtterance("u0", 0, 0, 8, "Câu đầu.", 0),
                "voice", "+0%", "+0Hz", events);
        return captured[0];
    }
    private static ByteString audio() {
        byte[] headers = "Path:audio\r\n".getBytes(StandardCharsets.UTF_8);
        byte[] frame = new byte[headers.length + 3];
        frame[0] = (byte) (headers.length >> 8);
        frame[1] = (byte) headers.length;
        System.arraycopy(headers, 0, frame, 2, headers.length);
        frame[frame.length - 1] = 1;
        return ByteString.of(frame);
    }
    @Test public void prematureCloseTriggersOneFailureInsteadOfWaitingForever() {
        Events events = new Events();
        WebSocketListener listener = listener(events);
        listener.onClosing(new Socket(), 1000, "closed");
        listener.onClosed(new Socket(), 1000, "closed");
        assertEquals(1, events.failures);
        assertEquals(0, events.completions);
    }
    @Test public void lateAudioAndTurnEndAfterFailureCannotCompleteATruncatedSource() {
        Events events = new Events();
        WebSocketListener listener = listener(events);
        listener.onFailure(new Socket(), new IOException("Connection reset"), null);
        listener.onMessage(new Socket(), audio());
        listener.onMessage(new Socket(), "Path:turn.end\r\n\r\n");
        assertEquals(1, events.failures);
        assertEquals(0, events.audioFrames);
        assertEquals(0, events.completions);
    }
}
