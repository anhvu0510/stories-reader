import { useEffect, useRef, type RefObject } from 'react';
import { useModalStore } from '@/stores/useModalStore';

export interface CupertinoSwipeBackOptions {
	/** Callback kích hoạt hành động quay về trang trước */
	onBack: () => void;
	/** Ref của container DOM phần tử để kéo trượt trực quan 1:1 theo ngón tay */
	containerRef?: RefObject<HTMLElement | null>;
	/** Callback tiến trình kéo theo ngón tay (pixel offset) */
	onSwipeProgress?: (offset: number) => void;
	/** Callback khi người dùng buông tay trước ngưỡng và trang snap back về vị trí cũ */
	onSwipeCancel?: () => void;
	/** Độ rộng vùng mép trái màn hình cho phép nhận cử chỉ (mặc định 28px) */
	edgeWidth?: number;
	/** Ngưỡng khoảng cách kéo để xác nhận quay về (mặc định 30% chiều rộng màn hình hoặc 90px) */
	threshold?: number;
	/** Vận tốc vuốt tối thiểu để kích hoạt chuyển trang (px/ms) */
	minVelocity?: number;
	/** Vô hiệu hóa cử chỉ */
	disabled?: boolean;
}

interface TouchState {
	startX: number;
	startY: number;
	startTime: number;
	isDragging: boolean;
	lockDirection: 'none' | 'horizontal' | 'vertical';
}

/**
 * Kiểm tra xem có bất kỳ Modal, Dialog hay Bottom Sheet nào đang mở hay không.
 * Nếu có, mọi cử chỉ vuốt mép màn hình phải nhường quyền cho các tác vụ đóng modal.
 */
const isModalOrSheetActive = (): boolean => {
	try {
		const state = useModalStore.getState();
		if (state && (state.isSettingsOpen || state.isOfflineManagerOpen)) {
			return true;
		}
	} catch {}

	if (typeof document === 'undefined') return false;
	if (document.body.classList.contains('overflow-hidden') || document.body.style.overflow === 'hidden') {
		return true;
	}

	return Boolean(
		document.querySelector('[role="dialog"], [aria-modal="true"], [data-sheet-open="true"], [data-state="open"], .bottom-sheet')
	);
};

/**
 * Hook cung cấp cử chỉ vuốt từ mép trái màn hình (iOS Cupertino Edge-Swipe Back)
 * Giúp người dùng lùi trang mượt mà bằng cử chỉ vuốt 1:1 theo ngón tay.
 */
export function useCupertinoSwipeBack({
	onBack,
	containerRef,
	onSwipeProgress,
	onSwipeCancel,
	edgeWidth = 28,
	threshold,
	minVelocity = 0.4,
	disabled = false
}: CupertinoSwipeBackOptions) {
	const touchStateRef = useRef<TouchState | null>(null);
	const callbacksRef = useRef({ onBack, onSwipeProgress, onSwipeCancel });

	useEffect(() => {
		callbacksRef.current = { onBack, onSwipeProgress, onSwipeCancel };
	});

	useEffect(() => {
		if (typeof window === 'undefined' || disabled) return;

		const applyTranslate = (x: number, transition = 'none') => {
			if (!containerRef?.current) return;
			const el = containerRef.current;
			el.style.transition = transition;
			el.style.transform = `translate3d(${x}px, 0, 0)`;
			if (x > 0) {
				el.style.boxShadow = '-12px 0 28px rgba(0, 0, 0, 0.22)';
			}
		};

		const resetTranslate = (animated = true) => {
			if (!containerRef?.current) return;
			const el = containerRef.current;
			if (animated) {
				el.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
				el.style.transform = 'translate3d(0px, 0, 0)';
				setTimeout(() => {
					if (containerRef.current) {
						containerRef.current.style.boxShadow = '';
						containerRef.current.style.transform = '';
						containerRef.current.style.transition = '';
					}
				}, 280);
			} else {
				el.style.transition = '';
				el.style.transform = '';
				el.style.boxShadow = '';
			}
		};

		const handleTouchStart = (e: TouchEvent) => {
			if (!e.touches || e.touches.length !== 1) {
				touchStateRef.current = null;
				return;
			}

			// Không kích hoạt nếu đang có modal hoặc bottom sheet hiển thị
			if (isModalOrSheetActive()) {
				touchStateRef.current = null;
				return;
			}

			const touch = e.touches[0];
			// Chỉ kích hoạt khi ngón tay chạm vào sát mép trái màn hình
			if (touch.clientX > edgeWidth) {
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

			// Khóa hướng di chuyển ở những pixel đầu tiên (slop 10px)
			if (state.lockDirection === 'none') {
				if (absX < 10 && absY < 10) return;

				if (absY > absX * 1.1) {
					state.lockDirection = 'vertical';
					return;
				}

				// Chỉ chấp nhận kéo từ trái sang phải (deltaX > 0)
				if (deltaX > 0 && absX > absY * 1.1) {
					state.lockDirection = 'horizontal';
					state.isDragging = true;
				} else {
					state.lockDirection = 'vertical';
					return;
				}
			}

			if (state.lockDirection === 'horizontal' && state.isDragging && deltaX >= 0) {
				applyTranslate(deltaX);
				callbacksRef.current.onSwipeProgress?.(deltaX);
			}
		};

		const handleTouchEnd = (e: TouchEvent) => {
			const state = touchStateRef.current;
			if (!state) return;
			touchStateRef.current = null;

			if (!state.isDragging || state.lockDirection !== 'horizontal') {
				return;
			}

			if (!e.changedTouches || e.changedTouches.length === 0) {
				resetTranslate(true);
				callbacksRef.current.onSwipeCancel?.();
				return;
			}

			const touch = e.changedTouches[0];
			const deltaX = Math.max(0, touch.clientX - state.startX);
			const duration = Math.max(1, Date.now() - state.startTime);
			const velocity = deltaX / duration;

			const effectiveThreshold =
				threshold !== undefined
					? threshold
					: typeof window !== 'undefined'
						? Math.max(90, Math.round(window.innerWidth * 0.3))
						: 90;

			const hasSufficientDistance = deltaX >= effectiveThreshold;
			const minFlingDistance = Math.max(45, Math.round(effectiveThreshold * 0.5));
			const hasSufficientVelocity = minVelocity !== undefined && velocity >= minVelocity && deltaX >= minFlingDistance;

			if (hasSufficientDistance || hasSufficientVelocity) {
				if (containerRef?.current) {
					const el = containerRef.current;
					el.style.transition = 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)';
					el.style.transform = 'translate3d(100%, 0, 0)';
					setTimeout(() => {
						callbacksRef.current.onBack();
					}, 200);
				} else {
					callbacksRef.current.onBack();
				}
			} else {
				resetTranslate(true);
				callbacksRef.current.onSwipeCancel?.();
			}
		};

		const handleTouchCancel = () => {
			const state = touchStateRef.current;
			if (state) {
				touchStateRef.current = null;
				if (state.isDragging) {
					resetTranslate(true);
					callbacksRef.current.onSwipeCancel?.();
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
			resetTranslate(false);
		};
	}, [containerRef, edgeWidth, threshold, minVelocity, disabled]);
}
