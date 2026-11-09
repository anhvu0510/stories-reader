const PCM_INITIAL_BUFFER_SECONDS = 0.2;
const PCM_STEADY_BUFFER_SECONDS = 0.1;
const PCM_SCHEDULE_LEAD_SECONDS = 0.03;

export interface DecodedAudio {
	duration: number;
	value: unknown;
}

export interface ScheduledAudio {
	endAt: number;
	ended: Promise<void>;
	stop: () => void;
}

export interface PcmStreamPlayback extends ScheduledAudio {
	readonly startAt: number;
	readonly duration: number;
	append: (chunk: Uint8Array) => void;
	finish: () => void;
}

export interface PcmAudioStream {
	body: ReadableStream<Uint8Array>;
	sampleRate: number;
	channels: number;
}

export interface AudioPlaybackEngine {
	now: () => number;
	decode: (blob: Blob) => Promise<DecodedAudio>;
	schedule: (audio: DecodedAudio, startAt: number) => ScheduledAudio;
	pause: () => Promise<void>;
	resume: () => Promise<void>;
	dispose: () => Promise<void>;
	beginPcmStream?: (sampleRate: number, channels: number, startAt: number) => PcmStreamPlayback;
	watchTime?: (callback: (currentTime: number) => void) => () => void;
	playbackRate?: number;
}

function decodePcmSamples(bytes: Uint8Array): Float32Array {
	const frameCount = bytes.byteLength / 2;
	const samples = new Float32Array(frameCount);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	for (let index = 0; index < frameCount; index += 1) {
		samples[index] = view.getInt16(index * 2, true) / 32768;
	}
	return samples;
}

function mergePendingChunks(pendingChunks: Uint8Array[], pendingByteLength: number): Uint8Array {
	const bytes = new Uint8Array(pendingByteLength);
	let writeOffset = 0;
	pendingChunks.forEach((chunk) => {
		bytes.set(chunk, writeOffset);
		writeOffset += chunk.byteLength;
	});
	return bytes;
}

function stopBufferSources(sources: Set<AudioBufferSourceNode>): void {
	sources.forEach((source) => {
		try {
			source.stop();
		} catch (error: unknown) {
			if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
				throw error;
			}
		}
	});
}

export class WebAudioPlaybackEngine implements AudioPlaybackEngine {
	public readonly playbackRate: number;

	constructor(
		private readonly context: AudioContext,
		playbackRate: number = 1.0
	) {
		this.playbackRate = Math.max(0.25, Math.min(playbackRate, 4.0));
	}

	public now(): number {
		return this.context.currentTime;
	}

	public async decode(blob: Blob): Promise<DecodedAudio> {
		const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
		return {
			duration: buffer.duration,
			value: buffer,
		};
	}

