import { useEffect, useRef, type RefObject } from 'react';

import {
	canResumeBgm,
	computeSubtleBgmVolume,
	createSynthesizedAmbientBuffer,
	decodeAudioDataSafe,
	EDGE_READ_ALOUD_INACTIVE_SELECTOR,
	fetchAudioArrayBuffer,
	handleAudioLoaded,
	isBgmActive,
	isEdgeReadAloudActive,
	safeDisconnect,
	safeStopAndDisconnectSource,
} from './bgmAudioGraphHelpers';

export interface BgmRuntimeRefs {
	audioCtxRef: RefObject<AudioContext | null>;
	gainNodeRef: RefObject<GainNode | null>;
	lowPassFilterNodeRef: RefObject<BiquadFilterNode | null>;
	compressorNodeRef: RefObject<DynamicsCompressorNode | null>;
	sourceNodeRef: RefObject<AudioBufferSourceNode | null>;
	audioBufferRef: RefObject<AudioBuffer | null>;
	isPlayingRef: RefObject<boolean>;
	isManualPlayingRef: RefObject<boolean>;
	isUserMutedRef: RefObject<boolean>;
	isBgmPreviewingRef: RefObject<boolean>;
	isTTSActiveRef: RefObject<boolean>;
	stopTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
	fadeOutTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
	startBgmRef: RefObject<((manual?: boolean) => Promise<void>) | null>;
}

interface BgmSyncEffectParams {
	enabled: boolean;
	volume: number;
	isBgmPreviewing: boolean;
	isTTSActive: boolean;
	refs: BgmRuntimeRefs;
	startBgm: (manual?: boolean) => Promise<void>;
	stopBgm: (immediate?: boolean) => void;
}

export function useBgmStateSyncEffects({
	enabled,
	volume,
	isBgmPreviewing,
	isTTSActive,
	refs,
	startBgm,
	stopBgm,
}: BgmSyncEffectParams): void {
	const { audioCtxRef, gainNodeRef, sourceNodeRef, isPlayingRef, isManualPlayingRef, isUserMutedRef, isBgmPreviewingRef, startBgmRef } =
		refs;

	// Realtime volume adjustment effect while background music is currently playing
	useEffect(() => {
		if (!isPlayingRef.current || !gainNodeRef.current || !audioCtxRef.current) return;
		const ctx = audioCtxRef.current;
		const gain = gainNodeRef.current;
		const safeVolume = computeSubtleBgmVolume(volume);
		const now = ctx.currentTime;

		try {
			gain.gain.cancelScheduledValues?.(now);
			gain.gain.setValueAtTime?.(safeVolume, now);
		} catch (err) {
			console.warn('[EdgeBgm] Realtime volume update warning:', err);
		}
	}, [volume, audioCtxRef, gainNodeRef, isPlayingRef]);

	const prevEnabledRef = useRef(enabled);
	useEffect(() => {
		if (prevEnabledRef.current === enabled) return;
		prevEnabledRef.current = enabled;

		if (!enabled && (isPlayingRef.current || sourceNodeRef.current)) {
			stopBgm(true);
		}
	}, [enabled, stopBgm, isPlayingRef, sourceNodeRef]);

	const prevPreviewRef = useRef(isBgmPreviewing);
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
	}, [isBgmPreviewing, enabled, stopBgm, startBgm, isPlayingRef, sourceNodeRef, isManualPlayingRef, isUserMutedRef]);

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
	}, [isTTSActive, enabled, startBgm, stopBgm, isBgmPreviewingRef, isUserMutedRef, isPlayingRef, sourceNodeRef]);

	// Observe DOM for Edge Read Aloud state changes
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
		observer.observe(document.body, { childList: true, subtree: true, attributes: true });
		return () => observer.disconnect();
	}, [enabled, stopBgm, isPlayingRef, sourceNodeRef, isManualPlayingRef, isUserMutedRef, isBgmPreviewingRef, startBgmRef]);
}

