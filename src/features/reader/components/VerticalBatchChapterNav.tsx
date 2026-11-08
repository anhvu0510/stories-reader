import { Loader2, LocateFixed, Maximize2, Minimize2, Pause, Play, SkipForward, Square, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { isEdgeReadAloudActive } from '@/hooks/useEdgeReadAloudBgm';
import { useFullscreen } from '@/hooks/useFullscreen';
import { triggerHaptic } from '@/hooks/useHaptic';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';

import { ReadAloudControlFrame } from './ReadAloudControlFrame';

import type { ChapterDetailItem } from '@/shared/types';
import type { MouseEvent } from 'react';

export interface VerticalBatchChapterNavProps {
	onLocateReadingLine?: () => void;
	chapters?: ChapterDetailItem[];
	activeChapterId?: string;
	isVisible?: boolean;
	isTTSActive?: boolean;
	isTTSLoading?: boolean;
	isTTSPlaying?: boolean;
	isBgmActive?: boolean;
	showTTSControl?: boolean;
	onToggleBgm?: () => void;
	currentParagraphIndex?: number;
	onToggleTTS?: () => void;
	onTTSPlay?: () => void;
	onTTSPause?: () => void;
	onTTSStop?: () => void;
	onTTSPrev?: () => void;
	onTTSNext?: () => void;
}

function useBrowserReadAloudHighlight(): boolean {
	const [highlighted, setHighlighted] = useState(false);

	useEffect(() => {
		if (typeof document === 'undefined') return;

		const checkHighlight = () => {
			if (typeof document === 'undefined') return;
			setHighlighted(isEdgeReadAloudActive());
		};

		checkHighlight();

		if (typeof MutationObserver !== 'undefined') {
			const observer = new MutationObserver(checkHighlight);
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class'],
			});
			return () => observer.disconnect();
		}
	}, []);

	return highlighted;
}

function jumpToHighlight(isTTSActive: boolean, onLocateReadingLine?: () => void) {
	if (hasNativeReaderGestures() && isTTSActive) {
		onLocateReadingLine?.();
		return;
	}
	if (typeof document === 'undefined') return;
	const highlightEl = document.querySelector('.msreadout-line-highlight, .msreadout-word-highlight, msreadoutspan');
	if (highlightEl && typeof highlightEl.scrollIntoView === 'function') {
		highlightEl.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
		});
	}
}

function LocateButton({ onClick }: { onClick: () => void }) {
	return (
		<motion.button
			whileTap={{ scale: 0.88 }}
			onClick={(e) => {
				e.stopPropagation();
				triggerHaptic('light');
				onClick();
			}}
			className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-primary shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20"
			title="Nhảy tới dòng đang đọc"
			aria-label="Nhảy tới dòng đang đọc"
		>
			<LocateFixed size={16} />
		</motion.button>
	);
}

