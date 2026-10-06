# Reading comfort, device highlighting and notification — 2026-10-06

## Reproduction

- The scroll feedback loop previously made three immediate scroll requests as visible lines moved through Y=500,540,570 in an 800px viewport. New regression requires zero requests until the line crosses 75% viewport height, then recenters it to 50%.
- NativeTTSCoordinator installs UtteranceProgressListener before NativeTTSPlugin initializes AndroidSpeechEngine. The old setter silently dropped the listener when TextToSpeech was null. A deterministic JVM test reproduces the actual install-before-init sequence, verifies it is attached before pending speech tasks, and repeats after engine replacement. The test failed with a null installed listener before the fix.
- Media notification metadata had no artwork. Legacy progress converted every chunk into 1000ms and falsely presented chunk counts as audio duration.

## Changes

- The shared scroll follower keeps a stationary 25–75% viewport reading band. Crossing its lower threshold scrolls to center with frame-time-based easing. Manual input and active text selection still take priority; visible-line reacquisition recenters once, then resumes the band policy.
- AndroidSpeechEngine retains its progress listener across asynchronous initialization and engine replacement. Real onRangeStart callbacks now reach the queue manager and the shared line/word highlighter. No guessed word timings were introduced.
- The native-specific hook also calls the same three-argument line/word highlighter.
- Added shared cached 512px artwork using the existing bundled book logo; set album art/display icon on legacy metadata and front-cover artwork data on Media3 metadata. A monochrome book notification icon replaces the launcher icon. Legacy notification shows chapter, book and sentence count, with no fabricated duration. Media3 retains its real player position/duration.

## Verification

Focused frontend hook/scroll tests: 45/45 passed. Android lifecycle regression passed after failing before the listener fix. Android unit tests and debug assembly passed with new artwork resources.

Final full suite: 403/403 frontend tests passed; typecheck/lint exited 0 (105 existing warnings, 0 errors); production web build, Android unit tests/debug build and diff whitespace check passed.

Temporary [DEBUG-native-highlight] instrumentation was removed. One test-fixture investigation found duplicate main-story-content IDs; the native integration fixture now replaces the shared document content and proves a device boundary invokes the exact same highlighter as Edge.

## Device limitations

No Android device is attached in ADB. Final smoothness, Samsung media-card styling and engine timing must be checked on-device. System UI controls media-card layout; artwork and metadata are provided by the app. Word-accurate highlighting depends on the selected Android TTS engine supplying onRangeStart timing events, as documented by Android.

References:
- https://developer.android.com/reference/android/speech/tts/UtteranceProgressListener
- https://developer.android.com/media/media3/session/background-playback

Prevention: install callbacks through a lifecycle-owning engine wrapper; test registration before initialization and after engine changes. Use viewport thresholds for reading comfort instead of a moving per-line center target, and keep artwork/metadata consistent across playback providers.
