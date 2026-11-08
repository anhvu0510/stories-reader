import { useEffect, useRef, useCallback, useState } from 'react';

import { generateBgmBufferInWorker } from '@/services/bgmAudioWorkerService';
import { getAssetUrl } from '@/shared/utils/assetUrl';

export interface EdgeReadAloudBgmOptions {
	audioUrl: string;
	volume?: number;
	fadeInMs?: number;
	fadeOutMs?: number;
	stopDelayMs?: number;
	enabled?: boolean;
	isBgmPreviewing?: boolean;
	isTTSActive?: boolean;
}

export interface EdgeReadAloudBgmReturn {
	isPlaying: boolean;
	toggleBgm: () => void;
	startBgm: (manual?: boolean) => void;
	stopBgm: (immediate?: boolean) => void;
}

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
function createSynthesizedAmbientBuffer(ctx: AudioContext): AudioBuffer | null {
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

function safeDisconnect(node: AudioNode | null): void {
	if (!node) return;
	try {
		node.disconnect();
	} catch (err) {
		console.warn('[EdgeBgm] Disconnect node ignored:', err);
	}
}

function safeStopAndDisconnectSource(source: AudioBufferSourceNode | null): void {
	if (!source) return;
	try {
		source.stop();
		source.disconnect();
	} catch (err) {
		console.warn('[EdgeBgm] Stop source ignored:', err);
	}
}

function safeMuteGain(gain: GainNode | null, ctx: AudioContext | null): void {
	if (!gain || !ctx) return;
	try {
		const now = ctx.currentTime;
		gain.gain.cancelScheduledValues?.(now);
		gain.gain.setValueAtTime?.(0, now);
	} catch (err) {
		console.warn('[EdgeBgm] Mute gain ignored:', err);
	}
}

export function useEdgeReadAloudBgm({
	audioUrl,
	volume = 0.15,
	fadeInMs = 500,
	fadeOutMs = 800,
	stopDelayMs = 1500,
	enabled = true,
	isBgmPreviewing = false,
	isTTSActive = false,
}: EdgeReadAloudBgmOptions): EdgeReadAloudBgmReturn {
	const [isPlayingState, setIsPlayingState] = useState(false);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const gainNodeRef = useRef<GainNode | null>(null);
	const lowPassFilterNodeRef = useRef<BiquadFilterNode | null>(null);
	const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
	const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
	const audioBufferRef = useRef<AudioBuffer | null>(null);
	const isPlayingRef = useRef(false);
	const isManualPlayingRef = useRef(false);
	const isUserMutedRef = useRef(false);
	const isBgmPreviewingRef = useRef(isBgmPreviewing);
	isBgmPreviewingRef.current = isBgmPreviewing;
	const isTTSActiveRef = useRef(isTTSActive);
	isTTSActiveRef.current = isTTSActive;
	const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startBgmRef = useRef<((manual?: boolean) => Promise<void>) | null>(null);

	// Helper to ensure BGM runs on its own isolated AudioContext graph (no HTML5 MediaSession interference)
	const getOrCreateAudioContext = useCallback(() => {
		if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
			return audioCtxRef.current;
		}
		const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextClass) return null;

		const ctx = new AudioContextClass();
		ctx.onstatechange = () => {
			if (ctx.state === 'suspended') {
				setIsPlayingState(false);
				return;
			}
			if (ctx.state !== 'running') return;
			if (isUserMutedRef.current || !isManualPlayingRef.current) return;

			if (!sourceNodeRef.current || !isPlayingRef.current) {
				void startBgmRef.current?.(true);
				return;
			}
			setIsPlayingState(true);
		};
		audioCtxRef.current = ctx;
		return ctx;
	}, []);

	// Low-Pass Acoustic BiquadFilter (2200Hz cutoff) to keep BGM frequency spectrum behind speech clarity
	const getOrCreateLowPassFilterNode = useCallback((ctx: AudioContext): AudioNode => {
		if (lowPassFilterNodeRef.current) return lowPassFilterNodeRef.current;
		if (typeof ctx.createBiquadFilter !== 'function') return ctx.destination;

		try {
			const filter = ctx.createBiquadFilter();
			filter.type = 'lowpass';
			const now = ctx.currentTime;
			filter.frequency?.setValueAtTime?.(2200, now);
			filter.Q?.setValueAtTime?.(0.707, now);
			lowPassFilterNodeRef.current = filter;
			return filter;
		} catch {
			return ctx.destination;
		}
	}, []);

	// Set up isolated DynamicsCompressor node to cap dynamic range and prevent mobile volume ducking
	const getOrCreateCompressorNode = useCallback((ctx: AudioContext): AudioNode => {
		if (compressorNodeRef.current) return compressorNodeRef.current;
		if (typeof ctx.createDynamicsCompressor !== 'function') return ctx.destination;

		try {
			const compressor = ctx.createDynamicsCompressor();
			initCompressorParams(compressor, ctx.currentTime);
			compressor.connect(ctx.destination);
			compressorNodeRef.current = compressor;
			return compressor;
		} catch {
			return ctx.destination;
		}
	}, []);

	const startBgm = useCallback(
		async (manual = false) => {
			if (isBgmPreviewingRef.current) return;
			if (shouldAbortStart(manual, isUserMutedRef, isManualPlayingRef)) return;

			clearBgmTimers(stopTimerRef, fadeOutTimerRef);

			const ctx = getOrCreateAudioContext();
			if (!ctx) return;

			await resumeAudioContext(ctx, () => setIsPlayingState(true));

			const buffer = await getOrGenerateBgmBuffer(ctx, audioBufferRef.current);
			audioBufferRef.current = buffer;

			// Compute subtle volume scaled down strictly behind speech levels
			const safeVolume = computeSubtleBgmVolume(volume);

			if (isPlayingRef.current && gainNodeRef.current) {
				const gain = gainNodeRef.current;
				rampGain(gain, safeVolume, ctx.currentTime, fadeInMs / 1000, gain.gain.value);
				setIsPlayingState(true);
				return;
			}

			cleanupStaleSource(sourceNodeRef, isPlayingRef.current);

			try {
				const lowPass = getOrCreateLowPassFilterNode(ctx);
				const compressorOrDest = getOrCreateCompressorNode(ctx);
				const { source, gain } = createBgmSourceGraph(ctx, buffer, safeVolume, fadeInMs, lowPass, compressorOrDest);

				sourceNodeRef.current = source;
				gainNodeRef.current = gain;
				isPlayingRef.current = true;
				setIsPlayingState(true);
			} catch (err) {
				console.error('[EdgeBgm] Failed to start isolated BGM playback:', err);
			}
		},
		[getOrCreateAudioContext, getOrCreateLowPassFilterNode, getOrCreateCompressorNode, volume, fadeInMs]
	);

	useEffect(() => {
		startBgmRef.current = startBgm;
	}, [startBgm]);

	// Realtime volume adjustment effect while background music is currently playing
	useEffect(() => {
		if (!isPlayingRef.current || !gainNodeRef.current || !audioCtxRef.current) return;
		const ctx = audioCtxRef.current;
		const gain = gainNodeRef.current;
		const safeVolume = computeSubtleBgmVolume(volume);
		const now = ctx.currentTime;

		try {
			if (typeof gain.gain.cancelScheduledValues === 'function') {
				gain.gain.cancelScheduledValues(now);
			}
			if (typeof gain.gain.setValueAtTime === 'function') {
				gain.gain.setValueAtTime(safeVolume, now);
			}
		} catch (err) {
			console.warn('[EdgeBgm] Realtime volume update warning:', err);
		}
	}, [volume]);

	const stopBgm = useCallback(
		(immediate = false) => {
			if (!isPlayingRef.current && !sourceNodeRef.current) return;

			if (stopTimerRef.current) {
				clearTimeout(stopTimerRef.current);
				stopTimerRef.current = null;
			}

			if (immediate) {
				if (fadeOutTimerRef.current) {
					clearTimeout(fadeOutTimerRef.current);
					fadeOutTimerRef.current = null;
				}

				const ctx = audioCtxRef.current;
				const gain = gainNodeRef.current;
				const source = sourceNodeRef.current;

				safeMuteGain(gain, ctx);

				safeStopAndDisconnectSource(source);
				safeDisconnect(gain);

				isPlayingRef.current = false;
				sourceNodeRef.current = null;
				gainNodeRef.current = null;
				setIsPlayingState(false);
				return;
			}

			const performFadeAndStop = () => {
				const ctx = audioCtxRef.current;
				const gain = gainNodeRef.current;
				const source = sourceNodeRef.current;

				if (!ctx || !gain || !source) {
					isPlayingRef.current = false;
					sourceNodeRef.current = null;
					gainNodeRef.current = null;
					setIsPlayingState(false);
					return;
				}

				const now = ctx.currentTime;
				gain.gain.cancelScheduledValues?.(now);
				gain.gain.setValueAtTime?.(Math.max(gain.gain.value, 0.0001), now);
				if (typeof gain.gain.linearRampToValueAtTime === 'function') {
					gain.gain.linearRampToValueAtTime(0, now + fadeOutMs / 1000);
				} else if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
					gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutMs / 1000);
				}

				if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
				fadeOutTimerRef.current = setTimeout(() => {
					safeStopAndDisconnectSource(source);
					safeDisconnect(gain);

					isPlayingRef.current = false;
					sourceNodeRef.current = null;
					gainNodeRef.current = null;
					setIsPlayingState(false);
				}, fadeOutMs);
			};

			stopTimerRef.current = setTimeout(performFadeAndStop, stopDelayMs);
		},
		[fadeOutMs, stopDelayMs]
	);

	const prevEnabledRef = useRef(enabled);
	const prevPreviewRef = useRef(isBgmPreviewing);

	// Realtime enable/disable effect
	useEffect(() => {
		if (prevEnabledRef.current === enabled) return;
		prevEnabledRef.current = enabled;

		if (!enabled && (isPlayingRef.current || sourceNodeRef.current)) {
			stopBgm(true);
		}
	}, [enabled, stopBgm]);

	// Pause reader BGM while user previews audio in Settings tab, resume when preview stops
	useEffect(() => {
		if (prevPreviewRef.current === isBgmPreviewing) return;
		prevPreviewRef.current = isBgmPreviewing;

		if (isBgmPreviewing && (isPlayingRef.current || sourceNodeRef.current)) {
			stopBgm(true);
			return;
		}

		if (!isBgmPreviewing && enabled && isManualPlayingRef.current && !isUserMutedRef.current) {
			void startBgm(true);
		}
	}, [isBgmPreviewing, enabled, stopBgm, startBgm]);

	// Đồng bộ phát/dừng BGM theo trạng thái đọc TTS của App (hỗ trợ Android native & Web)
	const prevTTSActiveRef = useRef(isTTSActive);
	useEffect(() => {
		if (prevTTSActiveRef.current === isTTSActive) return;
		prevTTSActiveRef.current = isTTSActive;

		if (!enabled || isBgmPreviewingRef.current) return;

		if (isTTSActive && !isUserMutedRef.current) {
			void startBgm(false);
			return;
		}

		if (!isTTSActive && (isPlayingRef.current || sourceNodeRef.current)) {
			stopBgm(true);
		}
	}, [isTTSActive, enabled, startBgm, stopBgm]);

	// Observe DOM for Edge Read Aloud state changes (auto-start, auto-pause on inactive highlight, auto-resume on start)
	useEffect(() => {
		if (!enabled || typeof document === 'undefined') return;

		let wasActive = isEdgeReadAloudActive();

		const checkDomState = () => {
			const hasInactive = Boolean(document.querySelector(EDGE_READ_ALOUD_INACTIVE_SELECTOR));
			const isActive = isEdgeReadAloudActive();
			const hasBgmActive = isBgmActive(isPlayingRef.current, sourceNodeRef.current);

			if (hasInactive) {
				if (hasBgmActive) stopBgm(true);
				wasActive = isActive;
				return;
			}

			if (isActive) {
				if (canResumeBgm(isManualPlayingRef.current, isPlayingRef.current, isUserMutedRef.current, isBgmPreviewingRef.current)) {
					void startBgmRef.current?.(false);
				}
				wasActive = isActive;
				return;
			}

			if (wasActive && hasBgmActive && !isManualPlayingRef.current) {
				stopBgm(true);
			}
			wasActive = isActive;
		};

		checkDomState();

		const observer = new MutationObserver(checkDomState);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
		});

		return () => {
			observer.disconnect();
		};
	}, [enabled, stopBgm]);

	const toggleBgm = useCallback(() => {
		const ctx = audioCtxRef.current;
		const isCtxRunning = ctx?.state === 'running';
		const currentlyActive = (isPlayingRef.current || Boolean(sourceNodeRef.current)) && isCtxRunning;

		if (currentlyActive) {
			isUserMutedRef.current = true;
			isManualPlayingRef.current = false;
			stopBgm(true);
			setIsPlayingState(false);
			return;
		}

		isUserMutedRef.current = false;
		isManualPlayingRef.current = true;
		const hasInactive = typeof document !== 'undefined' && Boolean(document.querySelector(EDGE_READ_ALOUD_INACTIVE_SELECTOR));
		if (!hasInactive) {
			void startBgm(true);
		}
	}, [startBgm, stopBgm]);

	// Mobile-aware synchronous user touch & click & scroll & selection unlocker for isolated AudioContext
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const unlockAudio = () => {
			const ctx = getOrCreateAudioContext();
			if (!ctx) return;

			const triggerAutoPlayback = () => {
				removeUnlockListeners();
				if (isUserMutedRef.current || !isManualPlayingRef.current) return;
				if (sourceNodeRef.current && isPlayingRef.current) return;
				void startBgmRef.current?.(true);
			};

			if (ctx.state === 'suspended') {
				void ctx
					.resume()
					.then(() => {
						if (ctx.state === 'running') triggerAutoPlayback();
					})
					.catch(() => {});
			} else if (ctx.state === 'running') {
				triggerAutoPlayback();
			}

			try {
				const dummy = ctx.createBuffer(1, 1, 22050);
				const node = ctx.createBufferSource();
				node.buffer = dummy;
				node.connect(ctx.destination);
				node.start(0);
			} catch (err) {
				console.warn('[EdgeBgm] Dummy audio buffer error ignored:', err);
			}
		};

		const removeUnlockListeners = () => {
			window.removeEventListener('pointerdown', unlockAudio, { capture: true });
			window.removeEventListener('touchstart', unlockAudio, { capture: true });
			window.removeEventListener('click', unlockAudio, { capture: true });
			window.removeEventListener('keydown', unlockAudio, { capture: true });
		};

		window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
		window.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
		window.addEventListener('click', unlockAudio, { capture: true, passive: true });
		window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });

		return removeUnlockListeners;
	}, [getOrCreateAudioContext]);

	// Preload and decode background audio buffer with AbortController signal
	useEffect(() => {
		if (!enabled || !audioUrl || typeof window === 'undefined') return;

		const controller = new AbortController();
		let isMounted = true;

		const loadAudio = async () => {
			try {
				const arrayBuffer = await fetchAudioArrayBuffer(audioUrl, controller.signal);
				const ctx = getOrCreateAudioContext();
				if (!ctx) return;

				const decoded = await decodeAudioDataSafe(ctx, arrayBuffer);

				if (!isMounted) {
					if (ctx.state !== 'closed') void ctx.close();
					return;
				}

				audioBufferRef.current = decoded;
				handleAudioLoaded(
					decoded,
					isPlayingRef.current,
					sourceNodeRef.current,
					isUserMutedRef.current,
					isManualPlayingRef.current,
					isTTSActiveRef.current,
					(manual) => void startBgm(manual),
					() => {
						safeStopAndDisconnectSource(sourceNodeRef.current);
						sourceNodeRef.current = null;
						isPlayingRef.current = false;
						void startBgmRef.current?.(true);
					}
				);
			} catch (err: unknown) {
				const errorObj = err as { name?: string };
				if (errorObj?.name === 'AbortError') return;
				console.warn('[EdgeBgm] Could not load audio file, using synth ambient fallback:', err);
				if (!isMounted) return;

				const ctx = getOrCreateAudioContext();
				if (ctx) {
					audioBufferRef.current = createSynthesizedAmbientBuffer(ctx);
				}
			}
		};

		void loadAudio();

		return () => {
			isMounted = false;
			controller.abort();
			if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
			if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);

			safeStopAndDisconnectSource(sourceNodeRef.current);
			sourceNodeRef.current = null;

			safeDisconnect(gainNodeRef.current);
			gainNodeRef.current = null;

			safeDisconnect(lowPassFilterNodeRef.current);
			lowPassFilterNodeRef.current = null;

			safeDisconnect(compressorNodeRef.current);
			compressorNodeRef.current = null;

			if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
				void audioCtxRef.current.close();
				audioCtxRef.current = null;
			}
			audioBufferRef.current = null;
			isPlayingRef.current = false;
			setIsPlayingState(false);
		};
	}, [audioUrl, enabled, getOrCreateAudioContext, startBgm]);

	return {
		isPlaying: isPlayingState,
		toggleBgm,
		startBgm,
		stopBgm,
	};
}

