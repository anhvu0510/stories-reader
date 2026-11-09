import { generateBgmBufferInWorker } from '@/services/bgmAudioWorkerService';
import { getAssetUrl } from '@/shared/utils/assetUrl';

export const EDGE_READ_ALOUD_SELECTOR =
	'.msreadout-line-highlight, .msreadout-word-highlight, .msreadout-highlight, msreadoutspan, [class*="msreadout"], [data-readout-highlight]';

export const EDGE_READ_ALOUD_INACTIVE_SELECTOR =
	'.msreadout-inactive-highlight, .msreadout-inactive-line-highlight, [class*="inactive-highlight"]';

export function isEdgeReadAloudActive(root: ParentNode = document): boolean {
	const hasInactive = Boolean(root.querySelector(EDGE_READ_ALOUD_INACTIVE_SELECTOR));
	if (hasInactive) return false;

	return Boolean(root.querySelector(EDGE_READ_ALOUD_SELECTOR));
}

/**
 * Scales user volume setting (0.0 - 1.0) down to an ambient background level (max 0.25 ~ -12dB).
 * Capped at 25% output gain ceiling to ensure background music stays acoustically
 * behind speech TTS while scaling 1:1 with the Settings preview volume slider.
 */
export function computeSubtleBgmVolume(inputVolume: number): number {
	const clamped = Math.min(Math.max(inputVolume, 0), 1.0);
	const MAX_CEILING = 0.25; // 25% maximum output gain ceiling for background music
	return clamped * MAX_CEILING;
}

/**
 * Creates a soft 4-second synthesized ambient loop (C-major chord)
 * fallback if physical audio file is missing or worker is unavailable.
 */
export function createSynthesizedAmbientBuffer(ctx: AudioContext): AudioBuffer | null {
	if (typeof ctx.createBuffer !== 'function') return null;
	const sampleRate = ctx.sampleRate || 44100;
	const duration = 4.0;
	const numSamples = Math.floor(sampleRate * duration);
	const buffer = ctx.createBuffer(2, numSamples, sampleRate);
	if (!buffer || typeof buffer.getChannelData !== 'function') return null;

	const left = buffer.getChannelData(0);
	const right = buffer.getChannelData(1);

	for (let i = 0; i < numSamples; i++) {
		const t = i / sampleRate;
		const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
		const note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.12;
		const note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.1;
		const note3 = Math.sin(2 * Math.PI * 392.0 * t) * 0.08;
		const wave = (note1 + note2 + note3) * lfo;

		left[i] = wave;
		right[i] = wave;
	}

	return buffer;
}

export function safeDisconnect(node: AudioNode | null): void {
	if (!node) return;
	try {
		node.disconnect();
	} catch (err) {
		console.warn('[EdgeBgm] Disconnect node ignored:', err);
	}
}

export function safeStopAndDisconnectSource(source: AudioBufferSourceNode | null): void {
	if (!source) return;
	try {
		source.stop();
		source.disconnect();
	} catch (err) {
		console.warn('[EdgeBgm] Stop source ignored:', err);
	}
}

export function safeMuteGain(gain: GainNode | null, ctx: AudioContext | null): void {
	if (!gain || !ctx) return;
	try {
		const now = ctx.currentTime;
		gain.gain.cancelScheduledValues?.(now);
		gain.gain.setValueAtTime?.(0, now);
	} catch (err) {
		console.warn('[EdgeBgm] Mute gain ignored:', err);
	}
}

export function initCompressorParams(compressor: DynamicsCompressorNode, time: number): void {
	try {
		const c = compressor as unknown as Record<string, { setValueAtTime: (v: number, t: number) => void }>;
		c.threshold.setValueAtTime(-24, time);
		c.knee.setValueAtTime(30, time);
		c.ratio.setValueAtTime(12, time);
		c.attack.setValueAtTime(0.003, time);
		c.release.setValueAtTime(0.25, time);
	} catch {
		// Mock environment fallback
	}
}

export function clearBgmTimers(stopTimer: { current: NodeJS.Timeout | null }, fadeOutTimer: { current: NodeJS.Timeout | null }): void {
	if (stopTimer.current) {
		clearTimeout(stopTimer.current);
		stopTimer.current = null;
	}
	if (fadeOutTimer.current) {
		clearTimeout(fadeOutTimer.current);
		fadeOutTimer.current = null;
	}
}

