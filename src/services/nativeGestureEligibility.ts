import { useModalStore } from '@/stores/useModalStore';

const INTERACTIVE = 'button,a,input,textarea,select,[contenteditable="true"],[role="button"],[data-reader-control]';
export function hasNativeGestureBlocker(): boolean {
	const { isSettingsOpen, isOfflineManagerOpen } = useModalStore.getState();
	return isSettingsOpen || isOfflineManagerOpen || document.body.style.overflow === 'hidden'
		|| document.body.classList.contains('overflow-hidden')
		|| document.body.hasAttribute('data-sheet-open') || document.body.hasAttribute('data-modal-open')
		|| Boolean(document.querySelector('[role="dialog"],[aria-modal="true"],[data-sheet-open="true"]'));
}

export function eligibleNativeTarget(x: number, y: number, allowSheet = false): Element | null {
	if (window.getSelection()?.toString().trim()) return null;
	if (!allowSheet && hasNativeGestureBlocker()) return null;
	const target = document.elementFromPoint(x, y);
	if (!target || target.closest(INTERACTIVE)) return null;
	return target;
}

export function isAtNativeScrollTop(target: Element, boundary?: HTMLElement | null): boolean {
	let current: Element | null = target;
	while (current && current !== boundary) {
		if (current.scrollTop > 1) return false;
		current = current.parentElement;
	}
	return !boundary || boundary.scrollTop <= 1;
}
