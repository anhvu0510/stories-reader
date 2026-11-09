import { useEffect, useRef, useCallback, useState, useMemo } from 'react';

import {
	cleanupStaleSource,
	clearBgmTimers,
	computeSubtleBgmVolume,
	createBgmSourceGraph,
	EDGE_READ_ALOUD_INACTIVE_SELECTOR,
	EDGE_READ_ALOUD_SELECTOR,
	getOrGenerateBgmBuffer,
	initCompressorParams,
	isEdgeReadAloudActive,
	rampGain,
	resumeAudioContext,
	safeDisconnect,
	safeMuteGain,
	safeStopAndDisconnectSource,
	shouldAbortStart,
} from './bgm/bgmAudioGraphHelpers';
import { useBgmAudioUnlockAndPreload, useBgmStateSyncEffects, type BgmRuntimeRefs } from './bgm/useBgmEffects';

export { computeSubtleBgmVolume, EDGE_READ_ALOUD_INACTIVE_SELECTOR, EDGE_READ_ALOUD_SELECTOR, isEdgeReadAloudActive };

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

function getOrCreateLowPassNode(ctx: AudioContext, ref: { current: BiquadFilterNode | null }): AudioNode {
	if (ref.current) return ref.current;
	if (typeof ctx.createBiquadFilter !== 'function') return ctx.destination;

	try {
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		const now = ctx.currentTime;
		filter.frequency?.setValueAtTime?.(2200, now);
		filter.Q?.setValueAtTime?.(0.707, now);
		ref.current = filter;
		return filter;
	} catch {
		return ctx.destination;
	}
}

function getOrCreateDynamicsCompressorNode(ctx: AudioContext, ref: { current: DynamicsCompressorNode | null }): AudioNode {
	if (ref.current) return ref.current;
	if (typeof ctx.createDynamicsCompressor !== 'function') return ctx.destination;

	try {
		const compressor = ctx.createDynamicsCompressor();
		initCompressorParams(compressor, ctx.currentTime);
		compressor.connect(ctx.destination);
		ref.current = compressor;
		return compressor;
	} catch {
		return ctx.destination;
	}
}

function performDelayedFadeAndStop(refs: BgmRuntimeRefs, fadeOutMs: number, setIsPlayingState: (val: boolean) => void): void {
	const ctx = refs.audioCtxRef.current;
	const gain = refs.gainNodeRef.current;
	const source = refs.sourceNodeRef.current;

	if (!ctx || !gain || !source) {
		refs.isPlayingRef.current = false;
		refs.sourceNodeRef.current = null;
		refs.gainNodeRef.current = null;
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

	if (refs.fadeOutTimerRef.current) clearTimeout(refs.fadeOutTimerRef.current);
	refs.fadeOutTimerRef.current = setTimeout(() => {
		safeStopAndDisconnectSource(source);
		safeDisconnect(gain);

		refs.isPlayingRef.current = false;
		refs.sourceNodeRef.current = null;
		refs.gainNodeRef.current = null;
		setIsPlayingState(false);
	}, fadeOutMs);
}

function createOrGetBgmAudioContext(refs: BgmRuntimeRefs, setIsPlayingState: (val: boolean) => void): AudioContext | null {
	if (refs.audioCtxRef.current && refs.audioCtxRef.current.state !== 'closed') {
		return refs.audioCtxRef.current;
	}
	const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextClass) return null;

	const ctx = new AudioContextClass();
	ctx.onstatechange = () => {
		if (ctx.state === 'suspended') {
			setIsPlayingState(false);
			return;
		}
		if (ctx.state !== 'running' || refs.isUserMutedRef.current || !refs.isManualPlayingRef.current) return;
		if (!refs.sourceNodeRef.current || !refs.isPlayingRef.current) {
			void refs.startBgmRef.current?.(true);
			return;
		}
		setIsPlayingState(true);
	};
	refs.audioCtxRef.current = ctx;
	return ctx;
}

function executeImmediateBgmStop(refs: BgmRuntimeRefs, setIsPlayingState: (val: boolean) => void): void {
	if (refs.fadeOutTimerRef.current) {
		clearTimeout(refs.fadeOutTimerRef.current);
		refs.fadeOutTimerRef.current = null;
	}
	safeMuteGain(refs.gainNodeRef.current, refs.audioCtxRef.current);
	safeStopAndDisconnectSource(refs.sourceNodeRef.current);
	safeDisconnect(refs.gainNodeRef.current);

	refs.isPlayingRef.current = false;
	refs.sourceNodeRef.current = null;
	refs.gainNodeRef.current = null;
	setIsPlayingState(false);
}

