import { useEffect, useId, useRef } from 'react';

import { eligibleNativeTarget } from '@/services/nativeGestureEligibility';
import {
	configureNativeSwipe,
	hasNativeReaderGestures,
	onNativeReaderGesture,
	registerNativeGestureHitTest,
} from '@/services/nativeReaderGestures';

export interface SwipeGestureOptions {
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
	onDragStart?: () => void;
	onDragMove?: (offset: number) => void;
	onDragEnd?: (settled: 'left' | 'right' | 'cancel') => void;
	threshold?: number;
	minVelocity?: number;
	maxDuration?: number;
	edgeIgnoreWidth?: number;
	disabled?: boolean;
}

interface TouchState {
	startX: number;
	startY: number;
	startTime: number;
	isDragging: boolean;
	lockDirection: 'none' | 'horizontal' | 'vertical';
}

export function useSwipeGesture({
	onSwipeLeft,
	onSwipeRight,
	onDragStart,
	onDragMove,
	onDragEnd,
	threshold,
	minVelocity = 0.35,
	maxDuration,
	edgeIgnoreWidth = 28,
	disabled = false,
}: SwipeGestureOptions) {
	const owner = useId();
	const touchStateRef = useRef<TouchState | null>(null);
	const callbacksRef = useRef({
		onSwipeLeft,
		onSwipeRight,
		onDragStart,
		onDragMove,
		onDragEnd,
	});

	// Keep callbacks current without reattaching listeners
	useEffect(() => {
		callbacksRef.current = {
			onSwipeLeft,
			onSwipeRight,
			onDragStart,
			onDragMove,
			onDragEnd,
		};
	});

	useEffect(() => {
		if (typeof window === 'undefined' || disabled) return;
		if (hasNativeReaderGestures()) {
			return bindNativeSwipeGesture(owner, callbacksRef, threshold, minVelocity, maxDuration, edgeIgnoreWidth);
		}

		const handleTouchStart = (e: TouchEvent) => {
			if (!e.touches || e.touches.length !== 1) {
				touchStateRef.current = null;
				return;
			}

			const touch = e.touches[0];
			if (isSwipeTargetIgnored(e.target as Element | null, touch.clientX, edgeIgnoreWidth)) {
				touchStateRef.current = null;
				return;
			}

			touchStateRef.current = {
				startX: touch.clientX,
				startY: touch.clientY,
				startTime: Date.now(),
				isDragging: false,
				lockDirection: 'none',
			};
		};

		const handleTouchMove = (e: TouchEvent) => {
			const state = touchStateRef.current;
			const touch = e.touches?.[0];
			if (!state || !touch) return;

			const deltaX = touch.clientX - state.startX;
			const deltaY = touch.clientY - state.startY;

			if (updateTouchLock(state, deltaX, deltaY)) return;

			trackDragMove(state, deltaX, callbacksRef.current.onDragStart, callbacksRef.current.onDragMove);
		};

		const handleTouchEnd = (e: TouchEvent) => {
			const state = touchStateRef.current;
			if (!state) return;
			touchStateRef.current = null;

			if (state.lockDirection === 'vertical') return;

			const touch = e.changedTouches?.[0];
			if (shouldCancelSwipe(state, touch, maxDuration)) {
				cancelDragging(state.isDragging, callbacksRef.current.onDragEnd);
				return;
			}

			const validTouch = touch as Touch;
			const deltaX = validTouch.clientX - state.startX;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(validTouch.clientY - state.startY);
			const duration = Date.now() - state.startTime;

			if (isSwipeGestureCommit(absX, absY, duration, threshold, minVelocity)) {
				if (dispatchSwipeCommit(deltaX, state.isDragging, callbacksRef.current)) {
					return;
				}
			}

			cancelDragging(state.isDragging, callbacksRef.current.onDragEnd);
		};

		const handleTouchCancel = () => {
			const state = touchStateRef.current;
			if (!state) return;
			touchStateRef.current = null;
			if (state.isDragging) {
				callbacksRef.current.onDragEnd?.('cancel');
			}
		};

		window.addEventListener('touchstart', handleTouchStart, { passive: true });
		window.addEventListener('touchmove', handleTouchMove, { passive: true });
		window.addEventListener('touchend', handleTouchEnd, { passive: true });
		window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

		return () => {
			window.removeEventListener('touchstart', handleTouchStart);
			window.removeEventListener('touchmove', handleTouchMove);
			window.removeEventListener('touchend', handleTouchEnd);
			window.removeEventListener('touchcancel', handleTouchCancel);
		};
	}, [threshold, minVelocity, maxDuration, edgeIgnoreWidth, disabled, owner]);
}

