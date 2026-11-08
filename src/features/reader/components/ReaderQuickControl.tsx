import { ChevronsLeft, ChevronsRight, Settings, Sparkles, List } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { openNextChapter, openPrevChapter } from '@/shared/utils/openChapter';
import { useAppStore } from '@/stores/useAppStore';
import { useModalStore } from '@/stores/useModalStore';

import type { ChapterDetailItem } from '@/shared/types';

interface ReaderQuickControlProps {
	bookId: string;
	currentChapterId?: string;
	prevChapterId?: string;
	nextChapterId?: string;
	currentChapterNumber?: number;
	chapterDisplayLabel?: string;
	totalChapters?: number;
	isVisible?: boolean;
	isTTSActive?: boolean;
	isTTSPlaying?: boolean;
	currentParagraphIndex?: number;
	chapters?: ChapterDetailItem[];
	activeChapterId?: string;
	onOpenChapterSelect: () => void;
	onOpenTranslation: () => void;
	onToggleTTS?: () => void;
	onTTSPlay?: () => void;
	onTTSPause?: () => void;
	onTTSStop?: () => void;
	onTTSPrev?: () => void;
	onTTSNext?: () => void;
}

function isValidChapterId(id?: string): boolean {
	if (!id) return false;
	const trimmed = String(id).trim();
	return trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined';
}

function getChapterButtonTitle(title: string | undefined, chapterNumber: number): string {
	if (!title) return `Chương ${chapterNumber}`;
	if (title.toLowerCase().startsWith('chương')) return title;
	return `Chương ${chapterNumber}: ${title}`;
}

interface QuickControlNavGroupProps {
	bookId: string;
	currentChapterId?: string;
	activeChapterId?: string;
	prevChapterId?: string;
	nextChapterId?: string;
}

function QuickControlNavGroup({ bookId, currentChapterId, activeChapterId, prevChapterId, nextChapterId }: QuickControlNavGroupProps) {
	const hasPrev = isValidChapterId(prevChapterId);
	const hasNext = isValidChapterId(nextChapterId);
	const targetCurrent = currentChapterId || activeChapterId;

	const handlePrev = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!hasPrev || !prevChapterId) return;
		triggerHaptic('light');
		openPrevChapter(bookId, targetCurrent, prevChapterId);
	};

	const handleNext = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!hasNext || !nextChapterId) return;
		triggerHaptic('light');
		openNextChapter(bookId, targetCurrent, nextChapterId);
	};

	const prevButtonClass = hasPrev
		? 'bg-white/10 border border-primary/50 text-on-surface shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:bg-white/20 cursor-pointer opacity-100'
		: 'bg-white/[0.06] text-on-surface-variant/40 border border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] opacity-70 cursor-not-allowed pointer-events-none';

	const nextButtonClass = hasNext
		? 'bg-primary/25 text-primary font-bold border border-primary/60 shadow-[0_4px_12px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.45)] hover:bg-primary/35 cursor-pointer opacity-100'
		: 'bg-white/[0.06] text-on-surface-variant/40 border border-primary/30 shadow-[0_2px_8px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] opacity-70 cursor-not-allowed pointer-events-none';

	return (
		<div className="relative z-10 flex items-center gap-1.5 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] p-1 rounded-full border border-primary/40 dark:border-primary/40 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4),_inset_0_-1px_1px_0_rgba(0,0,0,0.4)] shrink-0">
			<motion.button
				whileTap={hasPrev ? { scale: 0.88 } : undefined}
				onClick={handlePrev}
				disabled={!hasPrev}
				className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${prevButtonClass}`}
				title={hasPrev ? 'Chương trước' : 'Đã ở chương đầu tiên'}
			>
				<ChevronsLeft size={17} strokeWidth={2.5} />
			</motion.button>

			<motion.button
				whileTap={hasNext ? { scale: 0.88 } : undefined}
				onClick={handleNext}
				disabled={!hasNext}
				className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${nextButtonClass}`}
				title={hasNext ? 'Chương sau' : 'Đã ở chương mới nhất'}
			>
				<ChevronsRight size={17} strokeWidth={2.5} />
			</motion.button>
		</div>
	);
}