export function cleanupStaleSource(sourceRef: { current: AudioBufferSourceNode | null }, isPlaying: boolean): void {
	if (sourceRef.current && !isPlaying) {
		safeStopAndDisconnectSource(sourceRef.current);
		sourceRef.current = null;
	}
}

export function shouldAbortStart(manual: boolean, isUserMutedRef: { current: boolean }, isManualPlayingRef: { current: boolean }): boolean {
	if (manual) {
		isUserMutedRef.current = false;
		isManualPlayingRef.current = true;
		return false;
	}
	return isUserMutedRef.current;
}

export async function resumeAudioContext(ctx: AudioContext, onRunning: () => void): Promise<void> {
	if (ctx.state !== 'suspended') return;
	try {
		await ctx.resume();
		if ((ctx.state as string) === 'running') {
			onRunning();
		}
	} catch (err) {
		console.warn('[EdgeBgm] Could not resume isolated AudioContext:', err);
	}
}

export async function getOrGenerateBgmBuffer(ctx: AudioContext, currentBuffer: AudioBuffer | null): Promise<AudioBuffer | null> {
	if (currentBuffer && currentBuffer.duration >= 0.1) return currentBuffer;
	const buffer = await generateBgmBufferInWorker(ctx);
	return buffer || createSynthesizedAmbientBuffer(ctx);
}

export function rampGain(gain: GainNode, targetVolume: number, startTime: number, durationSeconds: number, startVolume?: number): void {
	if (typeof gain.gain.cancelScheduledValues === 'function') {
		gain.gain.cancelScheduledValues(startTime);
	}
	if (startVolume !== undefined && typeof gain.gain.setValueAtTime === 'function') {
		gain.gain.setValueAtTime(startVolume, startTime);
	}
	if (typeof gain.gain.linearRampToValueAtTime === 'function') {
		gain.gain.linearRampToValueAtTime(targetVolume, startTime + durationSeconds);
	} else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
		gain.gain.exponentialRampToValueAtTime(Math.max(targetVolume, 0.0001), startTime + durationSeconds);
	}
}

export function createBgmSourceGraph(
	ctx: AudioContext,
	buffer: AudioBuffer | null,
	safeVolume: number,
	fadeInMs: number,
	lowPass: AudioNode,
	compressorOrDest: AudioNode
): { source: AudioBufferSourceNode; gain: GainNode } {
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	source.loop = true;

	const gain = ctx.createGain();
	rampGain(gain, safeVolume, ctx.currentTime, fadeInMs / 1000, 0);

	source.connect(gain);
	if (lowPass === ctx.destination) {
		gain.connect(compressorOrDest);
	} else {
		gain.connect(lowPass);
		lowPass.connect(compressorOrDest);
	}

	source.start(0);
	return { source, gain };
}

export function isBgmActive(isPlaying: boolean, source: AudioBufferSourceNode | null): boolean {
	return isPlaying || Boolean(source);
}

export function canResumeBgm(isManual: boolean, isPlaying: boolean, isMuted: boolean, isPreviewing: boolean): boolean {
	return isManual && !isPlaying && !isMuted && !isPreviewing;
}

export async function fetchAudioArrayBuffer(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
	const resolvedUrl = getAssetUrl(url);
	const response = await fetch(resolvedUrl, { signal });
	if (response.ok === false) throw new Error(`HTTP error ${response.status}`);
	const contentType = response.headers?.get ? response.headers.get('content-type') || '' : '';
	if (contentType.includes('text/html')) {
		throw new Error('Received HTML instead of audio');
	}
	return response.arrayBuffer();
}

export function decodeAudioDataSafe(ctx: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
	return new Promise<AudioBuffer>((resolve, reject) => {
		const promise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
		if (promise && typeof promise.then === 'function') {
			promise.then(resolve).catch(reject);
		}
	});
}

export function handleAudioLoaded(
	decoded: AudioBuffer,
	isPlaying: boolean,
	sourceNode: AudioBufferSourceNode | null,
	isUserMuted: boolean,
	isManualPlaying: boolean,
	isTTSActive: boolean,
	onStartBgm: (manual: boolean) => void,
	onRestartPlaying: () => void
): void {
	if (decoded.duration <= 0.1) return;

	if (isPlaying && sourceNode) {
		onRestartPlaying();
		return;
	}

	if (isUserMuted) return;

	if (isManualPlaying) {
		onStartBgm(true);
		return;
	}

	if (isTTSActive && !isPlaying) {
		onStartBgm(false);
	}
}
