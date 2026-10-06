# Selection read-aloud diagnosis — 2026-10-06

## Reproduced defects

- Native `jumpToContent` issued `seekToChunk` without starting a chapter. Media3's `seekTo` returns when no request exists, leaving the UI loading instead of taking the same startup path as the main speaker.
- In active reading mode, selectionchange, contextmenu and touch cancellation automatically sought and cleared the selection. Ordinary selection was impossible; gesture events could race with playback commands.
- Media3 startup ignored the selected character offset within an utterance.

## Fix

`jumpToContent` resolves the source position and calls `startReading`, the same pipeline as the main speaker. Explicit target requests bypass paused-session resume. Media3 selects the matching utterance and trims only its initial text, preserving paragraph/source offsets for word highlighting. Existing browser Edge cached-audio tests still pass.

SelectionSpeakerTooltip displays the same explicit speaker action in both idle and reading mode. Selecting text never requests speech, blocks the native context menu, or clears native selection. Only activating the speaker requests speech and dismisses selection. Removed debounce/auto-jump/suppression timers; replaced the interactive div with a keyboard-accessible button.

The scroll follower yields while a text selection is open, then applies the existing visible-line reacquisition rule after selection is dismissed.

## Evidence and limitations

The pre-fix tests reproduced missing native startup, blocked context menu, automatic selection clearing/seeking, ignored source offset and missing selection-scroll protection. Secondary failures in later hook tests during RED were leaked hook listeners after failed assertions; the GREEN run confirms cleanup with all assertions passing.

Focused loop: `rtk npm test -- src/features/reader/components/__tests__/SelectionSpeakerTooltip.test.tsx src/hooks/__tests__/useReadAloudStreaming.test.ts src/services/__tests__/readAloudScrollFollower.test.ts` — 44/44 passed.

Full verification: 403/403 frontend tests passed; typecheck/lint exited 0 with 105 existing warnings and no errors; production build and diff whitespace check passed.

These tests measure command routing, immediate dispatch, offsets and selection ownership. They do not measure Microsoft's network/audio first-byte latency on an Android device. No temporary debug instrumentation was added; no dependencies or Android implementation files changed.

Prevention: keep one playback entry point; native seeking requires a initialized session; selection observation should never itself issue a playback command.