async function executeStartBgm(
	manual: boolean,
	refs: BgmRuntimeRefs,
	getOrCreateAudioContext: () => AudioContext | null,
	volume: number,
	fadeInMs: number,
	setIsPlayingState: (val: boolean) => void
): Promise<void> {
	if (refs.isBgmPreviewingRef.current || shouldAbortStart(manual, refs.isUserMutedRef, refs.isManualPlayingRef)) return;
	clearBgmTimers(refs.stopTimerRef, refs.fadeOutTimerRef);

	const ctx = getOrCreateAudioContext();
	if (!ctx) return;

	await resumeAudioContext(ctx, () => setIsPlayingState(true));
	const buffer = await getOrGenerateBgmBuffer(ctx, refs.audioBufferRef.current);
	refs.audioBufferRef.current = buffer;

	const safeVolume = computeSubtleBgmVolume(volume);
	if (refs.isPlayingRef.current && refs.gainNodeRef.current) {
		const gain = refs.gainNodeRef.current;
		rampGain(gain, safeVolume, ctx.currentTime, fadeInMs / 1000, gain.gain.value);
		setIsPlayingState(true);
		return;
	}

	cleanupStaleSource(refs.sourceNodeRef, refs.isPlayingRef.current);
	try {
		const lowPass = getOrCreateLowPassNode(ctx, refs.lowPassFilterNodeRef);
		const compressorOrDest = getOrCreateDynamicsCompressorNode(ctx, refs.compressorNodeRef);
		const { source, gain } = createBgmSourceGraph(ctx, buffer, safeVolume, fadeInMs, lowPass, compressorOrDest);

		refs.sourceNodeRef.current = source;
		refs.gainNodeRef.current = gain;
		refs.isPlayingRef.current = true;
		setIsPlayingState(true);
	} catch (err) {
		console.error('[EdgeBgm] Failed to start isolated BGM playback:', err);
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

	const refs: BgmRuntimeRefs = useMemo(
		() => ({
			audioCtxRef,
			gainNodeRef,
			lowPassFilterNodeRef,
			compressorNodeRef,
			sourceNodeRef,
			audioBufferRef,
			isPlayingRef,
			isManualPlayingRef,
			isUserMutedRef,
			isBgmPreviewingRef,
			isTTSActiveRef,
			stopTimerRef,
			fadeOutTimerRef,
			startBgmRef,
		}),
		[]
	);

	const getOrCreateAudioContext = useCallback(() => createOrGetBgmAudioContext(refs, setIsPlayingState), [refs]);

	const startBgm = useCallback(
		(manual = false) => executeStartBgm(manual, refs, getOrCreateAudioContext, volume, fadeInMs, setIsPlayingState),
		[refs, getOrCreateAudioContext, volume, fadeInMs]
	);

	useEffect(() => {
		startBgmRef.current = startBgm;
	}, [startBgm]);

	const stopBgm = useCallback(
		(immediate = false) => {
			if (!isPlayingRef.current && !sourceNodeRef.current) return;
			if (stopTimerRef.current) {
				clearTimeout(stopTimerRef.current);
				stopTimerRef.current = null;
			}

			if (immediate) {
				executeImmediateBgmStop(refs, setIsPlayingState);
				return;
			}

			stopTimerRef.current = setTimeout(() => performDelayedFadeAndStop(refs, fadeOutMs, setIsPlayingState), stopDelayMs);
		},
		[fadeOutMs, stopDelayMs, refs]
	);

	useBgmStateSyncEffects({ enabled, volume, isBgmPreviewing, isTTSActive, refs, startBgm, stopBgm });
	useBgmAudioUnlockAndPreload({ audioUrl, enabled, refs, getOrCreateAudioContext, startBgm, setIsPlayingState });

	const toggleBgm = useCallback(() => {
		const isCtxRunning = audioCtxRef.current?.state === 'running';
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

	return {
		isPlaying: isPlayingState,
		toggleBgm,
		startBgm,
		stopBgm,
	};
}
