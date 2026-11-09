import { GripHorizontal } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef } from 'react';

import { hasNativeGestureBlocker } from '@/services/nativeGestureEligibility';
import { configureNativeControl, hasNativeReaderGestures, onNativeReaderGesture } from '@/services/nativeReaderGestures';

import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from 'react';

interface ReadAloudControlFrameProps {
	active: boolean;
	isVisible: boolean;
	children: ReactNode;
}

interface VerticalDrag {
	pointerId: number;
	startY: number;
	startOffset: number;
	minimum: number;
	maximum: number;
}

const TOP_CLEARANCE = 80;
const BOTTOM_CLEARANCE = 100;
const KEYBOARD_STEP = 24;

function setupNativeGestureListeners(nativeGestures: boolean, publish: () => void): () => void {
	if (!nativeGestures) return () => {};
	const bodyObserver = new MutationObserver(publish);
	bodyObserver.observe(document.body, { attributes: true });
	window.addEventListener('transitionend', publish);
	window.addEventListener('animationend', publish);
	return () => {
		bodyObserver.disconnect();
		window.removeEventListener('transitionend', publish);
		window.removeEventListener('animationend', publish);
		configureNativeControl({ enabled: false });
	};
}

function setupResizeListeners(frame: HTMLDivElement | null, nativeGestures: boolean, reclamp: () => void): () => void {
	const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reclamp);
	if (frame) observer?.observe(frame);
	window.addEventListener('resize', reclamp);
	window.visualViewport?.addEventListener('resize', reclamp);
	if (!nativeGestures) {
		window.visualViewport?.addEventListener('scroll', reclamp);
	}
	return () => {
		observer?.disconnect();
		window.removeEventListener('resize', reclamp);
		window.visualViewport?.removeEventListener('resize', reclamp);
		window.visualViewport?.removeEventListener('scroll', reclamp);
	};
}