	public schedule(audio: DecodedAudio, startAt: number): ScheduledAudio {
		const source = this.context.createBufferSource();
		source.buffer = audio.value as AudioBuffer;
		if (this.playbackRate !== 1.0) {
			source.playbackRate.value = this.playbackRate;
		}
		source.connect(this.context.destination);

		let resolveEnded = () => {};
		let hasEnded = false;
		const ended = new Promise<void>((resolve) => {
			resolveEnded = resolve;
		});
		const settle = () => {
			if (hasEnded) return;
			hasEnded = true;
			resolveEnded();
		};

		source.onended = settle;
		source.start(startAt);

		const scaledDuration = audio.duration / this.playbackRate;
		return {
			endAt: startAt + scaledDuration,
			ended,
			stop: () => {
				if (hasEnded) return;
				try {
					source.stop();
				} catch (error: unknown) {
					if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
						throw error;
					}
				} finally {
					settle();
				}
			},
		};
	}

	public beginPcmStream(sampleRate: number, channels: number, startAt: number): PcmStreamPlayback {
		if (channels !== 1) {
			throw new Error(`Unsupported PCM channel count: ${channels}`);
		}

		const sources = new Set<AudioBufferSourceNode>();
		let cursor = startAt;
		let actualStartAt: number | undefined;
		let pendingByte: number | undefined;
		let pendingChunks: Uint8Array[] = [];
		let pendingByteLength = 0;
		let isFinished = false;
		let hasSettled = false;
		let resolveEnded = () => {};
		const ended = new Promise<void>((resolve) => {
			resolveEnded = resolve;
		});
		const settleIfDone = () => {
			if (hasSettled || !isFinished || sources.size > 0) return;
			hasSettled = true;
			resolveEnded();
		};
		const initialBufferBytes = Math.max(2, Math.ceil(sampleRate * PCM_INITIAL_BUFFER_SECONDS) * 2);
		const steadyBufferBytes = Math.max(2, Math.ceil(sampleRate * PCM_STEADY_BUFFER_SECONDS) * 2);

		const schedulePendingPcm = (force: boolean) => {
			const minimumBytes = actualStartAt === undefined ? initialBufferBytes : steadyBufferBytes;
			if (pendingByteLength === 0 || (!force && pendingByteLength < minimumBytes)) return;

			const bytes = mergePendingChunks(pendingChunks, pendingByteLength);
			pendingChunks = [];
			pendingByteLength = 0;

			if (actualStartAt === undefined) {
				actualStartAt = Math.max(startAt, this.context.currentTime + PCM_SCHEDULE_LEAD_SECONDS);
				cursor = actualStartAt;
			}

			const samples = decodePcmSamples(bytes);
			const buffer = this.context.createBuffer(1, samples.length, sampleRate);
			buffer.copyToChannel(samples, 0);
			const source = this.context.createBufferSource();
			source.buffer = buffer;
			if (this.playbackRate !== 1.0) source.playbackRate.value = this.playbackRate;
			source.connect(this.context.destination);
			sources.add(source);
			source.onended = () => {
				sources.delete(source);
				settleIfDone();
			};
			if (cursor < this.context.currentTime) {
				cursor = this.context.currentTime + PCM_SCHEDULE_LEAD_SECONDS;
			}
			source.start(cursor);
			cursor += buffer.duration / this.playbackRate;
		};

		return {
			get startAt() {
				return actualStartAt ?? startAt;
			},
			get duration() {
				return actualStartAt === undefined ? 0 : cursor - actualStartAt;
			},
			get endAt() {
				return cursor;
			},
			ended,
			append: (chunk: Uint8Array) => {
				if (isFinished) throw new Error('Cannot append PCM after the stream has finished');
				if (chunk.byteLength === 0) return;

				let bytes = chunk;
				if (pendingByte !== undefined) {
					bytes = new Uint8Array(chunk.byteLength + 1);
					bytes[0] = pendingByte;
					bytes.set(chunk, 1);
					pendingByte = undefined;
				}
				if (bytes.byteLength % 2 === 1) {
					pendingByte = bytes[bytes.byteLength - 1];
					bytes = bytes.subarray(0, bytes.byteLength - 1);
				}
				if (bytes.byteLength === 0) return;

				pendingChunks.push(bytes);
				pendingByteLength += bytes.byteLength;
				schedulePendingPcm(false);
			},
			finish: () => {
				if (pendingByte !== undefined) throw new Error('PCM stream ended with an incomplete sample');
				schedulePendingPcm(true);
				isFinished = true;
				settleIfDone();
			},
			stop: () => {
				if (hasSettled) return;
				isFinished = true;
				stopBufferSources(sources);
				pendingChunks = [];
				pendingByteLength = 0;
				sources.clear();
				settleIfDone();
			},
		};
	}

	public async pause(): Promise<void> {
		if (this.context.state === 'running') {
			await this.context.suspend();
		}
	}

	public async resume(): Promise<void> {
		if (this.context.state === 'suspended') {
			await this.context.resume();
		}
	}

	public async dispose(): Promise<void> {
		if (this.context.state !== 'closed') {
			await this.context.close();
		}
	}

	public watchTime(callback: (currentTime: number) => void): () => void {
		let animationFrameId = 0;
		let isWatching = true;
		const tick = () => {
			if (!isWatching) return;
			callback(this.context.currentTime);
			animationFrameId = requestAnimationFrame(tick);
		};
		animationFrameId = requestAnimationFrame(tick);

		return () => {
			isWatching = false;
			cancelAnimationFrame(animationFrameId);
		};
	}
}
