import React, { memo, useMemo } from 'react';

import { ParagraphView } from './ParagraphView';
import { ReaderChapterSkeleton } from './ReaderChapterSkeleton';

import type { useReaderSwipeNavigation, useZenControls } from '../hooks/useReaderInteractions';
import type { useReadAloud } from '@/hooks/useReadAloud';
import type { ChapterDetailItem } from '@/shared/types';

interface ChapterContentSectionProps {
	chapters: ChapterDetailItem[];
	fontSize: number;
	lineHeight: number;
	isPlaying: boolean;
	isPaused: boolean;
	currentParagraphIndex: number;
	contentRef?: React.Ref<HTMLElement>;
	isDragging?: boolean;
	onDoubleClick: (e: React.MouseEvent) => void;
	onTouchStart?: (e: React.TouchEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

interface ChapterParagraphsProps {
	chapterId: string;
	content: string[];
	offset: number;
	isPlaying: boolean;
	isPaused: boolean;
	currentParagraphIndex: number;
	onDoubleClick?: (e: React.MouseEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

function ChapterParagraphs({
	chapterId,
	content,
	offset,
	isPlaying,
	isPaused,
	currentParagraphIndex,
	onDoubleClick,
	onTouchEnd,
}: ChapterParagraphsProps) {
	const items = useMemo(
		() =>
			(content || []).map((paragraphHtml, index) => ({
				id: `${chapterId}-p-${offset + index}`,
				index: offset + index,
				content: paragraphHtml,
			})),
		[chapterId, content, offset]
	);

	return (
		<>
			{items.map((item) => {
				const isTTSActive = (isPlaying || isPaused) && currentParagraphIndex === item.index;
				return (
					<ParagraphView
						key={item.id}
						index={item.index}
						content={item.content}
						isTTSActive={isTTSActive}
						onDoubleClick={onDoubleClick}
						onTouchEnd={onTouchEnd}
					/>
				);
			})}
		</>
	);
}

export const ChapterContentSection = memo(function ChapterContentSection({
	chapters,
	fontSize,
	lineHeight,
	isPlaying,
	isPaused,
	currentParagraphIndex,
	contentRef,
	isDragging,
	onDoubleClick,
	onTouchStart,
	onTouchEnd,
}: ChapterContentSectionProps) {
	const paragraphOffsets = useMemo(
		() => chapters.map((_, chapterIndex) => chapters.slice(0, chapterIndex).reduce((total, chapter) => total + chapter.content.length, 0)),
		[chapters]
	);

	return (
		<main
			id="main-story-content"
			role="main"
			ref={contentRef}
			onClick={(e) => {
				const target = e.target as HTMLElement | null;
				if (target?.closest('[data-paragraph-index]')) {
					if (target.closest('a, button, select, input')) return;
					e.stopPropagation();
				}
			}}
			onPointerUp={(e) => {
				const target = e.target as HTMLElement | null;
				if (target?.closest('[data-paragraph-index]')) {
					if (target.closest('a, button, select, input')) return;
					e.stopPropagation();
				}
			}}
			onDoubleClick={onDoubleClick}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			className={`w-full relative z-10 bg-background pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.25rem)] sm:pt-24 pb-24 select-text ${isDragging ? 'will-change-transform' : ''}`}
		>
			{chapters.map((chap, chapIdx) => {
				const chapterTitleText = chap.title?.toLowerCase().startsWith('chương')
					? chap.title
					: `Chương ${chap.chapterNumber}: ${chap.title}`;
				return (
					<div
						key={chap.chapterId || `chap-${chap.chapterNumber}`}
						id={`chapter-section-${chap.chapterId}`}
						data-chapter-id={chap.chapterId}
						data-chapter-number={chap.chapterNumber}
						data-chapter-title={chap.title}
						className="chapter-block-section scroll-mt-16 mb-0 px-4 sm:px-6 md:px-8 select-text"
						style={{ fontSize: `${fontSize}px`, lineHeight }}
					>
						{chapIdx > 0 && (
							<div aria-hidden="true" className="mt-8 mb-6 flex items-center gap-3 select-none">
								<div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent" />
								<div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.8)] border border-white/40" />
								<div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/30 dark:via-white/20 to-transparent" />
							</div>
						)}

						<h2 className="mb-3 pt-0.5 text-base sm:text-lg font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2">
							<div
								aria-hidden="true"
								className="w-1 h-4 rounded-full bg-primary inline-block shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
							/>
							<div>{chapterTitleText}</div>
						</h2>

						<ChapterParagraphs
							chapterId={chap.chapterId}
							content={chap.content}
							offset={paragraphOffsets[chapIdx]}
							isPlaying={isPlaying}
							isPaused={isPaused}
							currentParagraphIndex={currentParagraphIndex}
							onDoubleClick={onDoubleClick}
							onTouchEnd={onTouchEnd}
						/>
					</div>
				);
			})}
		</main>
	);
});

export const ReaderScrollContent = memo(function ReaderScrollContent({
	swipe,
	isChapterLoading,
	chapterId,
	domResetKey,
	chapter,
	displayChapters,
	fontSize,
	lineHeight,
	tts,
	zen,
}: {
	swipe: ReturnType<typeof useReaderSwipeNavigation>;
	isChapterLoading: boolean;
	chapterId?: string;
	domResetKey: number;
	chapter: ChapterDetailItem;
	displayChapters: ChapterDetailItem[];
	fontSize: number;
	lineHeight: number;
	tts: ReturnType<typeof useReadAloud>;
	zen: ReturnType<typeof useZenControls>;
}) {
	return (
		<div className="relative w-full max-w-4xl lg:max-w-5xl mx-auto">
			{swipe.isDragging && (
				<div
					aria-hidden="true"
					className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-90 transition-opacity duration-150"
				>
					<ReaderChapterSkeleton titleHint={swipe.pendingTitleHint} />
				</div>
			)}

			{isChapterLoading ? (
				<div
					key={`loading-skeleton-${chapterId}`}
					ref={swipe.readerContentRef as React.Ref<HTMLDivElement>}
					className={`w-full relative z-10 bg-background ${swipe.isDragging ? 'will-change-transform' : ''}`}
				>
					<ReaderChapterSkeleton titleHint={swipe.pendingTitleHint} />
				</div>
			) : (
				<ChapterContentSection
					key={`${chapter.chapterId}-${domResetKey}`}
					chapters={displayChapters}
					fontSize={fontSize}
					lineHeight={lineHeight}
					isPlaying={tts.isPlaying}
					isPaused={tts.isPaused}
					currentParagraphIndex={tts.activeParagraphIndex}
					contentRef={swipe.readerContentRef}
					isDragging={swipe.isDragging}
					onDoubleClick={zen.handleDoubleClick}
					onTouchStart={zen.handleTouchStart}
					onTouchEnd={zen.handleTouchEnd}
				/>
			)}
		</div>
	);
});
