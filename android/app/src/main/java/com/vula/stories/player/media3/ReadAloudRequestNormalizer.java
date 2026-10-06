package com.vula.stories.player.media3;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ReadAloudRequestNormalizer {
    private ReadAloudRequestNormalizer() {}

    public static List<ReadAloudUtterance> fromLegacyChunks(List<String> chunks) {
        if (chunks == null || chunks.isEmpty()) return Collections.emptyList();

        List<ReadAloudUtterance> utterances = new ArrayList<>();
        for (int index = 0; index < chunks.size(); index++) {
            String text = chunks.get(index);
            if (text == null || text.trim().isEmpty()) continue;
            utterances.add(new ReadAloudUtterance(
                    "legacy-" + index,
                    index,
                    0,
                    text.length(),
                    text,
                    index
            ));
        }
        return Collections.unmodifiableList(utterances);
    }
}
