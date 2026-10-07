# Edge Media3 playback optimization — 2026-10-07

## Problems reproduced

- Live startup previously took 6,362–9,141 ms on the API 37 emulator.
- Seeking could leave the target waiting behind synthesis jobs for other sentences.
- A failed lookahead job changed healthy current playback to ERROR.
- Partial audio was never retried; source errors were mislabeled DECODER_FAILED.
- Socket closure before `turn.end` had no failure callback, leaving a pending source.
- Every progressive read copied the entire accumulated MP3 into a new byte array.
- Prefetch duration estimates ignored the selected speech rate, and concurrency
  accounting scanned all chapter sources on every scheduling pass.

## Changes

- Explicit in-flight tracking keeps concurrency at two and avoids whole-chapter scans.
- An uncached seek invalidates obsolete synthesis generations and starts the target
  and its successor immediately. A cached seek preserves the existing playlist.
- Bounded retries replace partial sources, clear old boundaries, and retain the
  current utterance/time. Delayed retries and late callbacks cannot resurrect audio
  after a seek or session change.
- Lookahead failures remain attached to their own source; they do not interrupt
  the currently healthy sentence. Resume or explicit seeking can retry a failed source.
- Network/source errors retain SYNTHESIS_FAILED; failed/truncated audio is never
  passed to the completed-file decoder fallback.
- Premature socket close emits one failure, and events after failure are rejected.
- Prefetch estimates include the rate multiplier. Progressive reads copy only the
  requested bytes from the backing buffer, avoiding a full MP3 allocation per read.

## Verification

- Two service regressions and two WebSocket regressions reproduced their failures
  before the fixes. Added coverage for seek priority, retry cancellation, retained
  position, speech-rate budgeting, failed-source recovery and cached seeking.
- Android debug/release: 88 tests per variant, zero failures; Checkstyle passed.
- Frontend: 435 passed, 3 pre-existing expected failures; typecheck/lint passed
  with 105 existing warnings and zero errors.
- Production assets and debug APK built; `git diff --check` passed.
- ADB installed the APK. CDP temporarily blocked only both OTA manifest routes and
  reset Capgo to builtin assets. Loaded JS matched the built `index-vAR62Oxr.js`.
  Authentication was completed through the normal keypad using the user-provided
  passcode format. No auth logic, server configuration or dependencies changed.

## Live measurements and limits

Verified session `edge-media3-50648259-6a69-4a93-a9b1-3c62d5b74720`:

- First PLAYING: 2,867 ms. This is one live observation; network conditions differ
  from the earlier runs, so it is not a controlled claim of a fixed percentage gain.
- Initial utterances 0–10 played without rebuffers. Manual Next correctly moved
  10 → 11. This run preceded the final cached-seek fast path.
- Long playback reached utterance 32, then exhausted retries on Connection reset.
  The terminal error was SYNTHESIS_FAILED, not DECODER_FAILED, at the correct
  utterance. External Edge/network failures can still occur; the app does not skip
  the failing sentence to hide them.

Final installed APK session `edge-media3-83ba8951-627b-4a66-9785-5e16a128721f`:

- Startup: `firstAudioLatencyMs=1350`.
- Cached Next: native command at 11:03:37.979; utterance 1 PLAYING at
  11:03:38.070, a 91 ms command-to-playing interval (`lastBufferingDurationMs=49`).
- Snapshots before/after confirmed 0 → 1, preserving the same session.
- Playback continued through utterances 2, 3 and 4 with `rebufferCount=0`.
- These are emulator samples, not a network-independent latency guarantee.

Temporary OTA blocking was removed, the CDP connection and ADB port forward were
closed, and the throwaway debug script was deleted. No commits, pushes or
deployment performed.
