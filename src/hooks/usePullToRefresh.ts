import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';

import { useModalStore } from '@/stores/useModalStore';
import { triggerHaptic } from './useHaptic';

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
	} catch {}

	if (typeof document === 'undefined') return false;
	if (document.body.classList.contains('overflow-hidden') || document.body.style.overflow === 'hidden') {
		return true;
	}

	return Boolean(
		document.querySelector('[role="dialog"], [aria-modal="true"], [data-sheet-open="true"], [data-state="open"], .bottom-sheet')
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
	targetRef
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
	const isSupported = enabled !== undefined ? enabled : disabled ? false : isAndroidApp();
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
			if (!e.touches || e.touches.length !== 1) return;

			// Ưu tiên tuyệt đối cho modal/sheet: Không kích hoạt pull-to-refresh nếu có bất kỳ modal/sheet nào đang mở
			if (isModalOrSheetActive()) {
				canPullRef.current = false;
				return;
			}

			// Do not trigger if touch originated inside a modal, dialog, bottom sheet, or popover
			const targetEl = e.target as HTMLElement | null;
			if (targetEl && targetEl.closest && targetEl.closest('[role="dialog"], [aria-modal="true"], .bottom-sheet, [data-modal], [data-sheet], [data-dialog]')) {
				canPullRef.current = false;
				return;
			}

			// Do not trigger if target is inside an inner scrollable element with scrollTop > 0
			let currentParent = targetEl;
			while (currentParent && currentParent !== document.body && currentParent !== document.documentElement) {
				if (currentParent.scrollTop > 1) {
					canPullRef.current = false;
					return;
				}
				currentParent = currentParent.parentElement;
			}

			const scrollTop = getScrollTop();
			if (scrollTop > 0) {
				canPullRef.current = false;
				return;
			}

			touchStartYRef.current = e.touches[0].clientY;
			touchStartXRef.current = e.touches[0].clientX;

			// Preserve Android native edge-swipe back navigation (edge touches < 28px or > innerWidth - 28px)
			if (touchStartXRef.current < 28 || (typeof window !== 'undefined' && touchStartXRef.current > window.innerWidth - 28)) {
				canPullRef.current = false;
				return;
			}

			canPullRef.current = true;
			isPullingRef.current = false;
			hasTriggeredHapticRef.current = false;
		};


		const handleTouchMove = (e: TouchEvent) => {
			if (!canPullRef.current || isRefreshingRef.current || !isSupported) return;
			if (!e.touches || e.touches.length === 0) return;

			// Nếu có modal hoặc dialog xuất hiện giữa chừng, lập tức dừng và reset
			if (isModalOrSheetActive()) {
				canPullRef.current = false;
				if (isPullingRef.current) {
					reset();
				}
				return;
			}

			const currentY = e.touches[0].clientY;
			const currentX = e.touches[0].clientX;
			const deltaY = currentY - touchStartYRef.current;
			const deltaX = Math.abs(currentX - touchStartXRef.current);

			if (!isPullingRef.current) {
				// Nếu vuốt ngang hoặc không phải hướng vuốt xuống dọc dứt khoát -> hủy pull
				if (deltaX >= deltaY && deltaX > 8) {
					canPullRef.current = false;
					return;
				}
				if (deltaY <= 0) {
					canPullRef.current = false;
					return;
				}
				// Touch slop chuẩn mobile (14px) và yêu cầu hướng kéo chủ đạo là chiều dọc
				if (deltaY >= 14 && deltaY > deltaX * 1.3) {
					isPullingRef.current = true;
					setIsPulling(true);
				}
			}

			if (isPullingRef.current && deltaY > 0) {
				if (e.cancelable) {
					e.preventDefault();
				}

				// Resistance damping
				const dampedDistance = Math.min(maxPull, Math.pow(deltaY, 0.82) * 1.45);
				pullDistanceRef.current = dampedDistance;
				setPullDistance(dampedDistance);

				if (dampedDistance >= threshold) {
					if (!hasTriggeredHapticRef.current) {
						hasTriggeredHapticRef.current = true;
						setHasTriggeredThreshold(true);
						triggerHaptic('light');
					}
				} else {
					if (hasTriggeredHapticRef.current) {
						hasTriggeredHapticRef.current = false;
						setHasTriggeredThreshold(false);
					}
				}
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
	}, [isSupported, onRefresh, threshold, maxPull, minDisplayTime, containerRef, targetRef]);

	const progress = Math.min(1, pullDistance / threshold);

	return {
		pullDistance,
		isRefreshing,
		isPulling,
		hasTriggeredThreshold,
		progress,
		reset
	};
}
