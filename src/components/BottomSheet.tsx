import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { triggerHaptic } from '@/hooks/useHaptic';
import { useNativeSheetGesture } from '@/hooks/useNativeSheetGesture';
import { cn } from '@/lib/utils';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';

export interface BottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
	showDragHandle?: boolean;
	maxHeight?: string;
	zIndex?: string;
	ariaLabel?: string;
	disableDrag?: boolean;
	glassmorphic?: boolean;
	'data-testid'?: string;
}

function resolveDirectionLock(
	currentLock: 'none' | 'vertical' | 'horizontal',
	absX: number,
	absY: number
): 'none' | 'vertical' | 'horizontal' {
	if (currentLock !== 'none') return currentLock;
	if (absX < 12 && absY < 12) return 'none';
	return absX > absY * 1.5 ? 'horizontal' : 'vertical';
}

function resetCardDrag(sheetEl: HTMLDivElement | null) {
	if (!sheetEl) return;
	sheetEl.style.transition = 'none';
	sheetEl.style.transform = '';
}

function applyCardDrag(sheetEl: HTMLDivElement | null, deltaY: number) {
	if (!sheetEl) return;
	sheetEl.style.transition = 'none';
	sheetEl.style.transform = `translate3d(0, ${deltaY}px, 0)`;
}

function canInitiateDrag(scrollEl: HTMLElement | null, absY: number): boolean {
	const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
	return scrollTop <= 0 && absY >= 16;
}

function findScrollableParent(target: HTMLElement | null, boundary: HTMLElement | null): HTMLElement | null {
	let node = target;
	while (node && node !== boundary) {
		if (node.scrollHeight > node.clientHeight + 2) {
			const overflowY = window.getComputedStyle(node).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') {
				return node;
			}
		}
		node = node.parentElement;
	}
	return null;
}

function resolveBottomSheetProps(props: BottomSheetProps) {
	return {
		isOpen: props.isOpen,
		onClose: props.onClose,
		children: props.children,
		className: props.className,
		contentClassName: props.contentClassName,
		showDragHandle: props.showDragHandle ?? true,
		maxHeight: props.maxHeight || 'max-h-[88dvh]',
		zIndex: props.zIndex || 'z-[99000]',
		ariaLabel: props.ariaLabel || 'Modal Sheet',
		disableDrag: Boolean(props.disableDrag),
		glassmorphic: props.glassmorphic ?? true,
		testId: props['data-testid'],
	};
}

