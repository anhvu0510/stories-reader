import React, { useEffect, useState, useCallback } from 'react';
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

export function SelectionSpeakerTooltip({ onSpeak, containerId = 'main-story-content' }: SelectionSpeakerTooltipProps) {
	const [position, setPosition] = useState<TooltipPosition | null>(null);
	const updateSelection = useCallback(() => {
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) {
			setPosition(null);
			return;
		}
		const range = selection.getRangeAt(0);
		const container = document.getElementById(containerId);
		if (!container?.contains(range.startContainer)) {
			setPosition(null);
			return;
		}
		const node = range.startContainer;
		const paragraph = (node instanceof Element ? node : node.parentElement)?.closest('[data-paragraph-index]');
		if (!paragraph) return;
		const paragraphIndex = Number(paragraph.getAttribute('data-paragraph-index'));
		if (!Number.isInteger(paragraphIndex)) return;
		const preRange = document.createRange();
		preRange.selectNodeContents(paragraph);
		preRange.setEnd(range.startContainer, range.startOffset);
		const rect = range.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) {
			setPosition(null);
			return;
		}
		const top = rect.bottom + 12 + 38 > window.innerHeight - 70
			? Math.max(16, rect.top - 38 - 12)
			: rect.bottom + 12;
		const left = Math.max(16, Math.min(window.innerWidth - 110 - 16, rect.left + rect.width / 2 - 55));
		setPosition({ top, left, paragraphIndex, charOffset: preRange.toString().length });
	}, [containerId]);

	useEffect(() => {
		document.addEventListener('selectionchange', updateSelection);
		window.addEventListener('resize', updateSelection);
		window.addEventListener('scroll', updateSelection, { passive: true });
		return () => {
			document.removeEventListener('selectionchange', updateSelection);
			window.removeEventListener('resize', updateSelection);
			window.removeEventListener('scroll', updateSelection);
		};
	}, [updateSelection]);

	const handleAction = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (!position) return;
		triggerHaptic('medium');
		onSpeak(position.paragraphIndex, position.charOffset);
		window.getSelection()?.removeAllRanges();
		setPosition(null);
	};

	if (!position) return null;
	return (
		<button
			type="button"
			data-testid="selection-speaker-tooltip"
			aria-label="Đọc từ vị trí đã chọn"
			className="fixed z-[99995] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/95 dark:bg-zinc-800/95 text-white border border-primary/60 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md cursor-pointer animate-in fade-in zoom-in-95 duration-200 select-none active:scale-95 transition-transform"
			style={{ top: `${position.top}px`, left: `${position.left}px` }}
			onMouseDown={(event) => event.preventDefault()}
			onTouchStart={(event) => event.stopPropagation()}
			onClick={handleAction}
		>
			<Volume2 size={16} className="text-primary animate-pulse" />
		</button>
	);
}
