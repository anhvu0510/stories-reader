import { isEdgeReadAloudActive } from '@/hooks/useEdgeReadAloudBgm';
import { offlineDb } from '@/lib/offlineDb';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { hasNativeReaderGestures } from '@/services/nativeReaderGestures';

import type { ChapterContent, ChapterDetailItem } from '@/shared/types';
import type React from 'react';

const FONT_STYLE_MAP: Record<string, string> = {
	bookerly: 'font-bookerly',
	merriweather: 'font-merriweather',
	lora: 'font-lora',
	charter: 'font-charter',
	palatino: 'font-palatino',
	font_viet_tay: 'font-viet-tay',
};

export function getFontClass(font: string): string {
	return FONT_STYLE_MAP[font] || 'font-default';
}

export function computeDisplayChapters(contentData: ChapterContent | null): ChapterDetailItem[] {
	if (contentData?.chapters && contentData.chapters.length > 0) {
		return contentData.chapters;
	}
	if (contentData?.chapter) {
		return [contentData.chapter];
	}
	return [];
}

export function computeChapterDisplayLabel(displayChapters: ChapterDetailItem[]): string | undefined {
	if (displayChapters.length <= 1) return undefined;
	const first = displayChapters[0].chapterNumber;
	const last = displayChapters[displayChapters.length - 1].chapterNumber;
	return `${first} - ${last}`;
}

export function isTouchMoved(touch: React.Touch | undefined, startPos: { x: number; y: number } | null): boolean {
	if (!touch || !startPos) return false;
	const deltaX = Math.abs(touch.clientX - startPos.x);
	const deltaY = Math.abs(touch.clientY - startPos.y);
	return deltaX > 10 || deltaY > 10;
}

export function hasTextSelection(): boolean {
	if (typeof window === 'undefined') return false;
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed || !selection.toString().trim()) {
		return false;
	}
	if (isEdgeReadAloudActive()) {
		const anchorNode = selection.anchorNode;
		const parent = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
		if (parent?.closest('.msreadout-word-highlight, .msreadout-line-highlight, msreadoutspan')) {
			return false;
		}
	}
	return true;
}

function scrollElementIntoView(el: Element | null): boolean {
	if (!el || typeof el.scrollIntoView !== 'function') return false;
	el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	return true;
}

export function locateActiveReadingElement(activeParagraphIndex: number, isTTSPlayingOrPaused: boolean): void {
	if (typeof document === 'undefined') return;

	const highlightEl = document.querySelector(
		'.msreadout-line-highlight, .msreadout-word-highlight, .msreadout-highlight, msreadoutspan, [class*="msreadout"], [data-readout-highlight]'
	);
	if (scrollElementIntoView(highlightEl)) return;

	if (isTTSPlayingOrPaused && activeParagraphIndex >= 0) {
		const paragraphEl = document.querySelector(`[data-paragraph-index="${activeParagraphIndex}"]`);
		scrollElementIntoView(paragraphEl);
	}
}

export interface ResolvedChapterTarget {
	chapterId: string;
	chapterNumber?: number;
	title?: string;
}

async function fetchServerLastRead(bookId: string): Promise<ResolvedChapterTarget | null> {
	try {
		const lastRead = await BookRepository.getLastReadChapter(bookId, { forceFresh: true });
		if (lastRead?.chapterId) return lastRead;
	} catch (err) {
		console.warn('[ReaderScreen] Không thể lấy lastRead từ server, thử fallback sang latest:', err);
	}
	return null;
}

async function fetchServerLatest(bookId: string): Promise<ResolvedChapterTarget | null> {
	try {
		const latest = await ChapterRepository.getLatestChapter(bookId, { forceFresh: true });
		if (latest?.chapterId) return latest;
	} catch (err) {
		console.warn('[ReaderScreen] Không thể lấy latest từ server, thử fallback sang offlineDb:', err);
	}
	return null;
}

async function fetchOfflineLastRead(bookId: string): Promise<ResolvedChapterTarget | null> {
	try {
		const offlineBook = await offlineDb.getBook(bookId);
		const lastRead = offlineBook?.lastReadChapter;
		if (!lastRead?.chapterId) return null;
		const chapterNumber =
			typeof lastRead.chapterNumber === 'number' ? lastRead.chapterNumber : parseInt(String(lastRead.chapterNumber), 10) || 1;
		return { chapterId: lastRead.chapterId, chapterNumber, title: lastRead.title };
	} catch (err) {
		console.warn('[ReaderScreen] Không thể lấy book từ offlineDb:', err);
		return null;
	}
}

export async function resolveLatestReadingChapter(bookId: string): Promise<ResolvedChapterTarget | null> {
	const lastRead = await fetchServerLastRead(bookId);
	if (lastRead) return lastRead;

	const latest = await fetchServerLatest(bookId);
	if (latest) return latest;

	return fetchOfflineLastRead(bookId);
}

