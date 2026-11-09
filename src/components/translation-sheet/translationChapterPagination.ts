import { ChapterRepository } from '@/repositories/ChapterRepository';

import type { Chapter } from '@/shared/types';
import type React from 'react';

export type Tab = 'current' | 'batch_chapter' | 'story';

export function parseRangeInputs(rangeStart: string, rangeEnd: string): { start: number; end: number } | null {
	const start = parseInt(rangeStart, 10);
	const end = parseInt(rangeEnd, 10);
	if (isNaN(start) || isNaN(end) || start > end || start < 1) {
		return null;
	}
	return { start, end };
}

export function scrollToChapterElement(container: HTMLDivElement | null, chapterNumber: number) {
	if (!container) return;
	const firstEl = container.querySelector(`#chapter-item-${chapterNumber}`);
	if (!firstEl) return;
	const containerRect = container.getBoundingClientRect();
	const activeRect = firstEl.getBoundingClientRect();
	const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top);
	container.scrollTop = Math.max(0, targetScrollTop);
}

export function shouldSkipFetchPrevTop(
	loadingTop: boolean,
	hasMoreTop: boolean,
	minChapterNum: number,
	currentBookId?: string,
	isInitialScrollDone?: boolean
): boolean {
	if (loadingTop || !hasMoreTop || minChapterNum <= 1) return true;
	if (!currentBookId || !isInitialScrollDone) return true;
	return false;
}

export function mergePrependedChapters(prev: Chapter[], newChapters: Chapter[]) {
	const existingIds = new Set(prev.map((c) => c.chapterId));
	const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
	return [...uniqueNew, ...prev];
}

export function getSyncButtonLabel(
	isSubmitting: boolean,
	submittingType: 'sync' | 'async' | null,
	activeTab: Tab,
	selectedChaptersCount: number,
	selectedBooksCount: number
): string {
	if (isSubmitting && submittingType === 'sync') return 'Đang Dịch...';
	if (activeTab === 'current') return 'Dịch';
	if (activeTab === 'batch_chapter') return `Dịch (${selectedChaptersCount})`;
	return `Dịch (${selectedBooksCount})`;
}

export function getAsyncButtonLabel(
	isSubmitting: boolean,
	submittingType: 'sync' | 'async' | null,
	activeTab: Tab,
	selectedChaptersCount: number,
	selectedBooksCount: number
): string {
	if (isSubmitting && submittingType === 'async') return 'Đang Đẩy Queue...';
	if (activeTab === 'current') return 'Dịch Queue';
	if (activeTab === 'batch_chapter') return `Dịch Batch (${selectedChaptersCount})`;
	return `Dịch Batch (${selectedBooksCount})`;
}

export function getTabButtonClass(active: boolean, disabled?: boolean): string {
	if (disabled) return 'opacity-30 cursor-not-allowed bg-transparent text-on-surface-variant';
	if (active) return 'bg-primary/20 text-primary font-black border border-primary/50 shadow-xs';
	return 'text-on-surface-variant/80 hover:text-on-surface border border-transparent cursor-pointer';
}

export function getChapterBadgeClass(isSelected: boolean, state?: string): string {
	if (isSelected) {
		return 'bg-primary/30 border-primary/70 text-primary font-extrabold';
	}
	if (state === 'SUCCEEDED') {
		return 'bg-primary/15 text-primary border-primary/30';
	}
	return 'bg-white/10 text-on-surface-variant border-white/20';
}

export function getContainerScroll(container: HTMLDivElement | null) {
	if (!container) return { prevHeight: 0, prevTop: 0 };
	return { prevHeight: container.scrollHeight, prevTop: container.scrollTop };
}

export function updatePrependState(
	newChapters: Chapter[],
	container: HTMLDivElement | null,
	scroll: { prevHeight: number; prevTop: number },
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setMinChapterNum: React.Dispatch<React.SetStateAction<number>>,
	setHasMoreTop: React.Dispatch<React.SetStateAction<boolean>>
) {
	if (newChapters.length === 0) {
		setHasMoreTop(false);
		return;
	}
	if (container) {
		pendingPrependScrollRef.current = scroll;
	}
	setChapters((prev) => mergePrependedChapters(prev, newChapters));
	const newMin = Math.min(...newChapters.map((c) => c.chapterNumber));
	setMinChapterNum(newMin);
	setHasMoreTop(newMin > 1);
}

export async function loadNextBatchBottom(
	currentBookId: string,
	limit: number,
	maxChapterNum: number,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setMaxChapterNum: React.Dispatch<React.SetStateAction<number>>,
	setHasMoreBottom: React.Dispatch<React.SetStateAction<boolean>>
) {
	const res = await ChapterRepository.getChapters(currentBookId, 1, limit, 'chapterNumber', 'ASC', 'all', '', maxChapterNum + 1);
	const newChapters = res?.chapters || [];
	if (newChapters.length === 0) {
		setHasMoreBottom(false);
		return;
	}
	setChapters((prev) => {
		const existingIds = new Set(prev.map((c) => c.chapterId));
		return [...prev, ...newChapters.filter((c) => !existingIds.has(c.chapterId))];
	});
	setMaxChapterNum(Math.max(...newChapters.map((c) => c.chapterNumber)));
	setHasMoreBottom(newChapters.length >= limit);
}

export async function loadPrevBatchTop(
	currentBookId: string,
	limit: number,
	minChapterNum: number,
	container: HTMLDivElement | null,
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setMinChapterNum: React.Dispatch<React.SetStateAction<number>>,
	setHasMoreTop: React.Dispatch<React.SetStateAction<boolean>>
) {
	const scroll = getContainerScroll(container);
	const res = await ChapterRepository.getChapters(
		currentBookId,
		1,
		limit,
		'chapterNumber',
		'ASC',
		'all',
		'',
		Math.max(1, minChapterNum - limit),
		minChapterNum - 1
	);
	updatePrependState(res?.chapters ?? [], container, scroll, pendingPrependScrollRef, setChapters, setMinChapterNum, setHasMoreTop);
}

export function applyInitialBatchChapters(
	newChapters: Chapter[],
	limit: number,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setMinChapterNum: React.Dispatch<React.SetStateAction<number>>,
	setMaxChapterNum: React.Dispatch<React.SetStateAction<number>>,
	setHasMoreTop: React.Dispatch<React.SetStateAction<boolean>>,
	setHasMoreBottom: React.Dispatch<React.SetStateAction<boolean>>
) {
	setChapters(newChapters);
	if (newChapters.length === 0) {
		setHasMoreTop(false);
		setHasMoreBottom(false);
		return;
	}
	const minNum = Math.min(...newChapters.map((c) => c.chapterNumber));
	const maxNum = Math.max(...newChapters.map((c) => c.chapterNumber));
	setMinChapterNum(minNum);
	setMaxChapterNum(maxNum);
	setHasMoreTop(minNum > 1);
	setHasMoreBottom(newChapters.length >= limit);
}
