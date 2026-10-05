# Native Edge-style Read Aloud Tasks

## Task 1: Freeze contracts and capture a baseline

**Description:** Define session-scoped utterance, snapshot, state, and error contracts while preserving the current command payload. Add deterministic latency/gap measurement seams and failing tests.

**Acceptance criteria:**
- [ ] Legacy chunks and the new utterance payload normalize into one internal plan.
- [ ] Stale-session events cannot update the active UI/session.
- [ ] Cold/warm first-audio latency and inter-utterance gaps are measurable.

**Verification:**
- [ ] Focused Vitest and JVM contract/state tests pass.
- [ ] Existing native bridge tests remain green.

**Dependencies:** None

**Estimated scope:** Medium, 3-5 files, 0.5-1 day

## Task 2: Build source-mapped utterances and dual highlights

**Description:** Split rendered paragraph text into bounded natural utterances, preserve source offsets, and render a persistent utterance range plus the active word range.

**Acceptance criteria:**
- [ ] Vietnamese punctuation and long clauses produce utterances no longer than 220 characters.
- [ ] Every utterance and word offset maps back to the original paragraph text.
- [ ] Word changes do not recreate or flash the utterance highlight.

**Verification:**
- [ ] Segmentation and DOM highlighter Vitest suites pass.
- [ ] Manual reader check confirms blue utterance and yellow word behavior.

**Dependencies:** Task 1

**Estimated scope:** Medium, 3-5 files, 1 day

## Task 3: Move playback ownership into a Media3 service

**Description:** Add the approved Media3 artifacts and create the foreground session owner using completed-file playback first. Convert the Capacitor plugin into a command/event bridge.

**Acceptance criteria:**
- [ ] Playback survives Activity/WebView recreation and screen-off.
- [ ] MediaSession controls, audio focus, wake lock, pause/resume/seek/stop, and snapshot replay work.
- [ ] Existing Capacitor commands remain compatible.

**Verification:**
- [ ] JVM service/state tests and Android integration tests pass.
- [ ] Physical-device notification and Bluetooth control check passes.

**Dependencies:** Tasks 1-2

**Estimated scope:** Medium slices across Android service/player files, 1-1.5 days

## Checkpoint A: Native ownership

- [ ] Full frontend tests, lint, build, and Android unit tests pass.
- [ ] User-visible playback behavior remains functional before progressive streaming is enabled.

## Task 4: Stream Edge audio into an adaptive Media3 playlist

**Description:** Feed WebSocket audio bytes into an appendable Media3 data source, start on first decodable bytes, and maintain a current-first duration-based buffer.

**Acceptance criteria:**
- [ ] Current utterance begins before `turn.end` on supported devices.
- [ ] Buffer maintains 4-second low and 10-12-second target watermarks without unbounded memory use.
- [ ] Retry, rebuffer, skip, and fatal error states are explicit and session-safe.

**Verification:**
- [ ] Scheduler/data-source tests pass with slow, failed, cancelled, and out-of-order streams.
- [ ] Completed-file fallback activates deterministically after progressive decoder incompatibility.

**Dependencies:** Task 3

**Estimated scope:** Medium slices across synthesizer/data-source/scheduler/player files, 1.5-2 days

## Task 5: Integrate, migrate, and verify the complete experience

**Description:** Wire replayable snapshots to React, migrate resume positions, retire duplicate active-path ownership, and collect device performance evidence.

**Acceptance criteria:**
- [ ] All success metrics in the spec pass or have documented evidence explaining a rejected threshold.
- [ ] No silent buffering longer than 2 seconds occurs.
- [ ] Legacy fallback remains available until device QA is signed off.

**Verification:**
- [ ] Full repository quality gates pass.
- [ ] Device matrix covers cold/warm start, long chapter, screen-off, Activity recreation, interruption, seek spam, and degraded network.

**Dependencies:** Task 4

**Estimated scope:** Medium, 3-5 files plus QA evidence, 1-1.5 days

## Checkpoint B: Ready for review

- [ ] Full tests, lint, build, and Android tests pass.
- [ ] Performance measurements are attached to the handoff.
- [ ] Actual diff contains no unrelated changes.
- [ ] No commit, push, deployment, or fallback removal occurred without explicit authorization.
