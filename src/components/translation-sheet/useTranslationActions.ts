import { useEffect, useRef, useState } from 'react';

import { AIRepository } from '@/repositories/AIRepository';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { useToastStore } from '@/stores/useToastStore';

import {
	buildAsyncTranslatePayload,
	executeAsyncTranslate,
	executeSyncTranslate,
	parseRangeInputs,
	scrollToChapterElement,
	type Tab,
	type TranslationOptions,
	validateSubmitParams,
} from './translationHelpers';

import type { useTranslationBatchPagination } from './useTranslationSheet';
import type { Book, Chapter } from '@/shared/types';

function useTabDataSync(
	activeTab: Tab,
	currentBookId: string | undefined,
	searchBook: string,
	loadInitialChapters: () => Promise<void>,
	setBooks: (books: Book[]) => void
) {
	useEffect(() => {
		let t: NodeJS.Timeout;
		if (activeTab === 'batch_chapter' && currentBookId) {
			loadInitialChapters();
		} else if (activeTab === 'story') {
			const fetchStoryBooks = () => {
				BookRepository.getBooks(1, 9999, searchBook)
					.then((res) => setBooks(res?.books ?? []))
					.catch((err) => {
						console.warn('Failed to fetch books for translation:', err);
						setBooks([]);
					});
			};
			if (searchBook) {
				t = setTimeout(fetchStoryBooks, 300);
			} else {
				fetchStoryBooks();
			}
		}
		return () => clearTimeout(t);
	}, [activeTab, currentBookId, searchBook, loadInitialChapters, setBooks]);
}

function resolveTargetBookId(activeTab: Tab, selectedBooks: Set<string>, currentBookId?: string): string | undefined {
	if (activeTab === 'story' && selectedBooks.size > 0) {
		const firstBook = Array.from(selectedBooks)[0];
		return typeof firstBook === 'string' ? firstBook : undefined;
	}
	return currentBookId;
}

interface UseTranslationActionsProps {
	activeTab: Tab;
	currentBookId?: string;
	currentChapterId?: string;
	initialSelectedChapters: string[];
	options: TranslationOptions;
	batch: ReturnType<typeof useTranslationBatchPagination>;
	onClose: () => void;
	onSuccess?: () => void;
}

export function useTranslationActions({
	activeTab,
	currentBookId,
	currentChapterId,
	initialSelectedChapters,
	options,
	batch,
	onClose,
	onSuccess,
}: UseTranslationActionsProps) {
	const showToast = useToastStore((state) => state.showToast);
	const [books, setBooks] = useState<Book[]>([]);
	const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
	const [searchBook, setSearchBook] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submittingType, setSubmittingType] = useState<'sync' | 'async' | null>(null);
	const isSubmittingRef = useRef(false);

	useTabDataSync(activeTab, currentBookId, searchBook, batch.loadInitialChapters, setBooks);

	const handleDetectProperNouns = () => {
		const targetBookId = resolveTargetBookId(activeTab, selectedBooks, currentBookId);
		if (!targetBookId) {
			showToast('Vui lòng chọn truyện trước khi thực hiện', 'error');
			return;
		}
		showToast('Đã gửi yêu cầu xử lý', 'success');
		AIRepository.detectProperNouns({
			bookId: targetBookId,
			model: options.model,
			platform: options.platform || (options.model?.includes('deepseek') ? 'DEPLOYAI' : 'AI_STUDIO'),
		}).catch((e: unknown) => {
			console.warn('detectProperNouns bg error:', e);
		});
	};

	const handleTranslateChineseTitles = () => {
		const targetBookId = resolveTargetBookId(activeTab, selectedBooks, currentBookId);
		if (!targetBookId) {
			showToast('Vui lòng chọn truyện trước khi thực hiện', 'error');
			return;
		}
		showToast('Đã gửi yêu cầu xử lý', 'success');
		AIRepository.translateChineseTitles({
			bookId: targetBookId,
			model: options.model,
			platform: options.platform || (options.model?.includes('deepseek') ? 'DEPLOYAI' : 'AI_STUDIO'),
		}).catch((e: unknown) => {
			console.warn('translateChineseTitles bg error:', e);
		});
	};

	const handleSubmit = async (isSync = false) => {
		if (isSubmittingRef.current) return;
		isSubmittingRef.current = true;
		setIsSubmitting(true);
		setSubmittingType(isSync ? 'sync' : 'async');

		const chapterIdToUse = initialSelectedChapters[0] || currentChapterId;
		const validationError = validateSubmitParams(activeTab, chapterIdToUse, batch.selectedChapters.size, selectedBooks.size, options.model);
		if (validationError) {
			showToast(validationError, 'error');
			setIsSubmitting(false);
			isSubmittingRef.current = false;
			setSubmittingType(null);
			return;
		}

		const platform = options.platform || (options.model?.includes('deepseek') ? 'DEPLOYAI' : 'AI_STUDIO');
		try {
			if (isSync) {
				await executeSyncTranslate(
					activeTab,
					options,
					platform,
					currentBookId,
					chapterIdToUse,
					batch.selectedChapters,
					selectedBooks,
					showToast,
					onClose,
					onSuccess
				);
			} else {
				const payload = buildAsyncTranslatePayload(
					activeTab,
					options,
					platform,
					currentBookId,
					chapterIdToUse,
					batch.selectedChapters,
					selectedBooks,
					initialSelectedChapters
				);
				await executeAsyncTranslate(activeTab, payload, showToast, onClose, batch.selectedChapters.size, selectedBooks.size);
			}
		} catch (e: unknown) {
			console.error(e);
			const msg = e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại';
			showToast(msg, 'error');
		} finally {
			setIsSubmitting(false);
			isSubmittingRef.current = false;
			setSubmittingType(null);
		}
	};

	return {
		books,
		selectedBooks,
		setSelectedBooks,
		searchBook,
		setSearchBook,
		isSubmitting,
		setIsSubmitting,
		submittingType,
		handleDetectProperNouns,
		handleTranslateChineseTitles,
		handleSubmit,
	};
}

