package com.vula.stories;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertNull;

import com.vula.stories.tts.edge.EdgeAudioFrameExtractor;

import org.junit.Test;

import java.nio.charset.StandardCharsets;

import okio.ByteString;

/**
 * Unit Test kiểm tra bóc tách frame nhị phân âm thanh của EdgeAudioFrameExtractor.
 */
public class EdgeAudioFrameExtractorTest {

    @Test
    public void testExtractAudioBytes_frameHopLe() {
        String headerText = "X-RequestId:123\r\nPath:audio\r\n\r\n";
        byte[] headerBytes = headerText.getBytes(StandardCharsets.UTF_8);
        int headerLen = headerBytes.length;

        byte[] fakeAudio = new byte[]{0x4D, 0x50, 0x33, 0x01, 0x02}; // Mock MP3 payload

        byte[] rawFrame = new byte[2 + headerLen + fakeAudio.length];
        rawFrame[0] = (byte) ((headerLen >> 8) & 0xFF);
        rawFrame[1] = (byte) (headerLen & 0xFF);
        System.arraycopy(headerBytes, 0, rawFrame, 2, headerLen);
        System.arraycopy(fakeAudio, 0, rawFrame, 2 + headerLen, fakeAudio.length);

        ByteString payload = ByteString.of(rawFrame);
        byte[] extracted = EdgeAudioFrameExtractor.extractAudioBytes(payload);

        assertArrayEquals(fakeAudio, extracted);
    }

    @Test
    public void testExtractAudioBytes_khongChuaPathAudio_traVeNull() {
        String headerText = "Path:other.response\r\n\r\n";
        byte[] headerBytes = headerText.getBytes(StandardCharsets.UTF_8);
        int headerLen = headerBytes.length;

        byte[] rawFrame = new byte[2 + headerLen + 4];
        rawFrame[0] = (byte) ((headerLen >> 8) & 0xFF);
        rawFrame[1] = (byte) (headerLen & 0xFF);
        System.arraycopy(headerBytes, 0, rawFrame, 2, headerLen);

        ByteString payload = ByteString.of(rawFrame);
        assertNull(EdgeAudioFrameExtractor.extractAudioBytes(payload));
    }

    @Test
    public void testExtractAudioBytes_payloadNullHoacRong_traVeNull() {
        assertNull(EdgeAudioFrameExtractor.extractAudioBytes(null));
        assertNull(EdgeAudioFrameExtractor.extractAudioBytes(ByteString.EMPTY));
        assertNull(EdgeAudioFrameExtractor.extractAudioBytes(ByteString.of(new byte[]{0, 1})));
    }
}
