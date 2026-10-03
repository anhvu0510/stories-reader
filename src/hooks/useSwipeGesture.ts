import { useEffect, useRef } from 'react';

export interface SwipeGestureOptions {
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
	threshold?: number;
	maxDuration?: number;
	edgeIgnoreWidth?: number;
	disabled?: boolean;
}

export function useSwipeGesture({
	onSwipeLeft,
	onSwipeRight,
	threshold = 60,
	maxDuration = 800,
	edgeIgnoreWidth = 28,
	disabled = false
}: SwipeGestureOptions) {
	const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined' || disabled) return;

		const handleTouchStart = (e: TouchEvent) => {
			if (!e.touches || e.touches.length !== 1) {
				touchStartRef.current = null;
				return;
			}

			// Do not trigger swipe gestures if touching inside an open dialog, modal, or bottom sheet
			const target = e.target as Element | null;
			if (target && typeof target.closest === 'function' && target.closest('[role="dialog"], [aria-modal="true"], .fixed.inset-0')) {
				touchStartRef.current = null;
				return;
			}

			// Do not trigger swipe gestures if body scroll is locked by any open modal
			if (typeof document !== 'undefined' && document.body.style.overflow === 'hidden') {
				touchStartRef.current = null;
				return;
			}

			const touch = e.touches[0];
			// Ignore touches starting near screen edges to preserve native OS back gestures
			if (
				touch.clientX < edgeIgnoreWidth ||
				touch.clientX > window.innerWidth - edgeIgnoreWidth
			) {
				touchStartRef.current = null;
				return;
			}

			touchStartRef.current = {
				x: touch.clientX,
				y: touch.clientY,
				time: Date.now()
			};
		};

		const handleTouchEnd = (e: TouchEvent) => {
			if (!touchStartRef.current) return;
			if (!e.changedTouches || e.changedTouches.length === 0) {
				touchStartRef.current = null;
				return;
			}

			const touch = e.changedTouches[0];
			const deltaX = touch.clientX - touchStartRef.current.x;
			const deltaY = touch.clientY - touchStartRef.current.y;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);
			const duration = Date.now() - touchStartRef.current.time;

			touchStartRef.current = null;

			// Ignore touches that lasted longer than maxDuration (e.g. held touches, slow scrolls, long presses)
			if (duration > maxDuration) {
				return;
			}

			// Do not trigger swipe if user has active text selection
			const selection = window.getSelection();
			if (selection && !selection.isCollapsed && selection.toString().trim()) {
				return;
			}

			// Horizontal swipe must be dominant and exceed threshold
			if (absX >= threshold && absX > absY * 1.3) {
				if (deltaX < 0 && onSwipeLeft) {
					onSwipeLeft();
				} else if (deltaX > 0 && onSwipeRight) {
					onSwipeRight();
				}
			}
		};

		window.addEventListener('touchstart', handleTouchStart, { passive: true });
		window.addEventListener('touchend', handleTouchEnd, { passive: true });

		return () => {
			window.removeEventListener('touchstart', handleTouchStart);
			window.removeEventListener('touchend', handleTouchEnd);
		};
	}, [onSwipeLeft, onSwipeRight, threshold, maxDuration, edgeIgnoreWidth, disabled]);
}