function bindNativeSwipeGesture(
	owner: string,
	callbacksRef: {
		current: {
			onSwipeLeft?: () => void;
			onSwipeRight?: () => void;
			onDragStart?: () => void;
			onDragMove?: (offset: number) => void;
			onDragEnd?: (settled: 'left' | 'right' | 'cancel') => void;
		};
	},
	threshold: number | undefined,
	minVelocity: number,
	maxDuration: number | undefined,
	edgeIgnoreWidth: number
): () => void {
	let dragging = false;
	const removeHitTest = registerNativeGestureHitTest('swipe', owner, (x, y) => Boolean(eligibleNativeTarget(x, y)));
	const unsubscribe = onNativeReaderGesture((gesture) => {
		if (gesture.kind === 'swipe-move') {
			if (!dragging) callbacksRef.current.onDragStart?.();
			dragging = true;
			callbacksRef.current.onDragMove?.(gesture.offset);
			return;
		}
		if (gesture.kind !== 'swipe-end') return;
		dragging = false;
		dispatchSwipeEnd(callbacksRef.current, gesture.settled);
	});
	const effectiveThreshold = threshold ?? Math.max(120, Math.round(window.innerWidth * 0.35));
	configureNativeSwipe({ enabled: true, owner, threshold: effectiveThreshold, minVelocity, maxDuration, edgeIgnoreWidth });
	return () => {
		unsubscribe();
		removeHitTest();
		configureNativeSwipe({ enabled: false, owner, threshold: effectiveThreshold, minVelocity, edgeIgnoreWidth });
		if (dragging) callbacksRef.current.onDragEnd?.('cancel');
	};
}

function dispatchSwipeEnd(
	callbacks: {
		onDragEnd?: (settled: 'left' | 'right' | 'cancel') => void;
		onSwipeLeft?: () => void;
		onSwipeRight?: () => void;
	},
	settled: 'left' | 'right' | 'cancel'
): void {
	callbacks.onDragEnd?.(settled);
	if (settled === 'left') {
		callbacks.onSwipeLeft?.();
	} else if (settled === 'right') {
		callbacks.onSwipeRight?.();
	}
}

function updateTouchLock(state: TouchState, deltaX: number, deltaY: number): boolean {
	if (state.lockDirection === 'vertical') return true;
	if (state.lockDirection === 'none') {
		const direction = resolveTouchLockDirection(Math.abs(deltaX), Math.abs(deltaY));
		if (direction === 'none' || direction === 'vertical') {
			if (direction === 'vertical') state.lockDirection = 'vertical';
			return true;
		}
		state.lockDirection = direction;
	}
	return false;
}

function trackDragMove(state: TouchState, deltaX: number, onDragStart?: () => void, onDragMove?: (offset: number) => void): void {
	if (!state.isDragging) {
		state.isDragging = true;
		onDragStart?.();
	}
	onDragMove?.(deltaX);
}

function cancelDragging(isDragging: boolean, onDragEnd?: (settled: 'cancel') => void): void {
	if (isDragging) {
		onDragEnd?.('cancel');
	}
}

function shouldCancelSwipe(state: TouchState, touch: Touch | undefined, maxDuration: number | undefined): boolean {
	if (!touch) return true;
	const duration = Date.now() - state.startTime;
	if (maxDuration !== undefined && duration > maxDuration) return true;
	return hasActiveTextSelection();
}

function dispatchSwipeCommit(
	deltaX: number,
	isDragging: boolean,
	callbacks: {
		onDragEnd?: (settled: 'left' | 'right' | 'cancel') => void;
		onSwipeLeft?: () => void;
		onSwipeRight?: () => void;
	}
): boolean {
	if (deltaX < 0 && callbacks.onSwipeLeft) {
		if (isDragging) callbacks.onDragEnd?.('left');
		callbacks.onSwipeLeft();
		return true;
	}
	if (deltaX > 0 && callbacks.onSwipeRight) {
		if (isDragging) callbacks.onDragEnd?.('right');
		callbacks.onSwipeRight();
		return true;
	}
	return false;
}

function isSwipeTargetIgnored(target: Element | null, clientX: number, edgeIgnoreWidth: number): boolean {
	if (target?.closest?.('[role="dialog"], [aria-modal="true"], .fixed.inset-0')) return true;
	if (typeof document !== 'undefined' && document.body.style.overflow === 'hidden') return true;
	return clientX < edgeIgnoreWidth || clientX > window.innerWidth - edgeIgnoreWidth;
}

function resolveTouchLockDirection(absX: number, absY: number): 'none' | 'horizontal' | 'vertical' {
	if (absX < 10 && absY < 10) return 'none';
	if (absY > absX * 1.2) return 'vertical';
	return 'horizontal';
}

function hasActiveTextSelection(): boolean {
	const selection = window.getSelection();
	return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function isSwipeGestureCommit(absX: number, absY: number, duration: number, threshold?: number, minVelocity = 0.35): boolean {
	if (absX <= absY * 1.3) return false;
	const defaultThreshold = typeof window === 'undefined' ? 120 : Math.max(120, Math.round(window.innerWidth * 0.35));
	const effectiveThreshold = threshold ?? defaultThreshold;
	const hasDistance = absX >= effectiveThreshold;
	const velocity = duration > 0 ? absX / duration : 0;
	const minFlingDistance = Math.min(effectiveThreshold * 0.5, 30);
	const hasVelocity = velocity >= minVelocity && absX >= minFlingDistance;
	return hasDistance || hasVelocity;
}
