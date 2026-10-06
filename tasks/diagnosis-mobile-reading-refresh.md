# Mobile reading & refresh — 2026-10-07

## Requested scope

Implement a slightly higher read-aloud scroll anchor and a smaller control enclosure without changing playback-button style. Diagnose pull-to-refresh and propose its refactor; do not implement that refactor yet.

## Reproduction and diagnosis

Command: `rtk npm test -- src/services/__tests__/readAloudScrollFollower.test.ts src/features/reader/components/__tests__/ReadAloudControlFrame.test.tsx src/hooks/__tests__/usePullToRefresh.diagnosis.test.ts`.

Initial result: 9 failed, 14 passed. Five anchor assertions demonstrated the old 50% target (80px below the requested 40% target in an 800px viewport); one enclosure-density assertion failed. Three refresh repros each unexpectedly invoked onRefresh once: touchcancel after arming, full retraction to the gesture origin, and a gesture beginning on an interactive button.

Ranked hypotheses were shown before fixing: (1) 50% anchor; (2) shared cancel/release handler; (3) stale armed distance on reversal; (4) missing control-gesture exclusion; (5) 44px grip row plus excess padding.

Confirmed code evidence:

- `readAloudScrollFollower.ts` multiplied viewport height by 0.5.
- `usePullToRefresh.ts` wires touchcancel to handleTouchEnd, which commits refresh.
- Distance updates only inside `deltaY > 0`; at origin/above it the old armed distance survives.
- Touchstart excludes modal and scrolled parents but not buttons, selection or drag controls.
- All three screen callers hide the refresh indicator (`showIndicator={false}`).
- Reader's refresh clears its resume state, stops TTS and calls clearAllCaches before loadChapter(true).
- clearAllCaches removes all CacheStorage entries, all stories_tts_pos_* keys and both native audio caches. This is a global reset, not scoped data refresh. IndexedDB downloaded chapters are not deleted by this utility.

## Implemented

Scroll destination changed to 40% viewport height. The 25–75% stable band, smooth easing, manual-scroll takeover, 250ms visible-line reacquisition and selection protection remain unchanged.

Control enclosure: padding 8→6px; frame gap 8→4px; grip 44×44→36×24px. Browser measurement at 375×812: 52×220px for the four-playback-button configuration, versus approximately 62×248px previously. Additional conditional buttons still increase height. Existing playback-button classes, sizes, colors, order and callbacks remain unchanged. The compact grip trades a 44px touch recommendation for a 24px-high target; validate finger usability on-device. No CSS scale is applied to the whole bar.

## Proposed refactor — recommended for this Capacitor Android app

### A. Deepen the existing refresh module (Strong)

Consolidate ownership, gesture recognition, disarming/cancel, refresh lifecycle and feedback behind the current module's interface. Keep request policy in each screen's fresh-fetch adapter. Fix once at the real event-to-refresh seam; do not merely extract damping arithmetic into another shallow module. This gives locality for gesture defects and leverage across Library, ChapterList and Reader.

Suggested state sequence: idle → tracking → pulling → armed → refreshing → settling → idle. Reversal moves armed back to pulling; cancel returns to settling without a request. Use one active touch identifier, direction lock, one in-flight request and a request generation guard on unmount/route changes. Disabled must always win over enabled.

Eligibility: actual scroll owner at top (small subpixel tolerance), exactly one finger, no modal, no selected text, no horizontal/back gesture, no drag handle or interactive/input target. For Reader, propose disabling pull during active playback to prevent accidental interruption; keep an explicit refresh action available. This playback policy requires approval.

Input adapter: touchstart/end/cancel passive; touchmove non-passive only where cancellation is required. Prevent browser scroll only after vertical ownership is established and cancelability checked. Never globally set touch-action:none; it would break reader scrolling and text selection. Visual adapter updates only spinner transform/opacity once per animation frame; do not move the whole story or fixed controls. Haptic once on crossing the armed threshold. Visible progress, release-to-refresh indication, loading and error feedback; preserve current data on error.

### B. Separate data refresh from reset (Strong)

Library refresh: keep filters and current visible data until a successful fresh first page replaces it. Chapter list: fresh fetch only for the current book/query. Reader: fresh chapter content without purging TTS/audio/resume state for other books. Existing repositories already support forceFresh/no-store; global reset is not required for cache bypass. Offline fallback must be surfaced as offline/stale, not a successful fresh fetch. Preserve downloaded chapters and reading progress. Leave deliberate cache reset in Settings as a separate explicit action.

No repository DTO changes, persistence migrations or dependencies required for the recommended path. Actual replacement/position restoration must be tested at screen-callsite seams, not just hook tests.

### C. Native SwipeRefreshLayout (Worth exploring later)

Android's native widget supports one direct child and a custom child-scroll-up callback. Here Library scrolls an inner DOM main, while Reader/ChapterList scroll the document. A native adapter around WebView still needs a synchronized JS eligibility/scroll-owner bridge, modal/selection/drag arbitration, route lifetime and request completion. Simply wrapping WebView does not solve these defects. Compare on a physical device after A/B; add native integration only if a measurable gesture/performance gap remains. No dependency added now.

[Official Android widget documentation](https://developer.android.com/reference/androidx/swiperefreshlayout/widget/SwipeRefreshLayout), [touchcancel semantics](https://developer.mozilla.org/en-US/docs/Web/API/Element/touchcancel_event).

## Delivery steps after approval

1. Implement ownership, cancel/retract and single-flight lifecycle; convert the three expected-failure contracts into normal passing tests.
2. Integrate screen-scoped fresh fetches; test resume/audio/cache preservation, failures and offline-stale results.
3. Enable mobile progress feedback and verify top/inner scroll, selection, control dragging, edge-back, horizontal chapter swipe, rotation, multi-touch, background/foreground, route change and slow/error network on Android.

## Evidence / limitations

Final CLI: 416 passed, 3 expected failures (known refresh defects), 67 test files. Typecheck/lint exit 0, 105 existing warnings; web build and whitespace check passed. The refresh implementation and screen handlers have not been changed. Expected failures are active documented repro contracts, not fixed or skipped tests. No temporary debug logs added. ADB has no connected device.

Browser QA used the marked debug fixture `tasks/diagnostics/mobile-controls-check.html`, not production app data. Measured transparent background, frame left=16px unchanged while top moved 492→372px from a 120px drag, and pause callback remained functional. Screenshot saved in the chat visualization directory as mobile-controls-compact.jpg. No Android native touch/WebView rendering validation yet.

Self-check: requested changes 1/3 implemented and tested; request 2 delivered as a proposal with independently confirmed code evidence and three live expected-failure tests. Main outstanding risk is small-grip finger usability and actual canceled-touch handling on Android. No commit, cache deletion, native dependency, or deployment performed.

Prevention: distinguish canceled input from committed intent; make gesture ownership explicit; never route routine refresh through global media-state reset.
