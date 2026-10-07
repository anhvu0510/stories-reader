# Android runtime read-aloud diagnosis — 2026-10-07

## Environment and scope

- ADB target: `emulator-5554`, `Medium_Phone_API_37.0`, Android 17 / API 37.
- Installed debug APK using `adb install -r`; launched `com.vula.stories/.MainActivity`.
- User configured the server and opened *Lục Triều Sử Ký*, chapter 1.
- Reading speed in UI: 1.8x. Device voice tested first, then Edge Hoài Mỹ with Media3.
- This is runtime evidence, not a completed fix or a phone latency benchmark.

## Observations

Device voice emitted word boundaries and sequential chunk starts `0 → 1 → 2`.
Pause emitted `isPlaying=false,isPaused=true,isBuffering=false`; the visible word
highlight remained at the paused word. Audio/highlight perceptual accuracy and
manual Next have not been established by this trace.

Edge session `edge-media3-5301391a-6411-44c8-9b1f-e503c56a4bdd`:

| Device time | Event |
| --- | --- |
| 10:32:18.576 | CONNECTING, utterance 0 |
| 10:32:18.604 | BUFFERING, utterance 0 |
| 10:32:27.504 | PLAYING; `firstAudioLatencyMs=9141` |
| 10:32:30.729 | Transition to utterance 1 |
| 10:32:34.135 | Transition to utterance 2 |
| 10:32:34.136 | BUFFERING; `rebufferCount=1` |
| 10:32:36.745 | ERROR, utterance 2, `SYNTHESIS_FAILED` |
| 10:32:39.876 | ERROR, utterance 2, `DECODER_FAILED`, then IDLE |
| 10:32:44.668 | ERROR, prefetched utterance 3, `SYNTHESIS_FAILED` |

The player transitions were sequential at the utterance level. The same paragraph
chunk index can occur on multiple utterances; this alone does not mean a sentence
was skipped. Source ranges identify these as different sentences.

The complete ExoPlayer stack was inspected. Its cause chain was:

```text
ExoPlaybackException: Source error
  IOException: Edge synthesis failed
    SocketException: Connection reset
```

The exception originated in OkHttp's WebSocket response/reader path. This proves a
network source failure for this event; it does not identify which peer or network
component reset the connection. `NativeReadAloudService.handlePlayerError` labels
the subsequent source error `DECODER_FAILED`, obscuring the original cause.

## Ranked investigations

1. Edge connection/reset behavior: repeat identical reading and correlate socket
   establishment, first bytes, completion, retries and terminal error.
2. Retry/prefetch recovery: determine whether a failed future utterance interrupts
   the current healthy utterance, and whether Resume can restart the failed source.
3. Error classification: preserve synthesis/source errors through ExoPlayer instead
   of reporting them as decoder failures.

## Second run and navigation regression

After user unlock, a clean second Edge session reported
`firstAudioLatencyMs=6362`. At 10:34:57.320 the player entered utterance 3.
At 10:34:57.595 pressing Next sent `seekToChunk({chunkIndex:5})`, skipping
utterance 4. The target remained SEEKING for more than 15 seconds in the captured
trace; this observation does not establish a permanent stall.

Root cause for skipping: `useReadAloud.nextSection` advanced the larger text chunk
and mapped its start to a Media3 utterance. One text chunk may contain multiple
utterances, so advancing a chunk skips the remaining utterances inside it.

Added two hook regression tests using long sentences that share a text chunk but
occupy distinct Media3 utterances. Both failed before the fix. Next/Previous now
advance the actual Media3 utterance cursor from playback snapshots, preserve the
source chunk mapping, and reject stale snapshots while seeking. Rapid Next and
Previous requests remain sequential.

Verification:

- Focused native navigation + streaming tests: 34 passed.
- Full frontend suite: 435 passed, 3 existing expected failures.
- Typecheck/lint: 0 errors, 105 existing warnings.
- Production assets and debug APK built successfully; APK installed using ADB.
- `git diff --check` passed.

## Remaining verification and limits

After installation, the app automatically downloaded an OTA bundle and loaded
`index-CbGahKPM.js`, different from the newly built bundled assets. Therefore that
running app cannot be used to claim live verification of the local navigation fix.
The regression tests establish its behavior; repeat the live scenario using the
bundled build with OTA isolated in the local debug environment.

Network startup delay/reset, source-error classification and retry recovery remain
unresolved by this navigation fix. No production configuration was changed and no
authentication was disabled or bypassed. No commits or deployment were performed.
