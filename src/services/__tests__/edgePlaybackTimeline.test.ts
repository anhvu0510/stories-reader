import { describe, expect, it, vi } from 'vitest';
import { EdgePlaybackTimeline, type EdgeTimelineSnapshot } from '../edgePlaybackTimeline';

const snapshot: EdgeTimelineSnapshot = {
	sessionId: 's',
	utteranceIndex: 0,
	chunkIndex: 0,
	paragraphIndex: 0,
	sourceStart: 0,
	sourceLength: 12,
	state: 'PLAYING',
	positionMs: 100,
	sentAtMs: 1000,
	words: [
		{ charIndex: 0, charLength: 3, text: 'Một', startTimeMs: 100, durationMs: 100 },
		{ charIndex: 4, charLength: 3, text: 'hai', startTimeMs: 200, durationMs: 100 }
	]
};

describe('EdgePlaybackTimeline', () => {
	it('accepts a newer sequence when the device wall clock moves backwards', () => {
		const emit = vi.fn();
		const timeline = new EdgePlaybackTimeline(emit, () => 900);
		timeline.update({ ...snapshot, sequence: 1 });
		timeline.update({ ...snapshot, sequence: 2, sentAtMs: 900 });
		timeline.render();
		expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Một' }));
	});
	it('renders the current audio word once after a delayed frame instead of replaying a queue', () => {
		let now = 1000;
		const emit = vi.fn();
		const timeline = new EdgePlaybackTimeline(emit, () => now);
		timeline.update(snapshot);
		now = 1120;
		timeline.render();
		expect(emit).toHaveBeenCalledTimes(1);
		expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ charIndex: 4, text: 'hai' }));
	});
	it('clears a completed word in silence and refuses to extrapolate a stale audio clock', () => {
		let now = 1000;
		const emit = vi.fn();
		const timeline = new EdgePlaybackTimeline(emit, () => now);
		timeline.update(snapshot);
		timeline.render();
		now = 1240;
		timeline.render();
		expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ charLength: 0 }));
	});
	it('does not move highlights while paused or consume an older snapshot after seek', () => {
		const emit = vi.fn();
		const timeline = new EdgePlaybackTimeline(emit, () => 1000);
		timeline.update({ ...snapshot, state: 'PAUSED' });
		timeline.render();
		expect(emit).not.toHaveBeenCalled();
		timeline.update({ ...snapshot, utteranceIndex: 1, sentAtMs: 1000 });
		timeline.update({ ...snapshot, sentAtMs: 900 });
		timeline.render();
		expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ utteranceIndex: 1 }));
	});
});