interface QuickControlCenterGroupProps {
	chapters?: ChapterDetailItem[];
	activeChapterId?: string;
	currentChapterNumber?: number;
	totalChapters?: number;
	onOpenChapterSelect: () => void;
	onJumpToChapter: (chapterId: string) => void;
}

function QuickControlCenterGroup({
	chapters,
	activeChapterId,
	currentChapterNumber,
	totalChapters,
	onOpenChapterSelect,
	onJumpToChapter,
}: QuickControlCenterGroupProps) {
	if (chapters && chapters.length > 1) {
		return (
			<div className="w-full flex items-center gap-1.5 min-w-0">
				<motion.button
					whileTap={{ scale: 0.88 }}
					onClick={(e) => {
						e.stopPropagation();
						triggerHaptic('selection');
						onOpenChapterSelect();
					}}
					className="w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/60 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center transition-all cursor-pointer shrink-0"
					title="Mở danh sách tất cả các chương"
				>
					<List size={14} strokeWidth={2.5} />
				</motion.button>

				<div className="w-[1px] h-4.5 bg-primary/40 shrink-0" />

				<div className="flex-1 min-w-0 grid grid-flow-col auto-cols-fr gap-1 items-center justify-center py-0.5">
					{chapters.map((chap) => {
						const isActive = chap.chapterId === activeChapterId;
						const activeClass = isActive
							? 'bg-primary/25 text-primary font-black border border-primary/60 shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] scale-[1.02]'
							: 'bg-white/10 text-on-surface/90 font-mono font-bold border border-primary/40 shadow-[0_2px_6px_rgba(0,0,0,0.25),_inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:bg-white/20';

						return (
							<motion.button
								key={chap.chapterId}
								whileTap={{ scale: 0.92 }}
								data-nav-chapter-id={chap.chapterId}
								onClick={(e) => {
									e.stopPropagation();
									triggerHaptic('selection');
									onJumpToChapter(chap.chapterId);
								}}
								className={`w-full py-1 px-0.5 rounded-full text-[10.5px] font-mono font-black tracking-tight flex items-center justify-center transition-all duration-150 cursor-pointer truncate ${activeClass}`}
								title={getChapterButtonTitle(chap.title, chap.chapterNumber)}
							>
								<span className="truncate">{chap.chapterNumber}</span>
							</motion.button>
						);
					})}
				</div>
			</div>
		);
	}

	return (
		<motion.button
			whileTap={{ scale: 0.94 }}
			onClick={(e) => {
				e.stopPropagation();
				triggerHaptic('selection');
				onOpenChapterSelect();
			}}
			className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/60 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all cursor-pointer font-mono font-black text-xs"
			title="Mở danh sách tất cả các chương"
		>
			<List size={14} strokeWidth={2.5} />
			<span>Ch. {currentChapterNumber ?? '-'}</span>
			{totalChapters ? <span className="text-[10px] opacity-70">/{totalChapters}</span> : null}
		</motion.button>
	);
}

interface QuickControlActionGroupProps {
	onOpenTranslation: () => void;
}

