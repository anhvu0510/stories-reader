import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { triggerHaptic } from '@/hooks/useHaptic';

export interface SelectionSpeakerTooltipProps {
	onSpeak: (paragraphIndex: number, charOffset: number) => void;
	containerId?: string;
	isTTSActive?: boolean;
}

interface TooltipPosition {
	top: number;
	left: number;
	paragraphIndex: number;
	charOffset: number;
}

export function SelectionSpeakerTooltip({ onSpeak, containerId = 'main-story-content', isTTSActive = false }: SelectionSpeakerTooltipProps) {
	const [position, setPosition] = useState<TooltipPosition | null>(null);
	const isInteractingRef = useRef(false);
	const onSpeakRef = useRef(onSpeak);
	const selectionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		onSpeakRef.current = onSpeak;
	});

	const extractSelectionTarget = useCallback((): {
		paragraphIndex: number;
		charOffset: number;
		rect: DOMRect;
	} | null => {
		if (typeof window === 'undefined') return null;

		const selection = window.getSelection();
		if (!selection || selection.isCollapsed || !selection.rangeCount) {
			return null;
		}

		const selectedText = selection.toString().trim();
		if (!selectedText) {
			return null;
		}

		const range = selection.getRangeAt(0);
		const container = document.getElementById(containerId);
		if (!container || !container.contains(range.startContainer)) {
			return null;
		}

		// Find the closest paragraph element with data-paragraph-index
		const startNode = range.startContainer;
		const paraEl = (startNode instanceof Element ? startNode : startNode.parentElement)?.closest('[data-paragraph-index]');
		if (!paraEl) {
			return null;
		}

		const pIdx = Number(paraEl.getAttribute('data-paragraph-index'));
		if (Number.isNaN(pIdx)) {
			return null;
		}

		// Calculate character offset from the beginning of the paragraph
		let charOffset = 0;
		try {
			const preRange = document.createRange();
			preRange.selectNodeContents(paraEl);
			preRange.setEnd(range.startContainer, range.startOffset);
			charOffset = preRange.toString().length;
		} catch {
			charOffset = 0;
		}

		const rect = range.getBoundingClientRect();
		return {
			paragraphIndex: pIdx,
			charOffset,
			rect
		};
	}, [containerId]);

	const executeAutoJumpInReadMode = useCallback(() => {
		if (!isTTSActive || isInteractingRef.current) return;

		const target = extractSelectionTarget();
		if (!target) return;

		if (selectionDebounceTimerRef.current) {
			clearTimeout(selectionDebounceTimerRef.current);
			selectionDebounceTimerRef.current = null;
		}

		isInteractingRef.current = true;
		triggerHaptic('light');
		onSpeakRef.current(target.paragraphIndex, target.charOffset);

		// Clear selection so Android OS text selection handles & action bar close cleanly
		try {
			const sel = window.getSelection();
			if (sel && sel.removeAllRanges) {
				sel.removeAllRanges();
			}
		} catch {}

		// Suppress duplicate re-triggers while removeAllRanges() settles
		setTimeout(() => {
			isInteractingRef.current = false;
		}, 400);
	}, [isTTSActive, extractSelectionTarget]);

	const updateSelection = useCallback(() => {
		if (typeof window === 'undefined') return;

		if (isTTSActive) {
			setPosition(null);
			if (isInteractingRef.current) return;

			if (selectionDebounceTimerRef.current) {
				clearTimeout(selectionDebounceTimerRef.current);
			}

			// When holding down ("nhấn giữ") on mobile, selectionchange fires and settles.
			// Debounce ~250ms to allow mobile touch handles to settle before jumping.
			selectionDebounceTimerRef.current = setTimeout(() => {
				executeAutoJumpInReadMode();
			}, 250);
			return;
		}

		if (isInteractingRef.current) {
			setPosition(null);
			return;
		}

		const target = extractSelectionTarget();
		if (!target || (target.rect.width === 0 && target.rect.height === 0)) {
			setPosition(null);
			return;
		}

		// Position tooltip BELOW the selection to avoid colliding with native mobile Action Mode menu
		const TOOLTIP_HEIGHT = 38;
		const GAP = 12;
		let top = target.rect.bottom + GAP;

		// If too close to the bottom edge of the viewport, position it safely above or clamp
		if (top + TOOLTIP_HEIGHT > window.innerHeight - 70) {
			top = Math.max(16, target.rect.top - TOOLTIP_HEIGHT - GAP);
		}

		const TOOLTIP_WIDTH = 110;
		const left = Math.max(16, Math.min(window.innerWidth - TOOLTIP_WIDTH - 16, target.rect.left + target.rect.width / 2 - TOOLTIP_WIDTH / 2));

		setPosition({
			top,
			left,
			paragraphIndex: target.paragraphIndex,
			charOffset: target.charOffset
		});
	}, [isTTSActive, extractSelectionTarget, executeAutoJumpInReadMode]);

	useEffect(() => {
		if (isTTSActive) {
			setPosition(null);
		}
	}, [isTTSActive]);

	useEffect(() => {
		if (typeof document === 'undefined') return;

		const handleSelectionChange = () => {
			requestAnimationFrame(() => {
				updateSelection();
			});
		};

		document.addEventListener('selectionchange', handleSelectionChange);
		window.addEventListener('resize', handleSelectionChange);
		window.addEventListener('scroll', handleSelectionChange, { passive: true });

		return () => {
			document.removeEventListener('selectionchange', handleSelectionChange);
			window.removeEventListener('resize', handleSelectionChange);
			window.removeEventListener('scroll', handleSelectionChange);
			if (selectionDebounceTimerRef.current) {
				clearTimeout(selectionDebounceTimerRef.current);
			}
		};
	}, [updateSelection]);

	// Native Android gesture / long-press / touch end event listeners for TTS mode
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const handleImmediateJump = (e?: Event) => {
			if (!isTTSActive) return;
			// Prevent default contextmenu popup if user selected text in TTS read mode
			if (e && e.type === 'contextmenu') {
				const target = extractSelectionTarget();
				if (target) {
					e.preventDefault();
				}
			}
			requestAnimationFrame(() => {
				executeAutoJumpInReadMode();
			});
		};

		// Android long-press fires contextmenu / touchcancel when native text selection mode activates
		window.addEventListener('contextmenu', handleImmediateJump);
		window.addEventListener('touchcancel', handleImmediateJump);
		window.addEventListener('touchend', handleImmediateJump);
		window.addEventListener('mouseup', handleImmediateJump);

		return () => {
			window.removeEventListener('contextmenu', handleImmediateJump);
			window.removeEventListener('touchcancel', handleImmediateJump);
			window.removeEventListener('touchend', handleImmediateJump);
			window.removeEventListener('mouseup', handleImmediateJump);
		};
	}, [isTTSActive, executeAutoJumpInReadMode, extractSelectionTarget]);


	const handleAction = (e: React.MouseEvent | React.TouchEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!position) return;

		isInteractingRef.current = true;
		triggerHaptic('medium');
		onSpeak(position.paragraphIndex, position.charOffset);

		// Clear selection to dismiss native OS context menu and hide tooltip
		if (window.getSelection) {
			window.getSelection()?.removeAllRanges();
		}
		setPosition(null);

		setTimeout(() => {
			isInteractingRef.current = false;
		}, 300);
	};

	if (!position) return null;

	return (
		<div
			data-testid="selection-speaker-tooltip"
			role="button"
			tabIndex={0}
			aria-label="Đọc từ vị trí đã chọn"
			className="fixed z-[99995] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/95 dark:bg-zinc-800/95 text-white border border-primary/60 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md cursor-pointer animate-in fade-in zoom-in-95 duration-200 select-none active:scale-95 transition-transform"
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`
			}}
			onMouseDown={(e) => {
				// Prevent default to prevent blur / losing text selection prematurely
				e.preventDefault();
			}}
			onTouchStart={(e) => {
				e.stopPropagation();
			}}
			onClick={handleAction}
		>
			<Volume2 size={16} className="text-primary animate-pulse" />
			{/* <span className="text-xs font-semibold text-on-surface tracking-wide">Đọc từ đây</span> */}
		</div>
	);
}