interface ReadAloudHandleProps {
	handleRef: RefObject<HTMLButtonElement | null>;
	isVisible: boolean;
	nativeGestures: boolean;
	startDrag: (event: PointerEvent<HTMLButtonElement>) => void;
	moveDrag: (event: PointerEvent<HTMLButtonElement>) => void;
	finishDrag: (event: PointerEvent<HTMLButtonElement>) => void;
	stopDrag: () => void;
	moveWithKeyboard: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function ReadAloudHandle({
	handleRef,
	isVisible,
	nativeGestures,
	startDrag,
	moveDrag,
	finishDrag,
	stopDrag,
	moveWithKeyboard,
}: ReadAloudHandleProps) {
	const pointerProps = nativeGestures
		? {}
		: {
				onPointerDown: startDrag,
				onPointerMove: moveDrag,
				onPointerUp: finishDrag,
				onPointerCancel: finishDrag,
				onLostPointerCapture: stopDrag,
			};

	return (
		<button
			ref={handleRef}
			type="button"
			aria-label="Kéo thanh điều khiển lên hoặc xuống"
			title="Kéo lên/xuống hoặc dùng phím mũi tên"
			disabled={!isVisible}
			className="w-9 h-6 shrink-0 flex items-center justify-center bg-transparent text-primary/70 cursor-ns-resize touch-none select-none rounded-full focus-visible:outline-2 focus-visible:outline-primary"
			{...pointerProps}
			onKeyDown={moveWithKeyboard}
			onClick={(event) => event.stopPropagation()}
		>
			<GripHorizontal size={16} aria-hidden="true" />
		</button>
	);
}

function computeFrameBounds(frame: HTMLDivElement | null, currentOffset: number): { minimum: number; maximum: number } | null {
	if (!frame) return null;
	const rect = frame.getBoundingClientRect();
	if (!rect.height) return null;
	const viewport = window.visualViewport;
	const viewportTop = viewport?.offsetTop ?? 0;
	const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
	const style = getComputedStyle(frame);
	const safeTop = Number.parseFloat(style.getPropertyValue('--reader-control-safe-top')) || 0;
	const safeBottom = Number.parseFloat(style.getPropertyValue('--reader-control-safe-bottom')) || 0;
	const baseTop = rect.top - currentOffset;
	const minimum = viewportTop + TOP_CLEARANCE + safeTop - baseTop;
	const maximum = Math.max(minimum, viewportBottom - BOTTOM_CLEARANCE - safeBottom - rect.height - baseTop);
	return { minimum, maximum };
}

function syncNativeControlGeometry(
	nativeGestures: boolean,
	active: boolean,
	isVisible: boolean,
	bounds: { minimum: number; maximum: number } | null,
	rect: DOMRect | undefined,
	currentOffset: number
): void {
	if (!nativeGestures) return;
	const enabled = active && isVisible && Boolean(bounds && rect) && !hasNativeGestureBlocker();
	if (!enabled || !bounds || !rect) {
		configureNativeControl({ enabled: false });
		return;
	}
	configureNativeControl({
		enabled: true,
		viewportWidth: window.innerWidth,
		left: rect.left,
		top: rect.top,
		right: rect.right,
		bottom: rect.bottom,
		offset: currentOffset,
		...bounds,
	});
}

export function ReadAloudControlFrame({ active, isVisible, children }: ReadAloudControlFrameProps) {
	const frameRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLButtonElement>(null);
	const offset = useRef(0);
	const drag = useRef<VerticalDrag | null>(null);
	const nativeGestures = hasNativeReaderGestures();

	const getBounds = useCallback(() => computeFrameBounds(frameRef.current, offset.current), []);

	const applyOffset = useCallback((next: number) => {
		const frame = frameRef.current;
		if (!frame) return;
		offset.current = next;
		// Update only this transform, not the reader/TTS tree, on every pointer movement.
		frame.style.transform = `translate3d(0, ${next}px, 0)`;
	}, []);

	const stopDrag = useCallback(() => {
		const current = drag.current;
		drag.current = null;
		if (!current || !handleRef.current?.hasPointerCapture?.(current.pointerId)) return;
		handleRef.current.releasePointerCapture(current.pointerId);
	}, []);

	const publishNativeGeometry = useCallback(() => {
		syncNativeControlGeometry(nativeGestures, active, isVisible, getBounds(), handleRef.current?.getBoundingClientRect(), offset.current);
	}, [nativeGestures, active, isVisible, getBounds]);

	useLayoutEffect(() => {
		const reclamp = () => {
			stopDrag();
			const bounds = getBounds();
			if (!bounds) return;
			applyOffset(Math.max(bounds.minimum, Math.min(bounds.maximum, offset.current)));
			publishNativeGeometry();
		};
		reclamp();
		const unsubscribe = onNativeReaderGesture((gesture) => {
			if (!active || !isVisible || gesture.kind !== 'control-move') return;
			applyOffset(gesture.offset);
		});
		const cleanupNative = setupNativeGestureListeners(nativeGestures, publishNativeGeometry);
		const cleanupResize = setupResizeListeners(frameRef.current, nativeGestures, reclamp);
		return () => {
			unsubscribe();
			cleanupNative();
			cleanupResize();
			stopDrag();
		};
	}, [active, isVisible, applyOffset, getBounds, stopDrag, nativeGestures, publishNativeGeometry]);

	const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
		if (!active || !isVisible || event.button !== 0 || drag.current) return;
		event.preventDefault();
		event.stopPropagation();
		const bounds = getBounds();
		if (!bounds) return;
		drag.current = { pointerId: event.pointerId, startY: event.clientY, startOffset: offset.current, ...bounds };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId) return;
		event.stopPropagation();
		const next = current.startOffset + event.clientY - current.startY;
		applyOffset(Math.max(current.minimum, Math.min(current.maximum, next)));
	};

	const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
		if (drag.current?.pointerId !== event.pointerId) return;
		event.stopPropagation();
		stopDrag();
	};

	const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (!active || !isVisible || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
		event.preventDefault();
		event.stopPropagation();
		const bounds = getBounds();
		if (!bounds) return;
		const next = offset.current + (event.key === 'ArrowUp' ? -KEYBOARD_STEP : KEYBOARD_STEP);
		applyOffset(Math.max(bounds.minimum, Math.min(bounds.maximum, next)));
		publishNativeGeometry();
	};

	const containerClasses = active
		? 'w-fit flex flex-col items-center gap-1 pointer-events-auto box-border transform-gpu [--reader-control-safe-top:env(safe-area-inset-top,0px)] [--reader-control-safe-bottom:env(safe-area-inset-bottom,0px)] rounded-[24px] border border-primary/25 bg-transparent p-1.5 max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-180px)] overflow-y-auto'
		: 'w-fit flex flex-col items-center gap-2 pointer-events-auto box-border transform-gpu [--reader-control-safe-top:env(safe-area-inset-top,0px)] [--reader-control-safe-bottom:env(safe-area-inset-bottom,0px)]';

	return (
		<div
			ref={frameRef}
			data-reader-control="true"
			role={active ? 'group' : undefined}
			aria-label={active ? 'Điều khiển đọc thành tiếng' : undefined}
			className={containerClasses}
		>
			{active && (
				<ReadAloudHandle
					handleRef={handleRef}
					isVisible={isVisible}
					nativeGestures={nativeGestures}
					startDrag={startDrag}
					moveDrag={moveDrag}
					finishDrag={finishDrag}
					stopDrag={stopDrag}
					moveWithKeyboard={moveWithKeyboard}
				/>
			)}
			{children}
		</div>
	);
}