export function useBatchSelectionHandlers(
	currentBookId: string | undefined,
	batch: ReturnType<typeof useTranslationBatchPagination>,
	setIsSubmitting: (val: boolean) => void
) {
	const showToast = useToastStore((state) => state.showToast);

	const toggleChapter = (id: string) => {
		const next = new Set(batch.selectedChapters);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		batch.setSelectedChapters(next);
	};

	const handleSelectRange = async () => {
		const range = parseRangeInputs(batch.rangeStart, batch.rangeEnd);
		if (!range) {
			showToast('Phạm vi không hợp lệ', 'error');
			return;
		}
		const { start, end } = range;
		if (!currentBookId) return;

		try {
			const limit = Math.max(50, end - start + 1);
			const res = await ChapterRepository.getChapters(currentBookId, 1, limit, 'chapterNumber', 'ASC', 'all', '', start, end);
			const fetchedChapters = res?.chapters || [];

			let allChapters: Chapter[] = [];
			batch.setChapters((prev) => {
				const existingIds = new Set(prev.map((c) => c.chapterId));
				const uniqueNew = fetchedChapters.filter((c) => !existingIds.has(c.chapterId));
				const combined = [...prev, ...uniqueNew].sort((a, b) => a.chapterNumber - b.chapterNumber);
				allChapters = combined;
				if (combined.length > 0) {
					batch.setMinChapterNum(Math.min(...combined.map((c) => c.chapterNumber)));
					batch.setMaxChapterNum(Math.max(...combined.map((c) => c.chapterNumber)));
				}
				return combined;
			});

			const pool = fetchedChapters.length > 0 ? fetchedChapters : allChapters;
			const chaptersInRange = pool.filter((c) => c.chapterNumber >= start && c.chapterNumber <= end);
			if (chaptersInRange.length === 0) {
				showToast('Không tìm thấy chương nào trong phạm vi này', 'error');
				return;
			}
			batch.setSelectedChapters((prev) => {
				const newSet = new Set(prev);
				chaptersInRange.forEach((c) => newSet.add(c.chapterId));
				return newSet;
			});
			showToast(`Đã chọn ${chaptersInRange.length} chương (Chương ${start} - ${end})`, 'success');
			setTimeout(() => scrollToChapterElement(batch.chapterListRef.current, start), 100);
		} catch {
			showToast('Có lỗi xảy ra khi tải dải chương', 'error');
		}
	};

	const handleSelectAll = async () => {
		if (!currentBookId) return;
		batch.setShowOnlyPending(false);
		if (!batch.hasMoreTop && !batch.hasMoreBottom && batch.chapters.length > 0) {
			batch.setSelectedChapters(new Set(batch.chapters.map((c) => c.chapterId)));
			showToast(`Đã chọn tất cả ${batch.chapters.length} chương`, 'success');
			return;
		}
		setIsSubmitting(true);
		showToast('Đang tải tất cả chương...', 'info');
		try {
			const res = await ChapterRepository.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC', 'all');
			const allList = res?.chapters || [];
			if (allList.length > 0) {
				batch.setChapters(allList);
				batch.setSelectedChapters(new Set(allList.map((c) => c.chapterId)));
				batch.setMinChapterNum(Math.min(...allList.map((c) => c.chapterNumber)));
				batch.setMaxChapterNum(Math.max(...allList.map((c) => c.chapterNumber)));
				batch.setHasMoreTop(false);
				batch.setHasMoreBottom(false);
				showToast(`Đã chọn tất cả ${allList.length} chương`, 'success');
			}
		} catch {
			showToast('Có lỗi xảy ra khi tải danh sách chương', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSelectPending = async () => {
		if (!currentBookId) return;
		batch.setShowOnlyPending(true);
		if (!batch.hasMoreTop && !batch.hasMoreBottom && batch.chapters.length > 0) {
			const pendingList = batch.chapters.filter((c) => c.state === 'PENDING' || c.state === 'FAILED');
			batch.setSelectedChapters(new Set(pendingList.map((c) => c.chapterId)));
			showToast(`Đã chọn ${pendingList.length} chương chưa dịch`, 'success');
			return;
		}
		setIsSubmitting(true);
		showToast('Đang tải chương chưa dịch...', 'info');
		try {
			const res = await ChapterRepository.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC', 'all');
			const allList = res?.chapters || [];
			if (allList.length > 0) {
				batch.setChapters(allList);
				const pendingList = allList.filter((c) => c.state === 'PENDING' || c.state === 'FAILED');
				batch.setSelectedChapters(new Set(pendingList.map((c) => c.chapterId)));
				batch.setMinChapterNum(Math.min(...allList.map((c) => c.chapterNumber)));
				batch.setMaxChapterNum(Math.max(...allList.map((c) => c.chapterNumber)));
				batch.setHasMoreTop(false);
				batch.setHasMoreBottom(false);
				showToast(`Đã chọn ${pendingList.length} chương chưa dịch`, 'success');
			}
		} catch {
			showToast('Có lỗi xảy ra khi tải danh sách chương', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		toggleChapter,
		handleSelectRange,
		handleSelectAll,
		handleSelectPending,
	};
}
