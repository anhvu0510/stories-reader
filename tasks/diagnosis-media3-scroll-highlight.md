# Media3 scroll/highlight diagnosis — 2026-10-06

## Revised visual requirement

The user clarified with a screenshot that blue must cover exactly the rendered screen line containing the yellow spoken word, not the full synthesis utterance. Media3 now calls the same `highlight` method as the other engines, using the native source-mapped absolute word offset. The utterance plan remains an audio unit only. Following is requested when the rendered line changes, with manual-scroll ownership preserved. A hook regression rejects calls to the utterance-wide highlighter and verifies repeated words on one line do not re-request scrolling.

## Reproduction and root causes

The focused Vitest loop reproduced three independent failures before the fix:

- After page scrollY=600, Media3 returned viewport top=100 to a follower expecting document top=700. The follower subtracted scrollY a second time.
- Two paragraph elements with matching utterance start/length reused the old blue range, because paragraph identity was absent from the cache key.
- User scrolling suspended automatic following for only 1.2 seconds. Following could reclaim control after the timeout.

The hook also requested following on every word boundary, and measured the full utterance range on every word. The regression covers repeated native events, one scroll request per utterance, and one utterance layout read across word changes.

## Changes

- CSS highlight geometry uses document coordinates. Empty ranges never produce infinite geometry.
- The blue utterance range includes paragraph identity and persists across word changes; the yellow word range advances independently.
- Media3 follows only at utterance transitions. Duplicate word events are ignored.
- Manual interaction cancels following until an explicit start/resume/previous/next action.
- The existing non-CSS fallback remains rendered-line based, but follows only on utterance transitions.

## Android crash from supplied trace

The captured Samsung Android 17 trace reports ForegroundServiceDidNotStartInTimeException via Media3ReadAloudBridge.start. Direct START intents do not connect a MediaController, so onGetSession does not register the service's session. Registering with addSession in onCreate lets Media3 own notification/foreground transitions during buffering. START explicitly triggers a notification update, and an empty pending request stops the service.

Reference: https://github.com/androidx/media/blob/1.9.0/libraries/session/src/main/java/androidx/media3/session/MediaSessionService.java

## Verification

- Initial focused run: 3 failures matching the coordinate, paragraph-range, and manual-scroll symptoms.
- Focused hook/highlighter/follower suite: 39/39 passed.
- Full frontend suite: 396/396 passed, 65 files.
- Typecheck/lint: exit 0; 105 existing warnings, 0 errors.
- Production web build: passed.
- JDK 21 Android testDebugUnitTest and assembleDebug: passed.
- git diff --check: passed.
- No temporary debug logging was introduced.

## Remaining device verification

ADB currently reports no attached devices. Vitest verifies event/geometry behavior, not physical Android rendering or audio-clock fidelity. The service lifecycle has no Android runtime unit-test seam in the existing test setup; the crash fix is source-grounded and compiles, but foreground behavior must be exercised on a device with slow/unavailable TTS networking.

Device checklist: swipe while playing and keep the chosen position after several seconds; advance words within a wrapped utterance; cross two paragraphs of equal lengths; start Media3 with a slow network and confirm a foreground media notification appears without a crash.

Prevention: keep coordinate space and utterance identity explicit at the highlighter/follower boundary; add service lifecycle instrumentation coverage before treating unit tests as proof of Android background playback.
