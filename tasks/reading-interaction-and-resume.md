# Android reading interaction and resume diagnosis

Verified on 2026-10-07, Android API 37 emulator, package `com.vula.stories`.

## Confirmed causes and changes

- Selecting text automatically invoked speech after 180 ms, replacing the current session. Selection now only displays the explicit speak action. Holding the screen and selecting text do not seek or restart speech.
- Native gesture configuration could release touch ownership before the physical finger lifted. Configuration changes now abandon recognition while preserving physical touch ownership until UP/CANCEL.
- Android scroll momentum was not observed by the follower. Manual scrolling now suspends following; following can resume after 250 ms of quiet only when the current line is fully visible and the user is neither holding nor selecting. Browsing elsewhere remains stationary until the user invokes the locator. Pausing preserves the locator's line and disables automatic following.
- Changing reading activity could replace paragraph text nodes, invalidating CSS Highlight ranges. Paragraph rendering now preserves those nodes when the text and paragraph index are unchanged.
- Buffering/chunk transitions cleared the line along with the word. They now clear only the completed word and retain the last line until the next spoken boundary arrives.
- Device TTS resumed the entire chunk. It now resumes from the last reported word start, translating resumed engine offsets back to the original chunk. Completion advances the cursor before the next utterance starts.
- Resume persistence mixed chunk-relative and paragraph-relative offsets. Both providers now persist canonical paragraph offsets, including the final chunk; completed boundaries advance to the next chunk.
- Streaming MP3 sources with unknown length were not reliably seekable. Media3 now enables constant bitrate seeking for unknown-length MP3 and reports the completed source's remaining length.
- Media3 errors lost native transport ownership, allowing resume to start a different playback path. Errors now preserve native ownership and expose a paused state for retry.
- Duplicate Play and competing WebView media-session handlers could start competing sessions. Native playback owns Android transport controls; repeated Play during playback/buffering is ignored.
- A service could time out before its delayed audio notification, or an old Stop could destroy a newly queued Start. A connecting notification now promotes it immediately; Stop uses its start ID and stale player callbacks are ignored.
- Late native state callbacks could revive the UI after Stop. The hook now rejects state updates when it no longer owns an active native session.

## Debug runtime

Debug builds disable passcode/biometric gating without changing the saved release preference. They disable both the native OTA scheduler and the frontend updater, clear the stored bundle override and load the APK's bundled `public` assets. Release builds retain their existing behavior. Source edits require rebuilding/installing the debug APK; this is not a hot-reload server.

## Verification

- Frontend: 69 files, **453 passed**, 3 existing expected failures.
- Android JVM: **95 tests per build type**, debug and release; no failures/errors. Checkstyle passed.
- Android device instrumentation: **4 passed**: physical touch ownership, immediate foreground promotion, Stop/Start replacement survival, and unknown-length MP3 seeking.
- Lint: zero errors, 105 existing warnings. APK build and `git diff --check` passed.
- Live Edge reading: a continuous session survived long press/text selection; the viewport remained stationary while selection was active. An uncached seek reached SEEKING while preserving the previous line highlight and clearing the word highlight. A measured session reported first audio at 2601 ms; this is one observation, not a latency guarantee.
- Live device voice on the final APK: paused at chunk 3, character 152 (`xương`); resumed boundaries were 152, 159, 164, 167, 172, 177, 182. The interrupted word repeated, but the preceding sentence prefix did not. Word and line highlights were present.
- Final APK installed successfully after restarting a stalled emulator; live WebView asset `index-C-A2iAL6.js` matched the APK bundle, debug flag was true, and native OTA reported `enabled: false`.
- Follow-up platform scope: selection menu suppression and the speaker action now run only on Android. Web keeps its default selection menu with no speaker, whether reading is active or inactive. Both web regression cases failed before the platform guard and passed afterward; all 10 component tests and the full suite (455 passed, 3 expected failures) passed. Lint and APK build passed, and the updated APK was installed.
- Focused regressions were observed failing before their corresponding fixes, including automatic selection playback, replaced text ranges, canonical resume offsets, duplicate Play, post-Stop callbacks, gesture ownership, service lifecycle, and MP3 seeking.

## Platform constraints and primary sources

Android device TTS has no sample-accurate pause API. [`TextToSpeech.stop()`](https://developer.android.com/reference/android/speech/tts/TextToSpeech) interrupts the utterance, and [`onRangeStart`](https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener) reports the text range about to be spoken. Resuming at that word's start avoids replaying the sentence prefix, but may repeat the interrupted word itself. Providers that do not emit range callbacks cannot supply exact word progress.

Media3 documents the unknown-length CBR seeking option in [`Mp3Extractor`](https://developer.android.com/reference/androidx/media3/extractor/mp3/Mp3Extractor) and the foreground notification contract in [`MediaSessionService`](https://developer.android.com/reference/androidx/media3/session/MediaSessionService). Edge still depends on network synthesis; buffering preserves visual context rather than promising zero wait.