function initCompressorParams(compressor: DynamicsCompressorNode, time: number): void {
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

function clearBgmTimers(stopTimer: { current: NodeJS.Timeout | null }, fadeOutTimer: { current: NodeJS.Timeout | null }): void {
	if (stopTimer.current) {
		clearTimeout(stopTimer.current);
		stopTimer.current = null;
	}
	if (fadeOutTimer.current) {
		clearTimeout(fadeOutTimer.current);
		fadeOutTimer.current = null;
	}
}

function cleanupStaleSource(sourceRef: { current: AudioBufferSourceNode | null }, isPlaying: boolean): void {
	if (sourceRef.current && !isPlaying) {
		safeStopAndDisconnectSource(sourceRef.current);
		sourceRef.current = null;
	}
}

function shouldAbortStart(manual: boolean, isUserMutedRef: { current: boolean }, isManualPlayingRef: { current: boolean }): boolean {
	if (manual) {
		isUserMutedRef.current = false;
		isManualPlayingRef.current = true;
		return false;
	}
	return isUserMutedRef.current;
}

async function resumeAudioContext(ctx: AudioContext, onRunning: () => void): Promise<void> {
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

async function getOrGenerateBgmBuffer(ctx: AudioContext, currentBuffer: AudioBuffer | null): Promise<AudioBuffer> {
	if (currentBuffer && currentBuffer.duration >= 0.1) return currentBuffer;
	const buffer = await generateBgmBufferInWorker(ctx);
	return buffer || createSynthesizedAmbientBuffer(ctx);
}

function rampGain(gain: GainNode, targetVolume: number, startTime: number, durationSeconds: number, startVolume?: number): void {
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

function createBgmSourceGraph(
	ctx: AudioContext,
	buffer: AudioBuffer,
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

function isBgmActive(isPlaying: boolean, source: AudioBufferSourceNode | null): boolean {
	return isPlaying || Boolean(source);
}

function canResumeBgm(isManual: boolean, isPlaying: boolean, isMuted: boolean, isPreviewing: boolean): boolean {
	return isManual && !isPlaying && !isMuted && !isPreviewing;
}

async function fetchAudioArrayBuffer(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
	const resolvedUrl = getAssetUrl(url);
	const response = await fetch(resolvedUrl, { signal });
	if (response.ok === false) throw new Error(`HTTP error ${response.status}`);
	const contentType = response.headers?.get ? response.headers.get('content-type') || '' : '';
	if (contentType.includes('text/html')) {
		throw new Error('Received HTML instead of audio');
	}
	return response.arrayBuffer();
}

function decodeAudioDataSafe(ctx: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
	return new Promise<AudioBuffer>((resolve, reject) => {
		const promise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
		if (promise && typeof promise.then === 'function') {
			promise.then(resolve).catch(reject);
		}
	});
}

function handleAudioLoaded(
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
