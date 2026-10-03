import { useEffect } from 'react';

let lockCount = 0;

/**
 * Custom hook to lock body scrolling and touch interactions on the background
 * whenever a bottom sheet or modal is open.
 */
export function useBodyScrollLock(isLocked = true) {
	useEffect(() => {
		if (!isLocked || typeof document === 'undefined') return;

		lockCount += 1;
		if (lockCount === 1) {
			document.body.style.overflow = 'hidden';
			document.body.style.touchAction = 'none';
			document.body.setAttribute('data-modal-open', 'true');
		}

		return () => {
			lockCount = Math.max(0, lockCount - 1);
			if (lockCount === 0) {
				document.body.style.overflow = '';
				document.body.style.touchAction = '';
				document.body.removeAttribute('data-modal-open');
			}
		};
	}, [isLocked]);
}
