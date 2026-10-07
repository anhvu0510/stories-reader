# Android gesture ownership — diagnosis and implementation

## Scope

Android only: native recognition of pull-to-refresh, read-aloud control dragging,
horizontal chapter/library swipe, and bottom-sheet dismissal. Existing web
recognizers and visual styles remain unchanged. Ordinary scroll, clicks and text
selection still run in Chromium/WebView; this is not a rewrite of the UI as native views.

## Reproduction and root causes

- `ReadAloudScrollFollower` reclaimed visible narration after 250ms. The new
  Android manual-ownership regression failed with two unwanted scroll calls.
- Control pointer handlers stop propagation; global bubbling listeners could miss
  a drag. Android now observes physical DOWN before WebView dispatch.
- Independent JS recognizers shared the same touch stream. Native session now
  locks one owner: control, sheet, horizontal swipe, refresh, or ordinary WebView.
- Handoff review found a new sheet lifecycle defect: real reader callers pass
  inline `onClose`; rerender cleared a pending dismissal timeout. The regression
  emitted native dismissal, rerendered the real sheet, then failed with zero close
  calls. Latest callback ref + stable registration makes it pass.

Ranked hypotheses were shared before probing: reclaim timer, missed control
interaction, and overlapping gesture recognizers. All three were addressed at
their owning seams rather than adding delays to the reader.

## Current behavior

- Android physical interaction cancels auto-scroll and leaves control with the
  user. There is no timed/visible-line reacquisition. Explicit locate/play/section
  navigation restores following. Locate does not restart or seek narration.
- Existing locate button style is also offered for active app narration on
  Android. Reader-title tap performs the same explicit locate. Web unchanged.
- Native control recognition uses published grip geometry, vertical-only motion,
  viewport clamping, and its own gesture owner. It does not initiate refresh,
  page scrolling or playback. Selection handles and normal input stay intact.
- Native refresh has a visible Android progress indicator. CANCEL never commits;
  reversal disarms; only one request is active. Reader refresh is disabled while
  TTS is active on the new native adapter, avoiding destructive playback reset.
- DOM hit-testing checks nested scroll owners, modal/sheet state, selection,
  interactive controls, and gesture ownership. Native uses Android touch slop,
  direction lock, release thresholds and long-press exclusion. OS edge navigation
  is preserved. Recognition may decline a very fast gesture if the async DOM
  eligibility reply is late; it never steals a stream already relinquished to web.
- Takeover sends one Chromium ACTION_CANCEL and consumes the rest of the stream.
  Multitouch and OS/activity cancellation do not trigger a final action.
- Sheets are tracked by owner; closing an inner sheet restores the outer owner.
  Timers, subscriptions and transient sheet transforms are cleaned up.

## Verification

Commands run with RTK:

- Focused follower RED → GREEN and native sheet-rerender RED → GREEN.
- Native gesture integration tests exercise real hook/component consumers,
  Android event dispatch, no duplicate DOM recognition, explicit locate, request
  cleanup, and browser isolation.
- `npm run test:android`: native Java policy tests and checkstyle succeed;
  gesture suite has 6 tests, zero failures (debug and release).
- Final full Vitest: 68 files, 428 passed, 3 legacy expected failures (431 total).
- Final lint/typecheck: zero errors; 105 pre-existing warnings, no new warning.

The three expected-failure tests from the preceding diagnosis still describe the
legacy JS refresh adapter. This task preserves it for browser/older APK fallback;
new native recognition is covered separately. Screen refresh data handlers still
perform the existing cache invalidation: scoped refresh-data refactor is separate.

No physical Android device was attached to ADB. JVM and JSDOM tests do not prove
OEM WebView bridge latency, actual touch handling or selection-handle behavior.
Install the freshly built APK; OTA web assets alone cannot install this plugin.
No dependencies added, no commits, pushes, installation or deployment performed.
An unrelated concurrent edit to BookRepository was left untouched.

## Follow-up checks on Android

1. Start narration; touch, drag or select text. Reading/highlighting continues,
   but page position stays under the user's control until explicit locate.
2. Drag control both directions while narration continues. Buttons still click;
   no refresh or page movement; safe-area bounds remain correct after rotation.
3. Pull from the top, retract, cancel via second finger, and release when armed.
   Only the last case refreshes once. Pulling inside a scrolled list stays scroll.
4. Swipe chapters from content; vertical motion/selection/buttons/OS edge back do
   not change chapters. Native swipe shows the existing preview/snapback visuals.
5. Drag a sheet from the top, cancel, flick to close, open a nested sheet, and
   rerender the reader during dismissal. No stranded sheet or accidental refresh.

## Architecture handoff

Strong: an Android instrumentation test across the actual native adapter seam:
`ReaderWebView.dispatchTouchEvent → plugin → bridge → React`, verifying exactly one
ACTION_CANCEL and normal scrolling/selection when ineligible. Current tests split
Java policy and React consumers; neither proves that entire chain on a device.

Worth exploring: scope control/swipe messages by owner/session token so delayed
delivery cannot affect a newly mounted consumer. Existing refresh and sheet
messages are already owner-scoped. This adds locality for lifecycle verification.

[Visual handoff report](/var/folders/lx/3n742w7d4pn7b04x4lmn9ps40000gp/T/architecture-review-20261007-native-gestures.html)

References:

- [Android touch dispatch/cancellation and ViewConfiguration](https://developer.android.com/develop/ui/views/touch-and-input/gestures/viewgroup)
- [Capacitor custom native code](https://capacitorjs.com/docs/android/custom-code)
