package com.vula.stories.player.media3;

import java.text.BreakIterator;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Maps normalized provider words back to the unchanged reader text, only forwards. */
final class SpeechTextMap {
    private final String foldedText;
    private final List<Integer> starts = new ArrayList<>();
    private final List<Integer> ends = new ArrayList<>();
    private int searchOffset;
    private long lastTime = -1L;

    SpeechTextMap(String original) {
        StringBuilder folded = new StringBuilder();
        BreakIterator characters = BreakIterator.getCharacterInstance(Locale.ROOT);
        characters.setText(original);
        int start = characters.first();
        for (int end = characters.next(); end != BreakIterator.DONE; end = characters.next()) {
            append(folded, original.substring(start, end), start, end);
            start = end;
        }
        foldedText = folded.toString();
    }

    private void append(StringBuilder target, String character, int start, int end) {
        String folded = fold(character);
        target.append(folded);
        for (int index = 0; index < folded.length(); index++) {
            starts.add(start);
            ends.add(end);
        }
    }

    WordBoundary find(String word, long startTime, long duration) {
        if (startTime <= lastTime) return null;
        String foldedWord = fold(word);
        int index = foldedText.indexOf(foldedWord, searchOffset);
        while (index >= 0 && !isWholeWord(index, foldedWord.length())) index = foldedText.indexOf(foldedWord, index + 1);
        if (index < 0 || foldedWord.isEmpty()) return null;
        int end = ends.get(index + foldedWord.length() - 1);
        int start = starts.get(index);
        searchOffset = index + foldedWord.length();
        lastTime = startTime;
        return new WordBoundary(start, end - start, word, startTime, duration);
    }

    private static String fold(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }

    private boolean isWholeWord(int start, int length) {
        boolean prefix = start == 0 || !isLatinToken(foldedText.codePointBefore(start));
        int end = start + length;
        boolean suffix = end == foldedText.length() || !isLatinToken(foldedText.codePointAt(end));
        return prefix && suffix;
    }

    private boolean isLatinToken(int codePoint) {
        return Character.isDigit(codePoint) || (Character.isLetter(codePoint) && Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.LATIN);
    }
}