function FullscreenButton() {
	const { isFullscreen, isSupported, toggleFullscreen } = useFullscreen();

	if (!isSupported) return null;

	const activeStyle = isFullscreen
		? 'bg-primary/25 text-primary border border-primary/60 shadow-[0_3px_12px_rgba(59,130,246,0.45)]'
		: 'bg-black/20 dark:bg-black/40 border border-primary/50 text-on-surface hover:text-primary';

	return (
		<motion.button
			whileTap={{ scale: 0.88 }}
			onClick={(e) => {
				e.stopPropagation();
				triggerHaptic('light');
				toggleFullscreen();
			}}
			className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 ${activeStyle}`}
			title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
			aria-label={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
		>
			{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
		</motion.button>
	);
}

function PlayPauseButton({
	isTTSPlaying,
	isTTSLoading,
	onTTSPlay,
	onTTSPause,
}: {
	isTTSPlaying: boolean;
	isTTSLoading: boolean;
	onTTSPlay?: () => void;
	onTTSPause?: () => void;
}) {
	if (isTTSPlaying) {
		return (
			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={(e) => {
					e.stopPropagation();
					triggerHaptic('medium');
					onTTSPause?.();
				}}
				className="w-9.5 h-9.5 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 transition-colors cursor-pointer"
				title="Tạm dừng đọc"
				aria-label="Tạm dừng đọc"
			>
				<Pause size={16} fill="currentColor" />
			</motion.button>
		);
	}

	if (isTTSLoading) {
		return (
			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={(e) => {
					e.stopPropagation();
					triggerHaptic('medium');
					onTTSPause?.();
				}}
				className="w-9.5 h-9.5 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 transition-colors cursor-pointer"
				title="Đang tải câu tiếp..."
				aria-label="Đang tải câu tiếp"
			>
				<Loader2 size={16} className="animate-spin text-primary" />
			</motion.button>
		);
	}

	return (
		<motion.button
			whileTap={{ scale: 0.88 }}
			onClick={(e) => {
				e.stopPropagation();
				triggerHaptic('medium');
				onTTSPlay?.();
			}}
			className="w-9.5 h-9.5 rounded-full flex items-center justify-center bg-primary/25 text-primary border border-primary/60 backdrop-blur-[2px] shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 transition-colors cursor-pointer"
			title="Tiếp tục đọc"
			aria-label="Tiếp tục đọc"
		>
			<Play size={16} fill="currentColor" />
		</motion.button>
	);
}

interface TTSActiveControlsProps {
	canLocate: boolean;
	onLocate: () => void;
	isTTSPlaying: boolean;
	isTTSLoading: boolean;
	onTTSPlay?: () => void;
	onTTSPause?: () => void;
	onTTSNext?: () => void;
	onTTSStop?: () => void;
	onToggleTTS?: () => void;
}

function TTSActiveControls({
	canLocate,
	onLocate,
	isTTSPlaying,
	isTTSLoading,
	onTTSPlay,
	onTTSPause,
	onTTSNext,
	onTTSStop,
	onToggleTTS,
}: TTSActiveControlsProps) {
	const handleStop = (e: MouseEvent) => {
		e.stopPropagation();
		triggerHaptic('warning');
		if (onTTSStop) {
			onTTSStop();
			return;
		}
		onToggleTTS?.();
	};

	const handleNext = (e: MouseEvent) => {
		e.stopPropagation();
		triggerHaptic('light');
		onTTSNext?.();
	};

	return (
		<div className="flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-90 duration-300 ease-out">
			{canLocate && <LocateButton onClick={onLocate} />}
			<FullscreenButton />
			<PlayPauseButton isTTSPlaying={isTTSPlaying} isTTSLoading={isTTSLoading} onTTSPlay={onTTSPlay} onTTSPause={onTTSPause} />
			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={handleNext}
				className="w-9 h-9 rounded-full flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-on-surface shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 hover:text-primary transition-colors cursor-pointer"
				title="Đoạn sau"
				aria-label="Đoạn sau"
			>
				<SkipForward size={16} />
			</motion.button>
			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={handleStop}
				className="w-9 h-9 rounded-full flex items-center justify-center text-rose-400 bg-rose-500/10 backdrop-blur-[2px] border border-rose-500/40 shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-rose-500/20 transition-colors cursor-pointer mt-0.5"
				title="Dừng đọc"
				aria-label="Dừng đọc"
			>
				<Square size={13} fill="currentColor" />
			</motion.button>
		</div>
	);
}

interface TTSInactiveControlsProps {
	hasBrowserReadAloudHighlight: boolean;
	onLocate: () => void;
	showTTSControl: boolean;
	isTTSLoading: boolean;
	onToggleTTS?: () => void;
	onTTSPlay?: () => void;
}

function TTSInactiveControls({
	hasBrowserReadAloudHighlight,
	onLocate,
	showTTSControl,
	isTTSLoading,
	onToggleTTS,
	onTTSPlay,
}: TTSInactiveControlsProps) {
	const handleSpeakerClick = (e: MouseEvent) => {
		e.stopPropagation();
		triggerHaptic('medium');
		if (onToggleTTS) {
			onToggleTTS();
			return;
		}
		onTTSPlay?.();
	};

	const showSpeaker = showTTSControl || isTTSLoading;
	const speakerTitle = isTTSLoading ? 'Đang chuẩn bị âm thanh... (Bấm để hủy)' : 'Bật đọc thành tiếng (Read Aloud)';
	const speakerLabel = isTTSLoading ? 'Đang chuẩn bị âm thanh' : 'Bật đọc thành tiếng';

	return (
		<div className="flex flex-col items-center gap-2.5">
			{hasBrowserReadAloudHighlight && <LocateButton onClick={onLocate} />}
			{hasBrowserReadAloudHighlight && <FullscreenButton />}
			{showSpeaker && (
				<motion.button
					whileTap={{ scale: 0.88 }}
					onClick={handleSpeakerClick}
					className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer bg-black/20 dark:bg-black/40 backdrop-blur-[2px] border border-primary/50 text-primary shadow-[0_3px_12px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20"
					title={speakerTitle}
					aria-label={speakerLabel}
				>
					{isTTSLoading ? <Loader2 size={16} className="animate-spin text-primary" /> : <Volume2 size={16} />}
				</motion.button>
			)}
		</div>
	);
}

function resolveNavProps(props: VerticalBatchChapterNavProps) {
	return {
		isVisible: props.isVisible ?? true,
		isTTSActive: Boolean(props.isTTSActive),
		isTTSLoading: Boolean(props.isTTSLoading),
		isTTSPlaying: Boolean(props.isTTSPlaying),
		isBgmActive: Boolean(props.isBgmActive),
		showTTSControl: props.showTTSControl ?? true,
		onToggleBgm: props.onToggleBgm,
		onToggleTTS: props.onToggleTTS,
		onTTSPlay: props.onTTSPlay,
		onTTSPause: props.onTTSPause,
		onTTSStop: props.onTTSStop,
		onTTSNext: props.onTTSNext,
		onLocateReadingLine: props.onLocateReadingLine,
	};
}

export function VerticalBatchChapterNav(props: VerticalBatchChapterNavProps) {
	const {
		isVisible,
		isTTSActive,
		isTTSLoading,
		isTTSPlaying,
		showTTSControl,
		onToggleTTS,
		onTTSPlay,
		onTTSPause,
		onTTSStop,
		onTTSNext,
		onLocateReadingLine,
	} = resolveNavProps(props);

	const hasBrowserReadAloudHighlight = useBrowserReadAloudHighlight();
	const hasNativeLocate = Boolean(hasNativeReaderGestures() && onLocateReadingLine);
	const canLocateInActive = hasBrowserReadAloudHighlight || hasNativeLocate;

	const handleJump = () => {
		jumpToHighlight(isTTSActive, onLocateReadingLine);
	};

	const containerClass = isVisible ? 'translate-x-0 opacity-100' : '-translate-x-14 opacity-0 pointer-events-none';

	return (
		<div
			aria-hidden={!isVisible}
			inert={!isVisible}
			className={`fixed bottom-[100px] left-0 right-0 z-40 w-full max-w-4xl lg:max-w-5xl mx-auto px-4 pointer-events-none box-border transition-all duration-300 cubic-bezier(0.16,1,0.3,1) transform-gpu ${containerClass}`}
		>
			<ReadAloudControlFrame active={isTTSActive} isVisible={isVisible}>
				{isTTSActive ? (
					<TTSActiveControls
						canLocate={canLocateInActive}
						onLocate={handleJump}
						isTTSPlaying={isTTSPlaying}
						isTTSLoading={isTTSLoading}
						onTTSPlay={onTTSPlay}
						onTTSPause={onTTSPause}
						onTTSNext={onTTSNext}
						onTTSStop={onTTSStop}
						onToggleTTS={onToggleTTS}
					/>
				) : (
					<TTSInactiveControls
						hasBrowserReadAloudHighlight={hasBrowserReadAloudHighlight}
						onLocate={handleJump}
						showTTSControl={showTTSControl}
						isTTSLoading={isTTSLoading}
						onToggleTTS={onToggleTTS}
						onTTSPlay={onTTSPlay}
					/>
				)}
			</ReadAloudControlFrame>
		</div>
	);
}
