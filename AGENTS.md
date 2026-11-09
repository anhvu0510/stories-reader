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

1. **Language & Framework Best Practices First**: Before writing or refactoring any component, hook, or service, view the authoritative skill for React/TypeScript (`react-patterns`, `coding-standards`, `frontend-patterns`) and follow official React 19 & TypeScript 5.8 idioms.
2. For code modifications or bug fixes: Use CodeGraph to trace the component, hook, repository, and tests involved. For Q&A, answer directly.
3. Reproduce the behavior and add a focused Vitest test first when a practical
   seam exists.
4. Keep screens compositional; put reusable lifecycle behavior in hooks, server
   access in repositories/services, and persisted UI state in stores.
5. Strictly enforce flat guard clauses with early returns: zero nested `if` statements (max depth of 1 level). Eliminate redundant `else` blocks after returns or throws.
6. Run the focused test, full suite, typecheck, and production build.

## Code Style & Mandatory Lint Gate

**Before writing any code**, read `.agents/rules/eslint-enforcement.md` for BAD/GOOD patterns and `.agents/rules/clean-control-flow.md` for flat guard clause examples.

**After editing each file**, immediately run the inline lint gate:

```bash
cd stories-reader && node_modules/.bin/eslint "src/path/to/edited-file.tsx"
```

Fix all errors before moving to the next file. Do not let errors accumulate.

**Before declaring task complete**, run the full verification gate (BẮT BUỘC chạy lint sạch 100% trước khi bàn giao):

```bash
# 1. Typecheck & Full ESLint — must pass with 0 errors
rtk npm run lint

# 2. Format check — ensures pre-commit (lint-staged) passes smoothly
rtk npm run format

# 3. Full test suite
rtk npm test
```

**ESLint rules AI must comply with (zero tolerance):**

| Rule | Violation | Fix |
|---|---|---|
| `max-lines` (`350`) | File exceeds 350 code lines (God file) | Split into 3-tier cohesive modules (`Container` + `hooks/` + `components/` or `utils/`) |
| `max-lines-per-function` (`120`) | Function / Component exceeds 120 code lines | Extract cohesive custom hook, sub-component, or pure helper function |
| `sonarjs/no-identical-functions` | Duplicated function bodies across/within files | Consolidate into `src/shared/` or feature-level shared utility |
| `sonarjs/no-identical-expressions` | Identical expressions on both sides of operator | Fix copy-paste typo or simplify expression |
| `no-else-return` | `if (x) { return a; } else { return b; }` | Remove `else`, use early return |
| `unicorn/no-negated-condition` | `if (!x) { A } else { B }` | Flip: `if (x) { B } else { A }` |
| `no-nested-ternary` | `a ? b ? c : d : e` | Extract to `if/return` helper |
| `sonarjs/no-duplicated-branches` | Both if/else branches have identical code | Remove branching |
| `no-empty` | `catch {}` or `catch (e) {}` | Log with `console.warn('[fn] ...', err)` |
| `no-explicit-any` | `(data: any)` | Use specific type or `unknown` |
| `max-depth: 3` | 4+ levels of nesting | Extract helper function |

## Modular Architecture & Anti-God-File Standard

1. **Agent-Readable File Size (`<= 350` code lines, target `150–250` lines)**:
   - No production file in `src/` may exceed 350 lines of code (excluding blanks and comments).
   - No function or React component may exceed 120 lines of code.
2. **3-Tier Cohesive Decomposition**:
   - **Tier 1 — Container / Facade (`<= 250` lines)**: Top-level screen, sheet, or service entry file (`ReaderScreen.tsx`, `LibraryScreen.tsx`, `TranslationSheet.tsx`, `gaplessTtsPlayer.ts`). Preserves existing public exports so callers and tests never break.
   - **Tier 2 — Feature Hooks (`hooks/`)**: Stateful orchestration, browser/media listeners, and derived view-models (`80–220` lines).
   - **Tier 3 — Sub-Components & Pure Helpers (`components/`, `utils/`)**: Focused UI sections (`80–250` lines) and stateless domain/formatting helpers.
3. **Zero Shallow Junk Files & Zero Duplication**:
   - Do not create trivial 15-line pass-through files just to satisfy line limits. Group related pure helpers or closely coupled sub-elements into a single cohesive module.
   - Check `src/shared/` and `src/components/` before creating new helpers or UI primitives; consolidate any logic/UI repeated across `>= 2` features.

Use explicit types at component, hook, repository, and API boundaries. Do not
add `any`, unchecked assertions, or untyped events/refs. Model nullable,
loading, offline, and error states explicitly.

## Boundaries

### Always

- Consult stack skills (`react-patterns`, `coding-standards`, `frontend-a11y`) before introducing new patterns or abstractions.
- Keep branching flat: max 1 indentation level for conditional logic, return early on invalid states.
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
