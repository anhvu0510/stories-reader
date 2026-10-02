import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

import { triggerHaptic } from './useHaptic';

export interface UsePullToRefreshOptions {
	onRefresh: () => Promise<void> | void;
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
	disabled = false,
	threshold = 65,
	maxPull = 105,
	minDisplayTime = 380,
	containerRef,
	targetRef
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
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
		if (disabled || typeof window === 'undefined') return;

		const target = targetRef?.current || containerRef?.current || window;

		const getScrollTop = (): number => {
			if (containerRef?.current) {
				return containerRef.current.scrollTop;
			}
			return window.scrollY || document.documentElement?.scrollTop || 0;
		};

		const handleTouchStart = (e: TouchEvent) => {
			if (disabled || isRefreshingRef.current) return;
			if (!e.touches || e.touches.length !== 1) return;

			const scrollTop = getScrollTop();
			if (scrollTop > 1) {
				canPullRef.current = false;
				return;
			}

			touchStartYRef.current = e.touches[0].clientY;
			touchStartXRef.current = e.touches[0].clientX;
			canPullRef.current = true;
			isPullingRef.current = false;
			hasTriggeredHapticRef.current = false;
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!canPullRef.current || isRefreshingRef.current || disabled) return;
			if (!e.touches || e.touches.length === 0) return;

			const currentY = e.touches[0].clientY;
			const currentX = e.touches[0].clientX;
			const deltaY = currentY - touchStartYRef.current;
			const deltaX = Math.abs(currentX - touchStartXRef.current);

			if (!isPullingRef.current) {
				if (deltaX > Math.abs(deltaY) && deltaX > 8) {
					canPullRef.current = false;
					return;
				}
				if (deltaY <= 0) {
					canPullRef.current = false;
					return;
				}
				if (deltaY > 6) {
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
	}, [disabled, onRefresh, threshold, maxPull, minDisplayTime, containerRef, targetRef]);

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
