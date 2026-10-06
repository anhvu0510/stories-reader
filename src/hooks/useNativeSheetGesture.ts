import { useEffect, useId, useRef } from 'react';
import type { RefObject } from 'react';
import { configureNativeSheet, hasNativeReaderGestures, onNativeReaderGesture, registerNativeGestureHitTest } from '@/services/nativeReaderGestures';
import { eligibleNativeTarget, isAtNativeScrollTop } from '@/services/nativeGestureEligibility';
import { triggerHaptic } from './useHaptic';

export function useNativeSheetGesture(isOpen: boolean, disabled: boolean, cardRef: RefObject<HTMLDivElement | null>, onClose: () => void): void {
	const owner = useId();
	const latestClose = useRef(onClose);
	useEffect(() => { latestClose.current = onClose; }, [onClose]);
	useEffect(() => {
		if (!hasNativeReaderGestures() || !isOpen || disabled) return;
		const registeredCard = cardRef.current;
		let dismissing = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const removeHitTest = registerNativeGestureHitTest('sheet', owner, (x, y) => {
			const target = eligibleNativeTarget(x, y, true);
			const card = cardRef.current;
			if (!target || !card || !card.contains(target) || dismissing) return false;
			return isAtNativeScrollTop(target, card);
		});
		const unsubscribe = onNativeReaderGesture((gesture) => {
			if ((gesture.kind !== 'sheet-move' && gesture.kind !== 'sheet-end') || gesture.owner !== owner || dismissing) return;
			const card = cardRef.current;
			if (!card) return;
			if (timer) clearTimeout(timer);
			if (gesture.kind === 'sheet-move') {
				card.style.transition = 'none';
				card.style.transform = `translate3d(0, ${gesture.offset}px, 0)`;
				return;
			}
			dismissing = gesture.dismiss;
			card.style.transition = `transform ${gesture.dismiss ? 200 : 240}ms cubic-bezier(0.2, 0, 0, 1)`;
			card.style.transform = gesture.dismiss ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0px, 0)';
			if (gesture.dismiss) triggerHaptic('light');
			timer = setTimeout(() => {
				if (gesture.dismiss) { latestClose.current(); return; }
				card.style.transform = '';
				card.style.transition = '';
			}, gesture.dismiss ? 180 : 250);
		});
		configureNativeSheet({ enabled: true, owner });
		return () => {
			if (timer) clearTimeout(timer);
			if (registeredCard) { registeredCard.style.transform = ''; registeredCard.style.transition = ''; }
			unsubscribe();
			removeHitTest();
			configureNativeSheet({ enabled: false, owner });
		};
	}, [isOpen, disabled, cardRef, owner]);
}
