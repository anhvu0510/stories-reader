import { Capacitor } from '@capacitor/core';
import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { useModalStore } from '@/stores/useModalStore';

import {
	applyPullResistance,
	evaluateInitialPullMove,
	getSingleTouchIfEligible,
	isPullMoveInactive,
	reloadBrowserPage,
} from './pull-to-refresh/pullToRefreshHelpers';
import { isBrowserFullscreen } from './useFullscreen';
import { triggerHaptic } from './useHaptic';
import { useNativePullToRefresh } from './useNativePullToRefresh';

export const isAndroidApp = (): boolean => {
	if (typeof window === 'undefined') return false;
	try {
		return Capacitor.getPlatform() === 'android';
	} catch {
		return false;
	}
};

/**
 * Kiểm tra xem có bất kỳ Modal, Dialog hay Bottom Sheet nào đang mở hay không.
 * Nếu có, mọi cử chỉ vuốt xuống phải được ưu tiên hoàn toàn cho tác vụ đóng modal (Swipe-down-to-dismiss).
 */
const isModalOrSheetActive = (): boolean => {
	try {
		const { isSettingsOpen, isOfflineManagerOpen } = useModalStore.getState();
		if (isSettingsOpen || isOfflineManagerOpen) return true;
	} catch {
		// intentionally empty — useModalStore may not be available during SSR
	}

	if (typeof document === 'undefined') return false;
	if (
		document.body.classList.contains('overflow-hidden') ||
		document.body.style.overflow === 'hidden' ||
		document.body.hasAttribute('data-modal-open') ||
		document.body.hasAttribute('data-sheet-open')
	) {
		return true;
	}

	return Boolean(
		document.querySelector(
			'[role="dialog"], [aria-modal="true"], [data-sheet-open="true"], [data-modal-open="true"], [data-state="open"], .bottom-sheet'
		)
	);
};

export interface UsePullToRefreshOptions {
	onRefresh: () => Promise<void> | void;
	enabled?: boolean;
	disabled?: boolean;
	threshold?: number;
	maxPull?: number;
	minDisplayTime?: number;
	containerRef?: RefObject<HTMLElement | null>;
	targetRef?: RefObject<HTMLElement | null>;
}

export interface UsePullToRefreshReturn {
	pullDistance: number;
	isRefreshing: boolean;
	isPulling: boolean;
	hasTriggeredThreshold: boolean;
	progress: number;
	reset: () => void;
}

export function usePullToRefresh({
	onRefresh,
	enabled,
	disabled = false,
	threshold = 65,
	maxPull = 105,
	minDisplayTime = 380,
	containerRef,
	targetRef,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
	const native = useNativePullToRefresh({ onRefresh, enabled, disabled, threshold, containerRef, targetRef });
	const nativeGestures = hasNativeReaderGestures();
	const [isFullscreen, setIsFullscreen] = useState(isBrowserFullscreen);
	useFullscreenTracking(setIsFullscreen);

	const isSupported = !nativeGestures && resolveSupportedFlag(enabled, disabled, isFullscreen);
	const [pullDistance, setPullDistance] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isPulling, setIsPulling] = useState(false);
	const [hasTriggeredThreshold, setHasTriggeredThreshold] = useState(false);

	const isRefreshingRef = useRef(false);
	isRefreshingRef.current = isRefreshing;

	const pullDistanceRef = useRef(0);
	pullDistanceRef.current = pullDistance;

	const touchStartYRef = useRef(0);
	const touchStartXRef = useRef(0);
	const canPullRef = useRef(false);
	const isPullingRef = useRef(false);
	const hasTriggeredHapticRef = useRef(false);

	const reset = useCallback(() => {
		setIsPulling(false);
		setIsRefreshing(false);
		setPullDistance(0);
		setHasTriggeredThreshold(false);
		canPullRef.current = false;
		isPullingRef.current = false;
		hasTriggeredHapticRef.current = false;
	}, []);

	useEffect(() => {
		if (!isSupported || typeof window === 'undefined') return;

		const target = targetRef?.current || containerRef?.current || window;

		const handleTouchStart = (e: TouchEvent) => {
			if (!isSupported || isRefreshingRef.current) return;
			const touch = getSingleTouchIfEligible(e, getContainerScrollTop(containerRef), isModalOrSheetActive());
			if (!touch) {
				canPullRef.current = false;
				return;
			}

			touchStartYRef.current = touch.clientY;
			touchStartXRef.current = touch.clientX;
			canPullRef.current = true;
			isPullingRef.current = false;
			hasTriggeredHapticRef.current = false;
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (isPullMoveInactive(canPullRef.current, isRefreshingRef.current, isSupported)) return;
			const touch = e.touches?.[0];
			if (!touch) return;

			// Nếu có modal hoặc dialog xuất hiện giữa chừng, lập tức dừng và reset
			if (handleModalInterruption(isPullingRef.current, reset)) {
				canPullRef.current = false;
				return;
			}

			const deltaY = touch.clientY - touchStartYRef.current;
			const deltaX = Math.abs(touch.clientX - touchStartXRef.current);

			if (!isPullingRef.current) {
				const pullStep = evaluateInitialPullMove(deltaX, deltaY);
				if (pullStep === 'cancel') {
					canPullRef.current = false;
					return;
				}
				if (pullStep === 'start') {
					isPullingRef.current = true;
					setIsPulling(true);
				}
			}

			if (isPullingRef.current && deltaY > 0) {
				applyPullResistance(
					e,
					deltaY,
					maxPull,
					threshold,
					pullDistanceRef,
					setPullDistance,
					hasTriggeredHapticRef,
					setHasTriggeredThreshold
				);
			}
		};

		const handleTouchEnd = async () => {
			if (!isPullingRef.current && !canPullRef.current) return;

			const wasOverThreshold = pullDistanceRef.current >= threshold;
			canPullRef.current = false;
			isPullingRef.current = false;
			setIsPulling(false);

			await completePullCycle(
				wasOverThreshold,
				isRefreshingRef.current,
				threshold,
				minDisplayTime,
				onRefresh,
				setIsRefreshing,
				setPullDistance,
				setHasTriggeredThreshold,
				hasTriggeredHapticRef
			);
		};

		const options: AddEventListenerOptions = { passive: false };
		return attachPullTouchListeners(target, handleTouchStart, handleTouchMove, handleTouchEnd, options);
	}, [isSupported, onRefresh, threshold, maxPull, minDisplayTime, containerRef, targetRef, reset]);

	const progress = Math.min(1, pullDistance / threshold);

	if (nativeGestures) return native;
	return {
		pullDistance,
		isRefreshing,
		isPulling,
		hasTriggeredThreshold,
		progress,
		reset,
	};
}

