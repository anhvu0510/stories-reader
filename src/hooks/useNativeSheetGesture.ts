import { useEffect, useId, useRef } from 'react';

import { eligibleNativeTarget, isAtNativeScrollTop } from '@/services/nativeGestureEligibility';
import {
	configureNativeSheet,
	hasNativeReaderGestures,
	onNativeReaderGesture,
	registerNativeGestureHitTest,
} from '@/services/nativeReaderGestures';

import { triggerHaptic } from './useHaptic';

import type { RefObject } from 'react';

type NativeGesture = Parameters<Parameters<typeof onNativeReaderGesture>[0]>[0];
type SheetGesture = Extract<NativeGesture, { kind: 'sheet-move' | 'sheet-end' }>;

function isSheetGestureForOwner(gesture: NativeGesture, owner: string): gesture is SheetGesture {
	if (gesture.kind !== 'sheet-move' && gesture.kind !== 'sheet-end') return false;
	return gesture.owner === owner;
}

function settleSheetCard(card: HTMLDivElement, dismiss: boolean, onDismiss: () => void) {
	card.style.transition = `transform ${dismiss ? 200 : 240}ms cubic-bezier(0.2, 0, 0, 1)`;
	card.style.transform = dismiss ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0px, 0)';
	if (dismiss) triggerHaptic('light');
	return setTimeout(
		() => {
			if (dismiss) {
				onDismiss();
				return;
			}
			card.style.transform = '';
			card.style.transition = '';
		},
		dismiss ? 180 : 250
	);
}

export function useNativeSheetGesture(
	isOpen: boolean,
	disabled: boolean,
	cardRef: RefObject<HTMLDivElement | null>,
	onClose: () => void
): void {
	const owner = useId();
	const latestClose = useRef(onClose);
	useEffect(() => {
		latestClose.current = onClose;
	}, [onClose]);
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
			if (!isSheetGestureForOwner(gesture, owner) || dismissing) return;
			const card = cardRef.current;
			if (!card) return;
			if (timer) clearTimeout(timer);
			if (gesture.kind === 'sheet-move') {
				card.style.transition = 'none';
				card.style.transform = `translate3d(0, ${gesture.offset}px, 0)`;
				return;
			}
			dismissing = gesture.dismiss;
			timer = settleSheetCard(card, gesture.dismiss, () => latestClose.current());
		});
		configureNativeSheet({ enabled: true, owner });
		return () => {
			if (timer) clearTimeout(timer);
			if (registeredCard) {
				registeredCard.style.transform = '';
				registeredCard.style.transition = '';
			}
			unsubscribe();
			removeHitTest();
			configureNativeSheet({ enabled: false, owner });
		};
	}, [isOpen, disabled, cardRef, owner]);
}
