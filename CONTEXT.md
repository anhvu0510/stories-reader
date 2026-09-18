# Stories Reader context

## Role

Stories Reader is a static browser application for browsing, reading, offline
download, translation controls, and text-to-speech playback. The selected API
domain is browser configuration, not a build-time constant.

## Main flows

- Library → chapter list → reader routes live in `src/App.tsx`.
- `ReaderScreen` requests one or more chapters through `ChapterRepository`.
- `useReadAloud` converts rendered paragraph text into speech chunks and owns
  pause/resume/stop, highlighting, scrolling, and media-session behavior.
- Edge requests return an audio blob plus word boundaries; VieNeu may stream
  PCM; the browser engine uses native speech synthesis.
- `offlineDb` stores downloaded content and user progress separately from
  server content.

## Invariants

- A tab becoming hidden must not reset, recreate, or replay an active audio
  element. On return to foreground, resume only if the browser paused it.
- Reading progress keys must stay isolated by book and chapter.
- Reader content is rendered from chapter state; lifecycle changes must not
  trigger an unnecessary chapter refetch.
- API failures may fall back to offline content when it exists.
