import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useGlobalLoading } from '@/hooks/useGlobalLoading';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { clearAllCaches } from '@/shared/utils/cacheUtils';

import { ReaderActiveView, ReaderErrorView, ReaderLoadingView } from './components/ReaderContentViews';
import { useReaderAudioService, useReaderSwipeNavigation, useZenControls } from './hooks/useReaderInteractions';
import {
	useActiveChapterObserver,
	useChapterLoader,
	useEdgeReadAloudDetector,
	useReaderConfig,
	useReaderSheets,
	useTitleBarActions,
} from './hooks/useReaderState';
import {
	buildParagraphChapterContexts,
	computeAllParagraphs,
	computeDisplayChapters,
	getFontClass,
	isReaderPullDisabled,
	resolveReaderBookName,
	shouldShowReaderError,
	shouldShowReaderLoading,
} from './utils/readerHelpers';

export function ReaderScreen() {
	const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
	const navigate = useNavigate();

	const config = useReaderConfig();
	const fontClass = getFontClass(config.font);
	const { contentData, loading, domResetKey, error, forceFreshNextLoadRef, loadChapter } = useChapterLoader(chapterId, config);

	const [isRefreshingLatest, setIsRefreshingLatest] = useState(false);
	useGlobalLoading(isRefreshingLatest);
	const bookName = resolveReaderBookName(contentData);
	useDocumentTitle(bookName);

	const displayChapters = useMemo(() => computeDisplayChapters(contentData), [contentData]);
	const allParagraphs = useMemo(() => computeAllParagraphs(displayChapters), [displayChapters]);
	const paragraphChapterContexts = useMemo(
		() => buildParagraphChapterContexts(displayChapters, bookId, bookName),
		[displayChapters, bookId, bookName]
	);

	const { tts, bgm, handleStopTTS, handleToggleBgm } = useReaderAudioService({
		bookId,
		chapterId,
		contentData,
		displayChapters,
		allParagraphs,
		paragraphChapterContexts,
		config,
	});

	const hasContent = contentData !== null;
	useReadingProgress(bookId, chapterId, !loading && hasContent);

	const activeChapter = useActiveChapterObserver({ bookId, displayChapters });
	const zen = useZenControls();
	const { setShowZenControls } = zen;
	const handleNearBottom = useCallback(() => setShowZenControls(true), [setShowZenControls]);
	const handleScrollVisibilityChange = useCallback((visible: boolean) => setShowZenControls(visible), [setShowZenControls]);

	const sheets = useReaderSheets();
	const hasEdgeReadAloud = useEdgeReadAloudDetector();
	const { handleTitleSingleClick, handleTitleDoubleClick } = useTitleBarActions({
		bookId,
		chapterId,
		activeChapterId: activeChapter?.chapterId,
		isRefreshingLatest,
		setIsRefreshingLatest,
		tts,
		handleStopTTS,
		loadChapter,
		forceFreshNextLoadRef,
	});

	const handlePullRefresh = useCallback(async () => {
		tts.clearResumePosition();
		handleStopTTS();
		await clearAllCaches();
		await loadChapter(true);
	}, [tts, handleStopTTS, loadChapter]);

	const swipe = useReaderSwipeNavigation({ bookId, chapterId, contentData, loading, isRefreshingLatest });
	const pullDisabled = isReaderPullDisabled(loading, isRefreshingLatest, tts.isTTSActive);

	if (shouldShowReaderLoading(loading, hasContent)) {
		return <ReaderLoadingView fontClass={fontClass} bookId={bookId} onOpenHistory={sheets.handleOpenHistory} />;
	}

	if (shouldShowReaderError(error, hasContent)) {
		return (
			<ReaderErrorView
				error={error}
				onRefresh={handlePullRefresh}
				onRetry={loadChapter}
				onHome={() => navigate('/')}
				pullDisabled={pullDisabled}
			/>
		);
	}

	return (
		<ReaderActiveView
			fontClass={fontClass}
			pullDisabled={pullDisabled}
			bookId={bookId}
			chapterId={chapterId}
			contentData={contentData}
			displayChapters={displayChapters}
			activeChapter={activeChapter}
			onNearBottom={handleNearBottom}
			onScrollVisibilityChange={handleScrollVisibilityChange}
			isRefreshingLatest={isRefreshingLatest}
			hasEdgeReadAloud={hasEdgeReadAloud}
			config={config}
			tts={tts}
			bgm={bgm}
			zen={zen}
			swipe={swipe}
			domResetKey={domResetKey}
			showTranslateSheet={sheets.showTranslateSheet}
			showTypographySheet={sheets.showTypographySheet}
			showChapterSelectSheet={sheets.showChapterSelectSheet}
			showHistorySheet={sheets.showHistorySheet}
			onPullRefresh={handlePullRefresh}
			onStopTTS={handleStopTTS}
			onToggleBgm={handleToggleBgm}
			onOpenHistory={sheets.handleOpenHistory}
			onOpenChapterSelect={sheets.handleOpenChapterSelect}
			onOpenTranslation={sheets.handleOpenTranslation}
			onTitleClick={handleTitleSingleClick}
			onTitleDoubleClick={handleTitleDoubleClick}
			onCloseTranslate={sheets.handleCloseTranslation}
			onCloseTypography={sheets.handleCloseTypography}
			onCloseChapterSelect={sheets.handleCloseChapterSelect}
			onCloseHistory={sheets.handleCloseHistory}
			onTranslateSuccess={loadChapter}
		/>
	);
}
