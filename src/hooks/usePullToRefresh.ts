import { Capacitor } from '@capacitor/core';
import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';
import { useModalStore } from '@/stores/useModalStore';

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
	const resolveSupported = () => {
		if (enabled !== undefined) return enabled;
		if (disabled) return false;
		return isAndroidApp();
	};
	const isSupported = !nativeGestures && resolveSupported();
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

		const getScrollTop = (): number => {
			if (containerRef?.current) {
				return containerRef.current.scrollTop;
			}
			return window.scrollY || document.documentElement?.scrollTop || 0;
		};

		const handleTouchStart = (e: TouchEvent) => {
			if (!isSupported || isRefreshingRef.current) return;
			const touch = e.touches?.[0];
			if (!touch || e.touches.length !== 1) return;

			const targetEl = e.target as HTMLElement | null;
			if (!canInitiatePull(targetEl, getScrollTop(), touch.clientX)) {
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
				// Nếu vuốt ngang hoặc không phải hướng vuốt xuống dọc dứt khoát -> hủy pull
				if (shouldCancelPullOnMove(deltaX, deltaY)) {
					canPullRef.current = false;
					return;
				}
				// Touch slop chuẩn mobile (14px) và yêu cầu hướng kéo chủ đạo là chiều dọc
				if (shouldStartPulling(deltaX, deltaY)) {
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

			if (wasOverThreshold && !isRefreshingRef.current) {
				setIsRefreshing(true);
				setPullDistance(Math.min(threshold, 56));
				triggerHaptic('medium');

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
			} else {
				setPullDistance(0);
				setHasTriggeredThreshold(false);
				hasTriggeredHapticRef.current = false;
			}
		};

		const options: AddEventListenerOptions = { passive: false };

		target.addEventListener('touchstart', handleTouchStart as EventListener, options);
		target.addEventListener('touchmove', handleTouchMove as EventListener, options);
		target.addEventListener('touchend', handleTouchEnd as EventListener, options);
		target.addEventListener('touchcancel', handleTouchEnd as EventListener, options);

		return () => {
			target.removeEventListener('touchstart', handleTouchStart as EventListener);
			target.removeEventListener('touchmove', handleTouchMove as EventListener);
			target.removeEventListener('touchend', handleTouchEnd as EventListener);
			target.removeEventListener('touchcancel', handleTouchEnd as EventListener);
		};
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

function isPullMoveInactive(canPull: boolean, isRefreshing: boolean, isSupported: boolean): boolean {
	return !canPull || isRefreshing || !isSupported;
}

function handleModalInterruption(isPulling: boolean, reset: () => void): boolean {
	if (!isModalOrSheetActive()) return false;
	if (isPulling) reset();
	return true;
}

function applyPullResistance(
	e: TouchEvent,
	deltaY: number,
	maxPull: number,
	threshold: number,
	pullRef: { current: number },
	setPull: (d: number) => void,
	hapticRef: { current: boolean },
	setThreshold: (b: boolean) => void
): void {
	if (e.cancelable) e.preventDefault();
	const dampedDistance = Math.min(maxPull, Math.pow(deltaY, 0.82) * 1.45);
	pullRef.current = dampedDistance;
	setPull(dampedDistance);
	updateHapticThreshold(dampedDistance, threshold, hapticRef, setThreshold);
}

function isInsideScrollableChild(targetEl: HTMLElement | null): boolean {
	let currentParent = targetEl;
	while (currentParent && currentParent !== document.body && currentParent !== document.documentElement) {
		if (currentParent.scrollTop > 1) return true;
		currentParent = currentParent.parentElement;
	}
	return false;
}

function isTargetInsideModal(targetEl: HTMLElement | null): boolean {
	return Boolean(
		targetEl?.closest?.('[role="dialog"], [aria-modal="true"], .bottom-sheet, [data-modal], [data-sheet], [data-dialog], [data-sheet-open]')
	);
}

function isNearEdge(x: number): boolean {
	return x < 28 || (typeof window !== 'undefined' && x > window.innerWidth - 28);
}

function canInitiatePull(targetEl: HTMLElement | null, scrollTop: number, clientX: number): boolean {
	if (isModalOrSheetActive() || isTargetInsideModal(targetEl)) return false;
	if (isInsideScrollableChild(targetEl) || scrollTop > 0) return false;
	return !isNearEdge(clientX);
}

function shouldCancelPullOnMove(deltaX: number, deltaY: number): boolean {
	if (deltaX >= deltaY && deltaX > 8) return true;
	return deltaY <= 0;
}

function shouldStartPulling(deltaX: number, deltaY: number): boolean {
	return deltaY >= 14 && deltaY > deltaX * 1.3;
}

function updateHapticThreshold(
	dampedDistance: number,
	threshold: number,
	hasTriggeredHapticRef: { current: boolean },
	setHasTriggeredThreshold: (v: boolean) => void
): void {
	if (dampedDistance >= threshold) {
		if (!hasTriggeredHapticRef.current) {
			hasTriggeredHapticRef.current = true;
			setHasTriggeredThreshold(true);
			triggerHaptic('light');
		}
		return;
	}
	if (hasTriggeredHapticRef.current) {
		hasTriggeredHapticRef.current = false;
		setHasTriggeredThreshold(false);
	}
}