export function BottomSheet(props: BottomSheetProps) {
	const {
		isOpen,
		onClose,
		children,
		className,
		contentClassName,
		showDragHandle,
		maxHeight,
		zIndex,
		ariaLabel,
		disableDrag,
		glassmorphic,
		testId,
	} = resolveBottomSheetProps(props);

	useBodyScrollLock(isOpen);

	const sheetCardRef = useRef<HTMLDivElement>(null);
	const nativeGestures = hasNativeReaderGestures();
	useNativeSheetGesture(isOpen, disableDrag, sheetCardRef, onClose);
	const touchStartRef = useRef<{
		startY: number;
		startX: number;
		startTime: number;
		scrollEl: HTMLElement | null;
		canDrag: boolean;
		// Trạng thái direction lock: 'none' = chưa xác định, 'vertical' = drag sheet, 'horizontal' = vuốt ngang (bỏ qua)
		lockDirection: 'none' | 'vertical' | 'horizontal';
	} | null>(null);
	const currentDragYRef = useRef(0);
	const isDismissingRef = useRef(false);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, onClose]);

	// Xử lý cử chỉ vuốt kéo xuống (Swipe-Down-To-Dismiss) mượt mà chuẩn UX native
	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		if (disableDrag || isDismissingRef.current || !e.touches || e.touches.length !== 1) return;
		const touch = e.touches[0];

		// Tìm phần tử cuộn bên trong (nếu có)
		const scrollEl = findScrollableParent(e.target as HTMLElement | null, sheetCardRef.current);

		touchStartRef.current = {
			startY: touch.clientY,
			startX: touch.clientX,
			startTime: Date.now(),
			scrollEl,
			canDrag: false,
			lockDirection: 'none',
		};
		currentDragYRef.current = 0;
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
		const state = touchStartRef.current;
		if (!state || isDismissingRef.current || !e.touches || e.touches.length !== 1) return;
		const touch = e.touches[0];
		const deltaY = touch.clientY - state.startY;
		const deltaX = touch.clientX - state.startX;
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		/*
		 * Giai đoạn 1: Xác định direction lock sau khi ngón tay di chuyển đủ xa (slop 12px)
		 * Giúp phân biệt rõ ràng scroll ngang (chuyển tab) vs kéo xuống đóng sheet
		 */
		state.lockDirection = resolveDirectionLock(state.lockDirection, absX, absY);

		// Nếu đã lock horizontal (vuốt ngang) → bỏ qua hoàn toàn, không kéo sheet
		if (state.lockDirection !== 'vertical') return;

		// Chỉ cho phép kéo xuống (deltaY > 0) để đóng sheet
		if (deltaY <= 0) {
			if (currentDragYRef.current > 0) {
				currentDragYRef.current = 0;
				resetCardDrag(sheetCardRef.current);
			}
			return;
		}

		/*
		 * Chỉ kích hoạt kéo sheet khi danh sách con đang ở vị trí trên cùng (scrollTop <= 0)
		 * Yêu cầu thêm minimum slop 16px để tránh false trigger khi scroll nhanh items
		 */
		if (!canInitiateDrag(state.scrollEl, absY)) return;

		state.canDrag = true;
		if (e.cancelable) {
			e.preventDefault();
		}
		currentDragYRef.current = deltaY;
		applyCardDrag(sheetCardRef.current, deltaY);
	};

	const handleTouchEnd = () => {
		if (!touchStartRef.current) return;
		const deltaY = currentDragYRef.current;
		const elapsed = Math.max(1, Date.now() - touchStartRef.current.startTime);
		const velocity = deltaY / elapsed;
		const wasDragging = touchStartRef.current.canDrag;

		touchStartRef.current = null;
		currentDragYRef.current = 0;

		if (!wasDragging || !sheetCardRef.current) return;

		/*
		 * Ngưỡng xác nhận đóng sheet: kéo xuống > 90px hoặc flick nhanh (deltaY >= 70px kèm velocity > 0.5 px/ms)
		 * Tăng ngưỡng so với trước (70px/0.35) để tránh dismiss không chủ ý khi scroll items từ đỉnh
		 */
		if (deltaY > 90 || (deltaY >= 70 && velocity > 0.5)) {
			isDismissingRef.current = true;
			triggerHaptic('light');
			sheetCardRef.current.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
			sheetCardRef.current.style.transform = 'translate3d(0, 100%, 0)';
			setTimeout(() => {
				isDismissingRef.current = false;
				onClose();
			}, 180);
		} else {
			// Snap back mượt mà về vị trí ban đầu (0px) và dọn dẹp transform
			sheetCardRef.current.style.transition = 'transform 240ms cubic-bezier(0.25, 1, 0.5, 1)';
			sheetCardRef.current.style.transform = 'translate3d(0, 0px, 0)';
			setTimeout(() => {
				if (sheetCardRef.current) {
					sheetCardRef.current.style.transform = '';
					sheetCardRef.current.style.transition = '';
				}
			}, 250);
		}
	};

	const sheetContent = (
		<AnimatePresence>
			{isOpen && (
				<div
					role="dialog"
					aria-modal="true"
					aria-label={ariaLabel}
					data-testid={testId}
					data-sheet-open="true"
					className={cn(
						'fixed inset-0 flex items-end justify-center overscroll-none overflow-x-hidden box-border bottom-sheet',
						zIndex,
						className
					)}
				>
					{/* Backdrop Blur Overlay */}
					<motion.div
						data-testid="bottom-sheet-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25, ease: 'easeOut' }}
						onClick={onClose}
						onTouchMove={(e) => e.preventDefault()}
						className="absolute inset-0 bg-black/15 backdrop-blur-[1.5px]"
					/>

					{/* Bottom Sheet Card Container */}
					<motion.div
						ref={sheetCardRef}
						data-testid="bottom-sheet-container"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.85 }}
						onTouchStart={nativeGestures ? undefined : handleTouchStart}
						onTouchMove={nativeGestures ? undefined : handleTouchMove}
						onTouchEnd={nativeGestures ? undefined : handleTouchEnd}
						onClick={(e) => e.stopPropagation()}
						className={cn(
							'relative z-10 w-full max-w-md mx-auto text-on-surface rounded-t-[32px] border-t sm:border shadow-[0_-12px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden hide-scrollbar no-scrollbar box-border transform-gpu transition-colors duration-200 will-change-transform',
							glassmorphic
								? 'bg-[color-mix(in_srgb,color-mix(in_srgb,var(--surface)_40%,#000000)_40%,transparent)] backdrop-blur-sm backdrop-saturate-150 border-white/10 dark:border-white/10'
								: 'bg-surface border-outline-variant/40',
							maxHeight,
							contentClassName
						)}
					>
						{/* Ambient Top Glow Effect */}
						<div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-28 bg-primary/15 blur-3xl pointer-events-none rounded-full" />

						{/* Optional Top Drag Handle */}
						{showDragHandle && (
							<div className="pt-2.5 pb-1 flex justify-center flex-shrink-0 cursor-grab active:cursor-grabbing relative z-20">
								<div className="w-10 h-1 rounded-full bg-on-surface-variant/30" />
							</div>
						)}

						{children}
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);

	if (typeof document === 'undefined') {
		return null;
	}

	return createPortal(sheetContent, document.body);
}
