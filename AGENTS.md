# Stories Reader

Stories Reader is the npm-managed React browser client for online/offline
reading, translation controls, progress persistence, and text-to-speech.

Read `../AGENTS.md` and `CONTEXT.md` before editing this repository.

## Commands

Run from `stories-reader/`:

```bash
npm ci
npm test -- src/hooks/__tests__/useReadingProgress.test.ts  # focused example
npm test                                                    # Vitest 4
npm run lint                                                # TypeScript noEmit
npm run build                                               # Vite production build
npm run dev                                                 # local server on :3000
```

Run the narrowest relevant test first, then test, typecheck, and build for a
code change. Do not start the dev server unless interactive verification is
needed.

## Stack and layout

- React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Zustand 5, IndexedDB via
  `idb`, and Vitest 4. `package-lock.json` is authoritative.
- `src/features/`: screen-level composition and feature components.
- `src/hooks/`: reusable browser, media, and lifecycle ownership.
- `src/repositories/` and `src/services/`: API/offline boundaries and external
  effects.
- `src/stores/`: established Zustand state and persisted preferences.
- `src/**/__tests__/`: colocated behavior and regression tests.

## Working pattern

1. For code modifications or bug fixes: Use CodeGraph to trace the component, hook, repository, and tests involved. For Q&A, answer directly.
2. Reproduce the behavior and add a focused Vitest test first when a practical
   seam exists.
3. Keep screens compositional; put reusable lifecycle behavior in hooks, server
   access in repositories/services, and persisted UI state in stores.
4. Run the focused test, full suite, typecheck, and production build.

Use explicit types at component, hook, repository, and API boundaries. Do not
add `any`, unchecked assertions, or untyped events/refs. Model nullable,
loading, offline, and error states explicitly.

## Boundaries

### Always

- Parse and normalize external data at repository boundaries, not in rendering
  components.
- Use functional state updates when based on previous state. Reserve effects
  for external synchronization and clean up every timer, listener, object URL,
  request, audio object, and media handler they create.
- Use semantic controls, visible labels, keyboard support, focus-safe sheets,
  and accessible loading/error feedback.
- Preserve active playback across unrelated tab lifecycle events. A background
  tab must not pause, resume, cancel, seek, or replay media owned by another tab.

### Requires explicit task scope

- Public API DTOs, offline database/store keys, route structure, API-domain
  configuration, dependencies, Vite/Vitest configuration, CI, or deployment.

### Never

- Call NATS, databases, or Docker services from the browser; use public HTTP.
- Put API access directly in presentation components or duplicate derived state.
- Embed credentials or production-only host values in client code.
- Change generated output or `node_modules/`.

## Examples to copy

- `src/hooks/useReadingProgress.ts` and
  `src/hooks/__tests__/useReadingProgress.test.ts`: browser lifecycle ownership,
  cleanup, and deterministic hook coverage.
- `src/repositories/__tests__/BookRepository.test.ts`: API/offline boundary
  mocking and observable state assertions.
- `src/features/reader/ReaderScreen.tsx`: screen composition; extract reusable
  behavior instead of growing the screen.

For API, TTS, or cross-repository changes use `../docs/ARCHITECTURE.md`. For an
explicitly requested release use `../docs/OPERATIONS.md`; local changes do not
authorize commit, push, deployment, or production access.
