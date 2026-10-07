# Media3 Edge prefetch regression — 2026-10-07

## Confirmed cause

The previous stale-session/seek fix changed synthesis completion to schedule from the player's current index. This preserved current-first priority, but `AdaptiveBufferPolicy` counted that whole utterance toward its 11-second target. For a long current utterance, the plan contained only the current index. Completion replanned the same already-scheduled index, so the next synthesis did not start until playback transitioned and had to buffer again.

The real service scheduler was reproduced in JVM tests with a holding executor instead of network sockets. Startup scheduled `[0]` rather than `[0, 1]`; completing current audio still left the next utterance unscheduled. Both tests failed before the fix.

## Fix

- Always prioritize the current utterance and include at least one upcoming utterance when one exists.
- Apply the duration target to upcoming audio only, independently of current playback length.
- Bound lookahead to 16 utterances. Keep the existing two concurrent synthesis jobs and session guards.
- Estimate durations only within that bounded window, rather than scanning the whole remaining chapter on the playback thread.

## Evidence

Five new regression cases cover long-current startup, completion/refill, future-only duration budgeting, bounded planning with zero durations, and real service scheduling on a 10,000-utterance chapter.

The chapter test recorded 10,002 text accesses per scheduling call before the bounded scan; after the change the first call is limited to 19 accesses (17 estimates plus two synthesis inputs). Repeated scheduling creates no duplicate synthesis jobs. This is an operation-count measurement, not a physical-device latency benchmark.

- Android checkstyle and all debug/release JVM tests passed.
- Frontend: 433 passed, three existing expected failures, 69 files.
- TypeScript/lint: exit 0, zero errors, 105 existing warnings.
- Production web build passed.
- `npm run cap:build` synchronized the web assets and built the debug APK successfully.
- No temporary debug logging or network requests were introduced by the test harness.

## Device validation and prevention

ADB reports no attached device. Measure first-audio latency and inter-utterance silence using a newly built APK with long Vietnamese sentences, short sentences, a high reading rate, and Next during buffering. The confirmed scheduler regression is fixed; endpoint and decoder latency have not been measured on-device.

Keep service-level startup and synthesis-completion tests beside the pure buffer-policy tests. Testing only watermark arithmetic missed the interaction between callback scheduling and the currently playing utterance.
