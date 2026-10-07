package com.vula.stories.player.media3;

/** Player operations used by synthesis scheduling and recovery. */
public interface ReadAloudPlaybackControl {
    int currentIndex();
    long positionMs();
    boolean playWhenReady();
    void replaceSource(int index, AppendableAudioSource source);
    void seek(int index, long positionMs);
    void prepare();
    void play();
    void pause();
}