export function useBgmAudioUnlockAndPreload(params: {
	audioUrl: string;
	enabled: boolean;
	refs: BgmRuntimeRefs;
	getOrCreateAudioContext: () => AudioContext | null;
	startBgm: (manual?: boolean) => Promise<void>;
	setIsPlayingState: (val: boolean) => void;
}): void {
	const { audioUrl, enabled, refs, getOrCreateAudioContext, startBgm, setIsPlayingState } = params;

	useEffect(() => {
		if (typeof window === 'undefined') return;
		return bindMobileAudioUnlock(getOrCreateAudioContext, refs);
	}, [getOrCreateAudioContext, refs]);

	useEffect(() => {
		if (!enabled || !audioUrl || typeof window === 'undefined') return;
		return preloadAndCleanupBgmAudio(audioUrl, refs, getOrCreateAudioContext, startBgm, setIsPlayingState);
	}, [audioUrl, enabled, getOrCreateAudioContext, startBgm, refs, setIsPlayingState]);
}

function bindMobileAudioUnlock(getOrCreateAudioContext: () => AudioContext | null, refs: BgmRuntimeRefs): () => void {
	const unlockAudio = () => {
		const ctx = getOrCreateAudioContext();
		if (!ctx) return;

		const triggerAutoPlayback = () => {
			removeUnlockListeners();
			if (refs.isUserMutedRef.current || !refs.isManualPlayingRef.current) return;
			if (refs.sourceNodeRef.current && refs.isPlayingRef.current) return;
			void refs.startBgmRef.current?.(true);
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
}

function preloadAndCleanupBgmAudio(
	audioUrl: string,
	refs: BgmRuntimeRefs,
	getOrCreateAudioContext: () => AudioContext | null,
	startBgm: (manual?: boolean) => Promise<void>,
	setIsPlayingState: (val: boolean) => void
): () => void {
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

			refs.audioBufferRef.current = decoded;
			handleAudioLoaded(
				decoded,
				refs.isPlayingRef.current,
				refs.sourceNodeRef.current,
				refs.isUserMutedRef.current,
				refs.isManualPlayingRef.current,
				refs.isTTSActiveRef.current,
				(manual) => void startBgm(manual),
				() => {
					safeStopAndDisconnectSource(refs.sourceNodeRef.current);
					refs.sourceNodeRef.current = null;
					refs.isPlayingRef.current = false;
					void refs.startBgmRef.current?.(true);
				}
			);
		} catch (err: unknown) {
			const errorObj = err as { name?: string };
			if (errorObj?.name === 'AbortError') return;
			console.warn('[EdgeBgm] Could not load audio file, using synth ambient fallback:', err);
			if (!isMounted) return;

			const ctx = getOrCreateAudioContext();
			if (ctx) {
				refs.audioBufferRef.current = createSynthesizedAmbientBuffer(ctx);
			}
		}
	};

	void loadAudio();

	return () => {
		isMounted = false;
		controller.abort();
		if (refs.stopTimerRef.current) clearTimeout(refs.stopTimerRef.current);
		if (refs.fadeOutTimerRef.current) clearTimeout(refs.fadeOutTimerRef.current);

		safeStopAndDisconnectSource(refs.sourceNodeRef.current);
		refs.sourceNodeRef.current = null;

		safeDisconnect(refs.gainNodeRef.current);
		refs.gainNodeRef.current = null;

		safeDisconnect(refs.lowPassFilterNodeRef.current);
		refs.lowPassFilterNodeRef.current = null;

		safeDisconnect(refs.compressorNodeRef.current);
		refs.compressorNodeRef.current = null;

		if (refs.audioCtxRef.current && refs.audioCtxRef.current.state !== 'closed') {
			void refs.audioCtxRef.current.close();
			refs.audioCtxRef.current = null;
		}
		refs.audioBufferRef.current = null;
		refs.isPlayingRef.current = false;
		setIsPlayingState(false);
	};
}