export function computeDragOffset(offset: number, hasPrev: boolean, hasNext: boolean): number {
	const isOverscrollingStart = !hasPrev && offset > 0;
	const isOverscrollingEnd = !hasNext && offset < 0;
	if (isOverscrollingStart || isOverscrollingEnd) {
		return offset * 0.25;
	}
	return offset;
}

function formatNavChapterHint(navItem?: { title?: string; chapterNumber?: number }): string | undefined {
	if (!navItem) return undefined;
	if (navItem.title) return navItem.title;
	if (navItem.chapterNumber) return `Chương ${navItem.chapterNumber}`;
	return undefined;
}

export function resolvePendingTitleHint(
	swipeDirection: 'left' | 'right' | null,
	dragOffset: number,
	nav?: ChapterContent['navigation']
): string | undefined {
	if (swipeDirection === 'left' || dragOffset < 0) {
		return formatNavChapterHint(nav?.next);
	}
	if (swipeDirection === 'right' || dragOffset > 0) {
		return formatNavChapterHint(nav?.prev);
	}
	return undefined;
}

export function applySettledDragTransform(contentEl: HTMLDivElement | null, settled?: 'left' | 'right' | 'cancel') {
	if (!contentEl) return;
	if (settled === 'left') {
		contentEl.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
		contentEl.style.transform = 'translate3d(-100%, 0, 0)';
		return;
	}
	if (settled === 'right') {
		contentEl.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
		contentEl.style.transform = 'translate3d(100%, 0, 0)';
		return;
	}
	contentEl.style.transition = 'transform 240ms cubic-bezier(0.25, 1, 0.5, 1)';
	contentEl.style.transform = 'translate3d(0px, 0, 0)';
}

export function getSwipeCommitThreshold(): number {
	const width = typeof window === 'undefined' ? 390 : Math.min(window.innerWidth || 390, 448);
	return Math.max(90, Math.round(width * 0.3));
}

export function buildParagraphChapterContexts(displayChapters: ChapterDetailItem[], bookId?: string, bookName?: string) {
	return displayChapters.flatMap((chap) =>
		(chap.content || []).map(() => ({
			bookId: bookId || chap.bookId,
			bookName: bookName || chap.bookName,
			chapterId: chap.chapterId,
			chapterNumber: chap.chapterNumber,
			chapterTitle: chap.title,
		}))
	);
}

function resolveTargetBookId(bookId?: string, firstChap?: ChapterDetailItem): string | undefined {
	if (bookId) return bookId;
	return firstChap?.bookId;
}

function resolveTargetBookName(chapter?: ChapterDetailItem, firstChap?: ChapterDetailItem): string | undefined {
	if (chapter && chapter.bookName) return chapter.bookName;
	return firstChap?.bookName;
}

function resolveTargetChapterId(chapterId?: string, firstChap?: ChapterDetailItem): string | undefined {
	if (chapterId) return chapterId;
	return firstChap?.chapterId;
}

function resolveTargetTitle(chapter?: ChapterDetailItem, firstChap?: ChapterDetailItem): string | undefined {
	if (chapter && chapter.title) return chapter.title;
	return firstChap?.title;
}

export function buildChapterTarget(
	firstChap: ChapterDetailItem | undefined,
	bookId?: string,
	chapterId?: string,
	chapter?: ChapterDetailItem
) {
	return {
		bookId: resolveTargetBookId(bookId, firstChap),
		bookName: resolveTargetBookName(chapter, firstChap),
		chapterId: resolveTargetChapterId(chapterId, firstChap),
		chapterNumber: firstChap?.chapterNumber,
		chapterTitle: resolveTargetTitle(chapter, firstChap),
	};
}

export function resolveViewingMetadata(
	chapter: ChapterDetailItem,
	activeChapter: { title: string; chapterNumber: number; chapterId: string } | null
) {
	const currentViewingTitle = activeChapter?.title || chapter.title;
	const currentViewingNumber = activeChapter?.chapterNumber ?? chapter.chapterNumber;
	return { currentViewingTitle, currentViewingNumber };
}

export function checkNavDockVisible(
	showZenControls: boolean,
	showTTSControl: boolean,
	isTTSActive: boolean,
	hasEdgeReadAloud: boolean
): boolean {
	if (isTTSActive || hasEdgeReadAloud) return true;
	if (!showZenControls) return false;
	return showTTSControl;
}

export function computeAllParagraphs(displayChapters: ChapterDetailItem[]): string[] {
	return displayChapters.flatMap((chap) => chap.content || []);
}

export function resolveReaderBookName(contentData: ChapterContent | null): string | undefined {
	return contentData?.chapter?.bookName;
}

export function isReaderPullDisabled(loading: boolean, isRefreshing: boolean, isTTSActive: boolean): boolean {
	if (loading || isRefreshing) return true;
	return Boolean(hasNativeReaderGestures() && isTTSActive);
}

export function shouldShowReaderLoading(loading: boolean, hasContent: boolean): boolean {
	return loading && !hasContent;
}

export function shouldShowReaderError(error: string | null, hasContent: boolean): boolean {
	return Boolean(error || !hasContent);
}
