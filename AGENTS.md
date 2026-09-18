# Stories Reader

Read `../AGENTS.md`, then `CONTEXT.md` before changing reader behavior. Load
`../docs/ARCHITECTURE.md` only when the task crosses the API, TTS, or deployment
boundary.

- Reader composition: `src/features/reader/ReaderScreen.tsx`.
- Playback lifecycle: `src/hooks/useReadAloud.ts`.
- Progress persistence: `src/hooks/useReadingProgress.ts`.
- API/configuration: `src/repositories/`, `src/services/apiClient.ts`,
  `src/stores/`.
- Preserve active playback when another tab loads or reloads; background
  lifecycle events must not replay already-playing audio.

Use `../docs/ENGINEERING.md` for any code change. Keep UI state, network calls,
and browser-media side effects behind the existing hooks/repositories; avoid
untyped data and duplicate state. For behavior changes, add a Vitest regression
test, then run `npm test`, `npm run lint`, and `npm run build`.
