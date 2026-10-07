# Edge Android playback and read-aloud refactor

Implemented locally on 2026-10-07. No commit, push, or deployment.

## Behavior

- Map Edge word metadata forwards onto original reader text, preserving Unicode offsets and rejecting duplicate timestamps and partial Latin-word matches.
- Send native audio position and word cues to the WebView. Render the current word from that clock on animation frames, without replaying delayed word events. Reject stale sessions, utterances, and sequence numbers.
- Retain the last word and line during silence, buffering, and utterance transitions; replace the word directly when the next boundary arrives. Use a soft translucent word tint and inherit the reader text color. Resume coordinates still advance independently when a word ends. Preserve source coordinates when the next utterance starts before its first word, so stop/resume does not return to the beginning of the grouped paragraph.
- Preload three seconds of upcoming Media3 playlist samples. Adapt synthesis lookahead to recent request latency, within existing bounded limits.
- Cache completed audio and word cues atomically in one versioned disk entry, with a 32 MiB budget. Cache keys include original text, voice, rate, pitch, format, and alignment version. Discard incomplete/corrupt entries. Release retired cached audio buffers from RAM and restore them from disk when seeking back.
- Preserve manual scrolling and text-selection ownership; playback continues while the reader inspects another position.

## Hook ownership

`useReadAloud.ts` decreased from 1,460 to 589 lines. It coordinates state and commands; dedicated modules under `src/hooks/readAloud/` own browser speech, browser Edge audio, VieNeu playback/configuration, native events, highlighting, plans, resume coordinates, and wake locks.

The unused standalone implementation of `useNativeReadAloud` is now a compatibility export of the unified hook. Removed obsolete interaction state and duplicated navigation paths. Wake-lock acquisition is coalesced and a late acquisition is released after cancellation.

## Verification

- `rtk npm test -- --silent --reporter=dot`: 71 files; 465 passed and 3 existing expected failures.
- `rtk npm run lint`: TypeScript passed; zero lint errors, 103 warnings (previous baseline: 105).
- `rtk npm run test:android`: Checkstyle and JVM tests passed, 102 tests for each build type.
- `rtk npm run cap:build`: Vite build, Capacitor sync, and debug APK assembly passed. Latest APK installed on emulator-5554.
- Device instrumentation: five tests passed covering cached playback, automatic next, forward/backward seeking after RAM retirement, touch ownership, foreground lifecycle, and MP3 seeking. Cached playback was also rerun against the final APK.
- Focused regressions were observed failing before fixes: Unicode/token mapping, duplicate metadata, cache pairing, timeline ordering and stale utterances, adaptive buffering, RAM release, wake-lock cancellation, and resume between utterances.

Live Edge playback on the emulator continued during real swipe and long-press interactions. Across 766 native timeline snapshots, bridge delivery age had a p95 of 12 ms and a maximum of 49 ms. The viewport remained fixed while text selection was held.

On the final installed APK, live Edge playback, Next, pause, and resume were exercised through the reader UI. Pause/resume retained the same native session; the crash buffer was empty. The observed first-audio latency was 1,649 ms, and Next to an uncached destination produced one buffering event of 687 ms before pausing. These are individual observations, not benchmark percentiles.

## Practical limits

The bridge measurements do not measure audible word-to-highlight alignment. Browser parity and physical-device alignment require audio/frame capture on a real device. A cold network request or resuming from an uncached partial utterance can still require synthesis; cache and preload reduce waiting but cannot eliminate network latency.

## Highlight comfort follow-up

Removed word clearing from silent gaps, buffering, and native chunk-start events after feedback about flashing. Word tint is now translucent amber, line tint is lighter, and both inherit the reader text color. The DOM fallback no longer changes font weight, spacing, or glow. Playback/resume offsets still advance independently of the retained visual anchor.

Regression tests observed four failures before the change and passed afterward. Full web suite: 72 files, 467 passed and 3 expected failures. TypeScript/lint passed with the same 103 existing warnings. Debug APK rebuilt and installed on the emulator.

## Stop / Play cache follow-up

The old restart path sliced the initial utterance at the saved text offset. This changed its text and cache key on every restart, forcing fresh synthesis even when the full sentence was cached. A focused regression observed this exact change before the fix.

Media3 requests now keep canonical utterances and pass a separate `startCharIndex`. Native playback resolves that cursor against the original word timeline and seeks to its audio timestamp before playing. A cold partial restart waits for the requested word boundary, preserving pause/stop intent and source coordinates before the first word. An uncached sentence still requires synthesis.

Full web suite after this change: 72 files, 468 passed and 3 expected failures. Android JVM tests and Checkstyle passed; debug APK rebuilt. The live emulator also exposed an MP3 input-format error before this follow-up; that error is separate evidence and should not be treated as fixed solely by the cache-key regression.

The real Media3 cache instrumentation passed after adding immediate Stop → Start at character 4. With an invalid network voice, playback still resumed from the original cached MP3 at or after 800 ms, without playing its prefix. Android JVM suite now contains 106 passing tests per build type.

Live Edge UI verification on the final APK also passed: initial playback reported 948 ms first-audio latency; Stop → Play reported 747 ms, active word highlighting, and no rebuffer during the observed interval. No playback-source error appeared in that process log. These are single emulator samples, not a general latency guarantee; the earlier input-format failure has not been independently reproduced and isolated.
