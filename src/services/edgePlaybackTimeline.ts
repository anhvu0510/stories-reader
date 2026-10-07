import type { PlaybackSessionState, WordBoundaryEvent } from './edgeTtsNativeStream';

export interface TimelineWord {
	charIndex: number;
	charLength: number;
	text: string;
	startTimeMs: number;
	durationMs: number;
}

export interface EdgeTimelineSnapshot {
	sessionId: string;
	utteranceIndex: number;
	chunkIndex: number;
	paragraphIndex: number;
	sourceStart: number;
	sourceLength: number;
	state: PlaybackSessionState;
	positionMs: number;
	sentAtMs: number;
	sequence?: number;
	words: TimelineWord[];
}

/** A bounded audio-clock projection; late bridge callbacks are never replayed. */
export class EdgePlaybackTimeline {
	private snapshot: EdgeTimelineSnapshot | null = null;
	private renderedKey = '';
	private lastWord: TimelineWord | undefined;
	constructor(
		private readonly emit: (word: WordBoundaryEvent) => void,
		private readonly now = () => Date.now()
	) {}

	update(snapshot: EdgeTimelineSnapshot): void {
		if (this.isOlder(snapshot)) return;
		if (snapshot.sessionId !== this.snapshot?.sessionId || snapshot.utteranceIndex !== this.snapshot?.utteranceIndex) this.lastWord = undefined;
		this.snapshot = snapshot;
	}

	private isOlder(next: EdgeTimelineSnapshot): boolean {
		const previous = this.snapshot;
		if (!previous || previous.sessionId !== next.sessionId) return false;
		if (next.sequence !== undefined && previous.sequence !== undefined) return next.sequence <= previous.sequence;
		return next.sentAtMs < previous.sentAtMs;
	}

	reset(): void {
		this.snapshot = null;
		this.renderedKey = '';
		this.lastWord = undefined;
	}

	render(): void {
		const snapshot = this.snapshot;
		if (!snapshot || snapshot.state !== 'PLAYING') return;
		const age = this.now() - snapshot.sentAtMs;
		const position = snapshot.positionMs + Math.max(0, age);
		const word = age >= 0 && age <= 250 ? this.wordAt(snapshot.words, position) : undefined;
		const key = `${snapshot.sessionId}:${snapshot.utteranceIndex}:${word?.charIndex ?? -1}`;
		if (key === this.renderedKey) return;
		this.renderedKey = key;
		const clearOffset = this.lastWord ? this.lastWord.charIndex + (age >= 0 && age <= 250 ? this.lastWord.charLength : 0) : 0;
		this.lastWord = word;
		this.emit({
			sessionId: snapshot.sessionId,
			utteranceIndex: snapshot.utteranceIndex,
			chunkIndex: snapshot.chunkIndex,
			paragraphIndex: snapshot.paragraphIndex,
			sourceStart: snapshot.sourceStart,
			sourceLength: snapshot.sourceLength,
			charIndex: word?.charIndex ?? clearOffset,
			charLength: word?.charLength ?? 0,
			text: word?.text ?? ''
		});
	}

	private wordAt(words: TimelineWord[], position: number): TimelineWord | undefined {
		let low = 0;
		let high = words.length;
		while (low < high) {
			const middle = (low + high) >>> 1;
			if (words[middle].startTimeMs <= position) low = middle + 1;
			else high = middle;
		}
		const word = words[low - 1];
		if (!word) return undefined;
		const end = word.durationMs > 0 ? word.startTimeMs + word.durationMs : words[low]?.startTimeMs;
		return end !== undefined && position >= end ? undefined : word;
	}
}
