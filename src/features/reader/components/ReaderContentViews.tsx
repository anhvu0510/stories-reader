import { AlertCircle, Home, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';

import { PullToRefresh } from '@/components/PullToRefresh';
import { TranslationSheet } from '@/components/TranslationSheet';
import { GlobalSettingsSheet } from '@/features/settings/GlobalSettingsSheet';
import { useFullscreen } from '@/hooks/useFullscreen';

import { checkNavDockVisible, computeChapterDisplayLabel, resolveViewingMetadata } from '../utils/readerHelpers';

import { ReaderScrollContent } from './ChapterContentSection';
import { QuickBookHistorySheet } from './QuickBookHistorySheet';
import { QuickChapterSelectSheet } from './QuickChapterSelectSheet';
import { QuickTypographySheet } from './QuickTypographySheet';
import { ReaderChapterSkeleton } from './ReaderChapterSkeleton';
import { ReaderHeader } from './ReaderHeader';
import { ReaderProgressHeader } from './ReaderProgressHeader';
import { ReaderQuickControl } from './ReaderQuickControl';
import { SelectionSpeakerTooltip } from './SelectionSpeakerTooltip';
import { VerticalBatchChapterNav } from './VerticalBatchChapterNav';

import type { useReaderSwipeNavigation, useZenControls } from '../hooks/useReaderInteractions';
import type { useReaderConfig } from '../hooks/useReaderState';
import type { useEdgeReadAloudBgm } from '@/hooks/useEdgeReadAloudBgm';
import type { useReadAloud } from '@/hooks/useReadAloud';
import type { ChapterContent, ChapterDetailItem } from '@/shared/types';

interface ReaderModalsProps {
	bookId?: string;
	chapterId?: string;
	activeChapter: { chapterId: string; chapterNumber: number; title: string } | null;
	chapterTitle: string;
	chapterNumber: number;
	displayChapters: ChapterDetailItem[];
	showTypographySheet: boolean;
	showChapterSelectSheet: boolean;
	showHistorySheet: boolean;
	showTranslateSheet: boolean;
	onCloseTypography: () => void;
	onCloseChapterSelect: () => void;
	onCloseHistory: () => void;
	onCloseTranslate: () => void;
	onTranslateSuccess: () => void;
}

function ReaderModals(props: ReaderModalsProps) {
	const currentChapId = props.activeChapter?.chapterId || props.chapterId;
	const currentChapNum = props.activeChapter?.chapterNumber ?? props.chapterNumber;

	const selectedChapters = useMemo(() => {
		if (props.displayChapters.length > 0) return props.displayChapters.map((c) => c.chapterId);
		if (props.chapterId) return [props.chapterId];
		return [];
	}, [props.displayChapters, props.chapterId]);

	return (
		<div aria-hidden="true">
			<GlobalSettingsSheet />
			{props.showTypographySheet && <QuickTypographySheet onClose={props.onCloseTypography} />}
			{props.showChapterSelectSheet && (
				<QuickChapterSelectSheet
					bookId={props.bookId || ''}
					currentChapterId={currentChapId}
					currentChapterNumber={currentChapNum}
					onClose={props.onCloseChapterSelect}
				/>
			)}
			{props.showHistorySheet && <QuickBookHistorySheet currentBookId={props.bookId} onClose={props.onCloseHistory} />}
			{props.showTranslateSheet && (
				<TranslationSheet
					currentBookId={props.bookId}
					currentChapterId={props.chapterId}
					currentChapterName={props.chapterTitle}
					currentChapterNumber={props.chapterNumber}
					initialTab="batch_chapter"
					initialSelectedChapters={selectedChapters}
					onClose={props.onCloseTranslate}
					onSuccess={props.onTranslateSuccess}
				/>
			)}
		</div>
	);
}

export function ReaderLoadingView({ fontClass, bookId, onOpenHistory }: { fontClass: string; bookId?: string; onOpenHistory: () => void }) {
	return (
		<div className={`min-h-dvh w-full bg-background text-on-background relative overflow-x-hidden ${fontClass}`}>
			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl lg:max-w-5xl h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />
			<ReaderHeader bookId={bookId || ''} progress={0} isVisible={true} onOpenHistory={onOpenHistory} />
			<div className="w-full max-w-4xl lg:max-w-5xl mx-auto">
				<ReaderChapterSkeleton />
			</div>
		</div>
	);
}

export function ReaderErrorView({
	error,
	onRefresh,
	onRetry,
	onHome,
	pullDisabled,
}: {
	error: string | null;
	onRefresh: () => void;
	onRetry: () => void;
	onHome: () => void;
	pullDisabled: boolean;
}) {
	return (
		<div className="min-h-dvh w-full bg-background flex flex-col items-center justify-center p-6 text-center">
			<div className="w-full max-w-md mx-auto flex flex-col items-center">
				<PullToRefresh onRefresh={onRefresh} disabled={pullDisabled} showIndicator={false} />
				<AlertCircle size={40} className="text-error mb-3" />
				<h2 className="text-sm font-bold text-on-surface mb-1">Không thể tải chương</h2>
				<p className="text-xs text-on-surface-variant max-w-xs mb-5">{error || 'Chương không tồn tại'}</p>

				<div className="flex items-center justify-center gap-3">
					<button
						onClick={onRetry}
						className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
					>
						<RotateCcw size={14} />
						<div>Thử tải lại</div>
					</button>

					<button
						onClick={onHome}
						className="px-4 py-2 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
					>
						<Home size={14} />
						<div>Về Trang chủ</div>
					</button>
				</div>
			</div>
		</div>
	);
}

function ReaderQuickControlDock({
	bookId,
	chapterId,
	navigation,
	currentViewingNumber,
	chapterDisplayLabel,
	displayChapters,
	activeChapterId,
	isVisible,
	onOpenChapterSelect,
	onOpenTranslation,
}: {
	bookId?: string;
	chapterId?: string;
	navigation?: ChapterContent['navigation'];
	currentViewingNumber: number;
	chapterDisplayLabel?: string;
	displayChapters: ChapterDetailItem[];
	activeChapterId?: string;
	isVisible: boolean;
	onOpenChapterSelect: () => void;
	onOpenTranslation: () => void;
}) {
	const prevChapterId = navigation?.prev?.chapterId;
	const nextChapterId = navigation?.next?.chapterId;

	return (
		<div aria-hidden="true">
			<ReaderQuickControl
				bookId={bookId || ''}
				currentChapterId={chapterId}
				prevChapterId={prevChapterId}
				nextChapterId={nextChapterId}
				currentChapterNumber={currentViewingNumber}
				chapterDisplayLabel={chapterDisplayLabel}
				chapters={displayChapters}
				activeChapterId={activeChapterId}
				isVisible={isVisible}
				onOpenChapterSelect={onOpenChapterSelect}
				onOpenTranslation={onOpenTranslation}
			/>
		</div>
	);
}

export interface ReaderActiveViewProps {
	fontClass: string;
	pullDisabled: boolean;
	bookId?: string;
	chapterId?: string;
	contentData: ChapterContent;
	displayChapters: ChapterDetailItem[];
	activeChapter: { chapterId: string; chapterNumber: number; title: string } | null;
	onNearBottom: () => void;
	onScrollVisibilityChange: (visible: boolean) => void;
	isRefreshingLatest: boolean;
	hasEdgeReadAloud: boolean;
	config: ReturnType<typeof useReaderConfig>;
	tts: ReturnType<typeof useReadAloud>;
	bgm: ReturnType<typeof useEdgeReadAloudBgm>;
	zen: ReturnType<typeof useZenControls>;
	swipe: ReturnType<typeof useReaderSwipeNavigation>;
	domResetKey: number;
	showTranslateSheet: boolean;
	showTypographySheet: boolean;
	showChapterSelectSheet: boolean;
	showHistorySheet: boolean;
	onPullRefresh: () => Promise<void>;
	onStopTTS: () => void;
	onToggleBgm: () => void;
	onOpenHistory: () => void;
	onOpenChapterSelect: () => void;
	onOpenTranslation: () => void;
	onTitleClick: () => void;
	onTitleDoubleClick: () => Promise<void>;
	onCloseTranslate: () => void;
	onCloseTypography: () => void;
	onCloseChapterSelect: () => void;
	onCloseHistory: () => void;
	onTranslateSuccess: () => void;
}

export function ReaderActiveView(props: ReaderActiveViewProps) {
	const { isFullscreen } = useFullscreen();
	const { chapter, navigation } = props.contentData;
	const { currentViewingTitle, currentViewingNumber } = resolveViewingMetadata(chapter, props.activeChapter);
	const chapterDisplayLabel = computeChapterDisplayLabel(props.displayChapters);
	const isChapterChanging = Boolean(props.chapterId && props.contentData.chapter.chapterId !== props.chapterId);
	const isNavDockVisible = checkNavDockVisible(
		props.zen.showZenControls,
		props.config.showTTSControlOnReader,
		props.tts.isTTSActive,
		props.hasEdgeReadAloud,
		isFullscreen
	);
	const activeChapterId = props.activeChapter?.chapterId;
	const safeBookId = props.bookId || '';
	const handleToggleTTS = () => (props.tts.isTTSActive ? props.onStopTTS() : props.tts.startReading());

	return (
		<div
			className={`min-h-dvh w-full bg-background text-on-background relative overflow-x-hidden hide-scrollbar no-scrollbar transition-colors duration-200 selection:bg-primary/25 selection:text-primary ${props.fontClass}`}
		>
			<PullToRefresh onRefresh={props.onPullRefresh} disabled={props.pullDisabled} showIndicator={false} />
			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl lg:max-w-5xl h-96 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent blur-3xl" />

			<ReaderProgressHeader
				bookId={safeBookId}
				bookName={chapter.bookName}
				chapterNumber={currentViewingNumber}
				chapterTitle={currentViewingTitle}
				displayChapters={props.displayChapters}
				activeChapter={props.activeChapter}
				onNearBottom={props.onNearBottom}
				onScrollVisibilityChange={props.onScrollVisibilityChange}
				isVisible={true}
				isTTSActive={props.tts.isTTSActive}
				isRefreshingLatest={props.isRefreshingLatest}
				onToggleTTS={handleToggleTTS}
				onOpenHistory={props.onOpenHistory}
				onTitleClick={props.onTitleClick}
				onTitleDoubleClick={props.onTitleDoubleClick}
			/>

			<VerticalBatchChapterNav
				chapters={props.displayChapters}
				activeChapterId={activeChapterId}
				isVisible={isNavDockVisible}
				hasEdgeReadAloud={props.hasEdgeReadAloud}
				isTTSActive={props.tts.isTTSActive}
				isTTSLoading={props.tts.isLoading}
				isTTSPlaying={props.tts.isPlaying}
				isBgmActive={props.bgm.isPlaying}
				showTTSControl={props.config.showTTSControlOnReader}
				onToggleBgm={props.onToggleBgm}
				currentParagraphIndex={props.tts.activeParagraphIndex}
				onToggleTTS={handleToggleTTS}
				onTTSPlay={props.tts.startReading}
				onTTSPause={props.tts.pauseReading}
				onTTSStop={props.onStopTTS}
				onTTSPrev={props.tts.prevSection}
				onTTSNext={props.tts.nextSection}
				onLocateReadingLine={props.tts.locateReadingLine}
			/>

			<ReaderScrollContent
				swipe={props.swipe}
				isChapterLoading={isChapterChanging}
				chapterId={props.chapterId}
				domResetKey={props.domResetKey}
				chapter={chapter}
				displayChapters={props.displayChapters}
				fontSize={props.config.fontSize}
				lineHeight={props.config.lineHeight}
				tts={props.tts}
				zen={props.zen}
			/>

			<ReaderQuickControlDock
				bookId={props.bookId}
				chapterId={props.chapterId}
				navigation={navigation}
				currentViewingNumber={currentViewingNumber}
				chapterDisplayLabel={chapterDisplayLabel}
				displayChapters={props.displayChapters}
				activeChapterId={activeChapterId}
				isVisible={props.zen.showZenControls}
				onOpenChapterSelect={props.onOpenChapterSelect}
				onOpenTranslation={props.onOpenTranslation}
			/>

			<ReaderModals
				bookId={props.bookId}
				chapterId={props.chapterId}
				activeChapter={props.activeChapter}
				chapterTitle={chapter.title}
				chapterNumber={chapter.chapterNumber}
				displayChapters={props.displayChapters}
				showTypographySheet={props.showTypographySheet}
				showChapterSelectSheet={props.showChapterSelectSheet}
				showHistorySheet={props.showHistorySheet}
				showTranslateSheet={props.showTranslateSheet}
				onCloseTypography={props.onCloseTypography}
				onCloseChapterSelect={props.onCloseChapterSelect}
				onCloseHistory={props.onCloseHistory}
				onCloseTranslate={props.onCloseTranslate}
				onTranslateSuccess={props.onTranslateSuccess}
			/>

			<SelectionSpeakerTooltip isTTSActive={props.tts.isTTSActive} onSpeak={props.tts.jumpToContent} />

			{props.zen.ripple && (
				<div
					key={props.zen.ripple.id}
					onAnimationEnd={() => props.zen.setRipple(null)}
					className="pointer-events-none fixed z-[99999] w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60 bg-primary/20 animate-ripple"
					style={{ left: props.zen.ripple.x, top: props.zen.ripple.y }}
				/>
			)}
		</div>
	);
}
