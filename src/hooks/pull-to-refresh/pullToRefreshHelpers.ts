import { triggerHaptic } from '../useHaptic';

/**
 * Thực hiện reload trang web an toàn trên trình duyệt Web (F5 reload).
 */
export function reloadBrowserPage(): void {
	if (typeof window === 'undefined' || typeof window.location?.reload !== 'function') return;
	try {
		window.location.reload();
	} catch {
		// Bỏ qua lỗi navigation trong môi trường test/jsdom
	}
}

export function isPullMoveInactive(canPull: boolean, isRefreshing: boolean, isSupported: boolean): boolean {
	return !canPull || isRefreshing || !isSupported;
}

export function applyPullResistance(
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

export function isInsideScrollableChild(targetEl: HTMLElement | null): boolean {
	let currentParent = targetEl;
	while (currentParent && currentParent !== document.body && currentParent !== document.documentElement) {
		if (currentParent.scrollTop > 1) return true;
		currentParent = currentParent.parentElement;
	}
	return false;
}

export function isTargetInsideModal(targetEl: HTMLElement | null): boolean {
	return Boolean(
		targetEl?.closest?.('[role="dialog"], [aria-modal="true"], .bottom-sheet, [data-modal], [data-sheet], [data-dialog], [data-sheet-open]')
	);
}

export function isNearEdge(x: number): boolean {
	return x < 28 || (typeof window !== 'undefined' && x > window.innerWidth - 28);
}

export function canInitiatePull(targetEl: HTMLElement | null, scrollTop: number, clientX: number, isModalActive: boolean): boolean {
	if (isModalActive || isTargetInsideModal(targetEl)) return false;
	if (isInsideScrollableChild(targetEl) || scrollTop > 0) return false;
	return !isNearEdge(clientX);
}

export function getSingleTouchIfEligible(e: TouchEvent, scrollTop: number, isModalActive: boolean): Touch | null {
	const touch = e.touches?.[0];
	if (!touch || e.touches.length !== 1) return null;
	if (!canInitiatePull(e.target as HTMLElement | null, scrollTop, touch.clientX, isModalActive)) return null;
	return touch;
}

export function shouldCancelPullOnMove(deltaX: number, deltaY: number): boolean {
	if (deltaX >= deltaY && deltaX > 8) return true;
	return deltaY <= 0;
}

export function shouldStartPulling(deltaX: number, deltaY: number): boolean {
	return deltaY >= 14 && deltaY > deltaX * 1.3;
}

export function evaluateInitialPullMove(deltaX: number, deltaY: number): 'cancel' | 'start' | 'wait' {
	if (shouldCancelPullOnMove(deltaX, deltaY)) return 'cancel';
	if (shouldStartPulling(deltaX, deltaY)) return 'start';
	return 'wait';
}

export function updateHapticThreshold(
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