function QuickControlActionGroup({ onOpenTranslation }: QuickControlActionGroupProps) {
	const isOfflineMode = useAppStore((state) => state.isOfflineMode);
	const openSettings = useModalStore((state) => state.openSettings);

	return (
		<div className="relative z-10 flex items-center gap-1.5 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] p-1 rounded-full border border-primary/40 dark:border-primary/40 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4),_inset_0_-1px_1px_0_rgba(0,0,0,0.4)] shrink-0">
			<motion.button
				whileTap={{ scale: 0.88 }}
				onClick={(e) => {
					e.stopPropagation();
					triggerHaptic('light');
					openSettings('reader');
				}}
				className="w-8 h-8 rounded-full bg-white/10 border border-primary/50 text-on-surface shadow-[0_3px_10px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.4)] hover:text-primary hover:rotate-45 hover:bg-white/20 transition-all duration-300 cursor-pointer flex items-center justify-center"
				title="Cài đặt đọc sách"
			>
				<Settings size={17} />
			</motion.button>

			{!isOfflineMode && (
				<motion.button
					whileTap={{ scale: 0.88 }}
					onClick={(e) => {
						e.stopPropagation();
						triggerHaptic('light');
						onOpenTranslation();
					}}
					className="w-8 h-8 rounded-full bg-primary/25 border border-primary/60 text-primary shadow-[0_3px_10px_rgba(0,0,0,0.35),_inset_0_1px_1px_rgba(255,255,255,0.4)] hover:bg-primary/35 transition-all cursor-pointer flex items-center justify-center"
					title="Dịch AI"
				>
					<Sparkles size={17} />
				</motion.button>
			)}
		</div>
	);
}

export function ReaderQuickControl({
	bookId,
	currentChapterId,
	prevChapterId,
	nextChapterId,
	currentChapterNumber,
	totalChapters,
	isVisible = true,
	chapters,
	activeChapterId,
	onOpenChapterSelect,
	onOpenTranslation,
}: ReaderQuickControlProps) {
	const handleJumpToChapter = (chapterId: string) => {
		if (typeof document === 'undefined') return;
		const targetEl = document.getElementById(`chapter-section-${chapterId}`);
		if (targetEl && typeof targetEl.scrollIntoView === 'function') {
			targetEl.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		}
	};

	React.useEffect(() => {
		if (!activeChapterId) return;
		const activeBtn = document.querySelector(`[data-nav-chapter-id="${activeChapterId}"]`);
		if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
			activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		}
	}, [activeChapterId]);

	const visibilityClasses = isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-16 opacity-0 scale-95';

	return (
		<div
			aria-hidden="true"
			className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-50 w-full max-w-[420px] sm:max-w-md mx-auto px-3 sm:px-4 pointer-events-none box-border transition-all duration-300 cubic-bezier(0.16,1,0.3,1) ${visibilityClasses}`}
		>
			{/* Permanently Ultra-Translucent Pure Crystal Glass Dock Container */}
			<div
				onClick={(e) => e.stopPropagation()}
				className="relative bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] border border-white/25 dark:border-white/25 shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1.5px_1px_0_rgba(255,255,255,0.45),_inset_0_-1.5px_1px_0_rgba(0,0,0,0.4)] rounded-full px-3 py-1.5 flex items-center justify-between gap-2 pointer-events-auto transition-all duration-300"
			>
				{/* LEFT GROUP: macOS Control Center Joined Segment Capsule */}
				<QuickControlNavGroup
					bookId={bookId}
					currentChapterId={currentChapterId}
					activeChapterId={activeChapterId}
					prevChapterId={prevChapterId}
					nextChapterId={nextChapterId}
				/>

				{/* Vertical macOS Glass Separator Line */}
				<div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-primary/40 to-transparent shrink-0 mx-0.5" />

				{/* CENTER: Enclosed Glass Capsule Enclosure */}
				<div className="relative z-10 flex-1 flex items-center justify-center min-w-0 px-0.5">
					<div className="w-full flex items-center justify-center bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] p-1 rounded-full border border-primary/40 dark:border-primary/40 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4),_inset_0_-1px_1px_0_rgba(0,0,0,0.4)]">
						<QuickControlCenterGroup
							chapters={chapters}
							activeChapterId={activeChapterId}
							currentChapterNumber={currentChapterNumber}
							totalChapters={totalChapters}
							onOpenChapterSelect={onOpenChapterSelect}
							onJumpToChapter={handleJumpToChapter}
						/>
					</div>
				</div>

				{/* Vertical macOS Glass Separator Line */}
				<div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-primary/40 to-transparent shrink-0 mx-0.5" />

				{/* RIGHT GROUP: macOS Control Center Glass Spheres Capsule */}
				<QuickControlActionGroup onOpenTranslation={onOpenTranslation} />
			</div>
		</div>
	);
}