function useFullscreenTracking(setIsFullscreen: (val: boolean) => void): void {
	useEffect(() => {
		if (typeof document === 'undefined') return;
		const handler = () => {
			setIsFullscreen(isBrowserFullscreen());
		};
		document.addEventListener('fullscreenchange', handler);
		document.addEventListener('webkitfullscreenchange', handler);
		document.addEventListener('mozfullscreenchange', handler);
		document.addEventListener('MSFullscreenChange', handler);
		return () => {
			document.removeEventListener('fullscreenchange', handler);
			document.removeEventListener('webkitfullscreenchange', handler);
			document.removeEventListener('mozfullscreenchange', handler);
			document.removeEventListener('MSFullscreenChange', handler);
		};
	}, [setIsFullscreen]);
}

function resolveSupportedFlag(enabled: boolean | undefined, disabled: boolean, isFullscreen: boolean): boolean {
	if (enabled !== undefined) return enabled;
	if (disabled) return false;
	return isAndroidApp() || isFullscreen;
}

function getContainerScrollTop(containerRef?: RefObject<HTMLElement | null>): number {
	if (containerRef?.current) {
		return containerRef.current.scrollTop;
	}
	return window.scrollY || document.documentElement?.scrollTop || 0;
}

async function completePullCycle(
	wasOverThreshold: boolean,
	isCurrentlyRefreshing: boolean,
	threshold: number,
	minDisplayTime: number,
	onRefresh: () => Promise<void> | void,
	setIsRefreshing: (val: boolean) => void,
	setPullDistance: (val: number) => void,
	setHasTriggeredThreshold: (val: boolean) => void,
	hasTriggeredHapticRef: { current: boolean }
): Promise<void> {
	if (!wasOverThreshold || isCurrentlyRefreshing) {
		setPullDistance(0);
		setHasTriggeredThreshold(false);
		hasTriggeredHapticRef.current = false;
		return;
	}

	setIsRefreshing(true);
	setPullDistance(Math.min(threshold, 56));
	triggerHaptic('medium');

	if (!isAndroidApp()) {
		// Trình duyệt Web: Thực hiện reload lại toàn bộ trang web (F5 reload)
		try {
			await Promise.resolve(onRefresh());
		} catch {
			// ignore
		}
		if (minDisplayTime > 0) {
			await new Promise((r) => setTimeout(r, minDisplayTime));
		}
		reloadBrowserPage();
		setIsRefreshing(false);
		setPullDistance(0);
		setHasTriggeredThreshold(false);
		hasTriggeredHapticRef.current = false;
		return;
	}

	// Mobile Native App (Android): giữ nguyên gọi onRefresh in-app mà không reload webview
	const startTime = Date.now();
	try {
		await Promise.resolve(onRefresh());
	} catch (err) {
		console.error('[usePullToRefresh] onRefresh error:', err);
	} finally {
		const elapsed = Date.now() - startTime;
		if (minDisplayTime > 0 && elapsed < minDisplayTime) {
			await new Promise((r) => setTimeout(r, minDisplayTime - elapsed));
		}
		setIsRefreshing(false);
		setPullDistance(0);
		setHasTriggeredThreshold(false);
		hasTriggeredHapticRef.current = false;
	}
}

function handleModalInterruption(isPulling: boolean, reset: () => void): boolean {
	if (!isModalOrSheetActive()) return false;
	if (isPulling) reset();
	return true;
}

function attachPullTouchListeners(
	target: HTMLElement | Window,
	onStart: (e: TouchEvent) => void,
	onMove: (e: TouchEvent) => void,
	onEnd: () => Promise<void>,
	options: AddEventListenerOptions
): () => void {
	target.addEventListener('touchstart', onStart as EventListener, options);
	target.addEventListener('touchmove', onMove as EventListener, options);
	target.addEventListener('touchend', onEnd as EventListener, options);
	target.addEventListener('touchcancel', onEnd as EventListener, options);

	return () => {
		target.removeEventListener('touchstart', onStart as EventListener);
		target.removeEventListener('touchmove', onMove as EventListener);
		target.removeEventListener('touchend', onEnd as EventListener);
		target.removeEventListener('touchcancel', onEnd as EventListener);
	};
}
