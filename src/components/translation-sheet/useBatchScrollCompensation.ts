import { useCallback, useEffect, useLayoutEffect } from 'react';

import type { Tab } from './translationHelpers';
import type { Chapter } from '@/shared/types';
import type React from 'react';

export interface BatchScrollCompensationProps {
	activeTab: Tab;
	loading: boolean;
	loadingTop: boolean;
	hasMoreTop: boolean;
	chapters: Chapter[];
	chapterListRef: React.RefObject<HTMLDivElement | null>;
	activeItemRef: React.RefObject<HTMLDivElement | null>;
	isInitialScrollDoneRef: React.MutableRefObject<boolean>;
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>;
	fetchPrevTopPageRef: React.MutableRefObject<() => void>;
}

export function useBatchScrollCompensation({
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
}: BatchScrollCompensationProps) {
	const scrollToActive = useCallback(() => {
		if (!activeItemRef.current || !chapterListRef.current) return;
		const container = chapterListRef.current;
		const activeEl = activeItemRef.current;
		const containerRect = container.getBoundingClientRect();
		const activeRect = activeEl.getBoundingClientRect();
		container.scrollTop = Math.max(0, container.scrollTop + (activeRect.top - containerRect.top));
	}, [activeItemRef, chapterListRef]);

	useLayoutEffect(() => {
		if (!pendingPrependScrollRef.current || !chapterListRef.current) return;
		const { prevHeight, prevTop } = pendingPrependScrollRef.current;
		pendingPrependScrollRef.current = null;
		chapterListRef.current.scrollTop = prevTop + (chapterListRef.current.scrollHeight - prevHeight);
	}, [chapters, pendingPrependScrollRef, chapterListRef]);

	useLayoutEffect(() => {
		if (activeTab !== 'batch_chapter' || loading || chapters.length === 0 || isInitialScrollDoneRef.current) return;
		isInitialScrollDoneRef.current = true;
		scrollToActive();
		requestAnimationFrame(() => {
			scrollToActive();
			setTimeout(scrollToActive, 50);
			setTimeout(scrollToActive, 150);
		});
	}, [activeTab, loading, chapters, scrollToActive, isInitialScrollDoneRef]);

	useEffect(() => {
		if (
			activeTab !== 'batch_chapter' ||
			loading ||
			loadingTop ||
			!hasMoreTop ||
			!isInitialScrollDoneRef.current ||
			!chapterListRef.current
		) {
			return;
		}
		const { scrollHeight, clientHeight } = chapterListRef.current;
		if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) fetchPrevTopPageRef.current();
	}, [activeTab, loading, loadingTop, hasMoreTop, chapters.length, isInitialScrollDoneRef, chapterListRef, fetchPrevTopPageRef]);
}
