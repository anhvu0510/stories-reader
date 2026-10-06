import { useEffect, useId, useRef } from 'react';
import { configureNativeSwipe, hasNativeReaderGestures, onNativeReaderGesture, registerNativeGestureHitTest } from '@/services/nativeReaderGestures';
import { eligibleNativeTarget } from '@/services/nativeGestureEligibility';

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
	disabled = false
}: SwipeGestureOptions) {
	const owner = useId();
	const touchStateRef = useRef<TouchState | null>(null);
	const callbacksRef = useRef({
		onSwipeLeft,
		onSwipeRight,
		onDragStart,
		onDragMove,
		onDragEnd
	});

	// Keep callbacks current without reattaching listeners
	useEffect(() => {
		callbacksRef.current = {
			onSwipeLeft,
			onSwipeRight,
			onDragStart,
			onDragMove,
			onDragEnd
		};
	});

	useEffect(() => {
		if (typeof window === 'undefined' || disabled) return;
		if (hasNativeReaderGestures()) {
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
				callbacksRef.current.onDragEnd?.(gesture.settled);
				if (gesture.settled === 'left') callbacksRef.current.onSwipeLeft?.();
				if (gesture.settled === 'right') callbacksRef.current.onSwipeRight?.();
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

		const handleTouchStart = (e: TouchEvent) => {
			if (!e.touches || e.touches.length !== 1) {
				touchStateRef.current = null;
				return;
			}

			// Do not trigger swipe gestures if touching inside an open dialog, modal, or bottom sheet
			const target = e.target as Element | null;
			if (target && typeof target.closest === 'function' && target.closest('[role="dialog"], [aria-modal="true"], .fixed.inset-0')) {
				touchStateRef.current = null;
				return;
			}

			// Do not trigger swipe gestures if body scroll is locked by any open modal
			if (typeof document !== 'undefined' && document.body.style.overflow === 'hidden') {
				touchStateRef.current = null;
				return;
			}

			const touch = e.touches[0];
			// Ignore touches starting near screen edges to preserve native OS back gestures
			if (
				touch.clientX < edgeIgnoreWidth ||
				touch.clientX > window.innerWidth - edgeIgnoreWidth
			) {
				touchStateRef.current = null;
				return;
			}

			touchStateRef.current = {
				startX: touch.clientX,
				startY: touch.clientY,
				startTime: Date.now(),
				isDragging: false,
				lockDirection: 'none'
			};
		};

		const handleTouchMove = (e: TouchEvent) => {
			const state = touchStateRef.current;
			if (!state || !e.touches || e.touches.length === 0) return;

			const touch = e.touches[0];
			const deltaX = touch.clientX - state.startX;
			const deltaY = touch.clientY - state.startY;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);

			// If locked to vertical scrolling, ignore horizontal drag
			if (state.lockDirection === 'vertical') {
				return;
			}

			// Determine direction lock once touch has moved beyond touch slop (10px)
			// Yêu cầu vertical chiếm ưu thế rõ ràng (absY > absX * 1.2) mới lock vertical
			// Tránh false-positive horizontal lock khi scroll dọc hơi lệch ngang
			if (state.lockDirection === 'none') {
				if (absX >= 10 || absY >= 10) {
					if (absY > absX * 1.2) {
						state.lockDirection = 'vertical';
						return;
					}
					state.lockDirection = 'horizontal';
				} else {
					return;
				}
			}

			// Real-time horizontal drag tracking
			if (state.lockDirection === 'horizontal') {
				if (!state.isDragging) {
					state.isDragging = true;
					callbacksRef.current.onDragStart?.();
				}
				callbacksRef.current.onDragMove?.(deltaX);
			}
		};

		const handleTouchEnd = (e: TouchEvent) => {
			const state = touchStateRef.current;
			if (!state) return;
			touchStateRef.current = null;

			// If touch was locked vertically, do not handle swipe
			if (state.lockDirection === 'vertical') {
				return;
			}

			if (!e.changedTouches || e.changedTouches.length === 0) {
				if (state.isDragging) callbacksRef.current.onDragEnd?.('cancel');
				return;
			}

			const touch = e.changedTouches[0];
			const deltaX = touch.clientX - state.startX;
			const deltaY = touch.clientY - state.startY;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);
			const duration = Date.now() - state.startTime;

			// Ignore touches that lasted longer than maxDuration (only when explicitly configured)
			if (maxDuration !== undefined && duration > maxDuration) {
				if (state.isDragging) callbacksRef.current.onDragEnd?.('cancel');
				return;
			}

			// Do not trigger swipe if user has active text selection
			const selection = window.getSelection();
			if (selection && !selection.isCollapsed && selection.toString().trim()) {
				if (state.isDragging) callbacksRef.current.onDragEnd?.('cancel');
				return;
			}

			const velocity = duration > 0 ? absX / duration : 0;
			// Ngưỡng commit chuẩn mobile: ưu tiên 35% chiều rộng màn hình (tối thiểu 120px) nếu caller không chỉ định cố định
			const effectiveThreshold = threshold !== undefined
				? threshold
				: (typeof window !== 'undefined' ? Math.max(120, Math.round(window.innerWidth * 0.35)) : 120);
			const minFlingDistance = Math.min(effectiveThreshold * 0.5, 30);
			const hasSufficientDistance = absX >= effectiveThreshold;
			const hasSufficientVelocity = minVelocity !== undefined && velocity >= minVelocity && absX >= minFlingDistance;

			// Horizontal swipe must be dominant and meet distance or velocity requirements
			if ((hasSufficientDistance || hasSufficientVelocity) && absX > absY * 1.3) {
				if (deltaX < 0 && callbacksRef.current.onSwipeLeft) {
					if (state.isDragging) callbacksRef.current.onDragEnd?.('left');
					callbacksRef.current.onSwipeLeft();
					return;
				} if (deltaX > 0 && callbacksRef.current.onSwipeRight) {
					if (state.isDragging) callbacksRef.current.onDragEnd?.('right');
					callbacksRef.current.onSwipeRight();
					return;
				}
			}

			if (state.isDragging) {
				callbacksRef.current.onDragEnd?.('cancel');
			}
		};

		const handleTouchCancel = () => {
			const state = touchStateRef.current;
			if (state) {
				touchStateRef.current = null;
				if (state.isDragging) {
					callbacksRef.current.onDragEnd?.('cancel');
				}
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
