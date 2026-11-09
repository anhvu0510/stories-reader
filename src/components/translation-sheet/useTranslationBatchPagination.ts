import { useCallback, useRef, useState } from 'react';

import { ChapterRepository } from '@/repositories/ChapterRepository';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

import { applyInitialBatchChapters, loadNextBatchBottom, loadPrevBatchTop, shouldSkipFetchPrevTop, type Tab } from './translationHelpers';
import { useBatchScrollCompensation } from './useBatchScrollCompensation';

import type { Chapter } from '@/shared/types';
import type React from 'react';

interface BatchPageFetchersParams {
	activeTab: Tab;
	currentBookId: string | undefined;
	configChapterLimit: number;
	loading: boolean;
	loadingTop: boolean;
	loadingBottom: boolean;
	hasMoreTop: boolean;
	hasMoreBottom: boolean;
	minChapterNum: number;
	maxChapterNum: number;
	chapterListRef: React.RefObject<HTMLDivElement | null>;
	isInitialScrollDoneRef: React.MutableRefObject<boolean>;
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>;
	fetchPrevTopPageRef: React.MutableRefObject<() => void>;
	setLoadingTop: React.Dispatch<React.SetStateAction<boolean>>;
	setLoadingBottom: React.Dispatch<React.SetStateAction<boolean>>;
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>;
	setMinChapterNum: React.Dispatch<React.SetStateAction<number>>;
	setMaxChapterNum: React.Dispatch<React.SetStateAction<number>>;
	setHasMoreTop: React.Dispatch<React.SetStateAction<boolean>>;
	setHasMoreBottom: React.Dispatch<React.SetStateAction<boolean>>;
}

function useBatchPageFetchers(params: BatchPageFetchersParams) {
	const {
		activeTab,
		currentBookId,
		configChapterLimit,
		loading,
		loadingTop,
		loadingBottom,
		hasMoreTop,
		hasMoreBottom,
		minChapterNum,
		maxChapterNum,
		chapterListRef,
		isInitialScrollDoneRef,
		pendingPrependScrollRef,
		fetchPrevTopPageRef,
		setLoadingTop,
		setLoadingBottom,
		setChapters,
		setMinChapterNum,
		setMaxChapterNum,
		setHasMoreTop,
		setHasMoreBottom,
	} = params;

	const fetchPrevTopPage = async () => {
		if (shouldSkipFetchPrevTop(loadingTop, hasMoreTop, minChapterNum, currentBookId, isInitialScrollDoneRef.current)) return;
		setLoadingTop(true);
		const container = chapterListRef.current;
		try {
			await loadPrevBatchTop(
				currentBookId!,
				configChapterLimit,
				minChapterNum,
				container,
				pendingPrependScrollRef,
				setChapters,
				setMinChapterNum,
				setHasMoreTop
			);
		} catch {
			// Ignore
		} finally {
			setLoadingTop(false);
		}
	};
	fetchPrevTopPageRef.current = fetchPrevTopPage;

	const fetchNextBottomPage = async () => {
		if (loadingBottom || !hasMoreBottom || !currentBookId || !isInitialScrollDoneRef.current) return;
		setLoadingBottom(true);
		try {
			await loadNextBatchBottom(currentBookId, configChapterLimit, maxChapterNum, setChapters, setMaxChapterNum, setHasMoreBottom);
		} catch {
			// Ignore
		} finally {
			setLoadingBottom(false);
		}
	};

	const handleScroll = () => {
		if (!chapterListRef.current || loading || activeTab !== 'batch_chapter' || !isInitialScrollDoneRef.current) return;
		const { scrollTop, clientHeight, scrollHeight } = chapterListRef.current;
		if (scrollTop + clientHeight >= scrollHeight - 300) fetchNextBottomPage();
		if (scrollTop <= 80) fetchPrevTopPage();
	};

	return { handleScroll };
}

export function useTranslationBatchPagination(
	activeTab: Tab,
	currentBookId: string | undefined,
	currentChapterNumber: number | undefined,
	initialSelectedChapters: string[]
) {
	const configChapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);
	const [chapters, setChapters] = useState<Chapter[]>([]);
	const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set(initialSelectedChapters));
	const [showOnlyPending, setShowOnlyPending] = useState(false);
	const [rangeStart, setRangeStart] = useState('');
	const [rangeEnd, setRangeEnd] = useState('');
	const [loading, setLoading] = useState(false);
	const [loadingTop, setLoadingTop] = useState(false);
	const [loadingBottom, setLoadingBottom] = useState(false);
	const [hasMoreTop, setHasMoreTop] = useState(false);
	const [hasMoreBottom, setHasMoreBottom] = useState(true);
	const [minChapterNum, setMinChapterNum] = useState<number>(1);
	const [maxChapterNum, setMaxChapterNum] = useState<number>(1);

	const chapterListRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLDivElement>(null);
	const isInitialScrollDoneRef = useRef(false);
	const pendingPrependScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
	const fetchPrevTopPageRef = useRef<() => void>(() => {});

	const loadInitialChapters = useCallback(async () => {
		if (activeTab !== 'batch_chapter' || !currentBookId) return;
		setLoading(true);
		isInitialScrollDoneRef.current = false;
		const startChapterNumber = currentChapterNumber ? Math.max(1, currentChapterNumber - 5) : 1;
		const endChapterNumber = currentChapterNumber ? currentChapterNumber + configChapterLimit : undefined;
		try {
			const res = await ChapterRepository.getChapters(
				currentBookId,
				1,
				configChapterLimit,
				'chapterNumber',
				'ASC',
				'all',
				'',
				startChapterNumber,
				endChapterNumber
			);
			applyInitialBatchChapters(
				res?.chapters || [],
				configChapterLimit,
				setChapters,
				setMinChapterNum,
				setMaxChapterNum,
				setHasMoreTop,
				setHasMoreBottom
			);
		} catch {
			setChapters([]);
		} finally {
			setLoading(false);
		}
	}, [activeTab, currentBookId, currentChapterNumber, configChapterLimit]);

	useBatchScrollCompensation({
		activeTab,
		loading,
		loadingTop,
		hasMoreTop,
		chapters,
		chapterListRef,
		activeItemRef,
		isInitialScrollDoneRef,
		pendingPrependScrollRef,
		fetchPrevTopPageRef,
	});

	const { handleScroll } = useBatchPageFetchers({
		activeTab,
		currentBookId,
		configChapterLimit,
		loading,
		loadingTop,
		loadingBottom,
		hasMoreTop,
		hasMoreBottom,
		minChapterNum,
		maxChapterNum,
		chapterListRef,
		isInitialScrollDoneRef,
		pendingPrependScrollRef,
		fetchPrevTopPageRef,
		setLoadingTop,
		setLoadingBottom,
		setChapters,
		setMinChapterNum,
		setMaxChapterNum,
		setHasMoreTop,
		setHasMoreBottom,
	});

	return {
		chapters,
		setChapters,
		selectedChapters,
		setSelectedChapters,
		showOnlyPending,
		setShowOnlyPending,
		rangeStart,
		setRangeStart,
		rangeEnd,
		setRangeEnd,
		hasMoreTop,
		setHasMoreTop,
		hasMoreBottom,
		setHasMoreBottom,
		setMinChapterNum,
		setMaxChapterNum,
		chapterListRef,
		activeItemRef,
		loadInitialChapters,
		handleScroll,
	};
}
