import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';

import { getAsyncButtonLabel, getSyncButtonLabel, type Tab } from '@/components/translation-sheet/translationHelpers';
import { useBatchSelectionHandlers, useTranslationActions } from '@/components/translation-sheet/useTranslationActions';
import { useTranslationBatchPagination, useTranslationOptions } from '@/components/translation-sheet/useTranslationSheet';
import { triggerHaptic } from '@/hooks/useHaptic';
import { BookRepository } from '@/repositories/BookRepository';

import type { Book } from '@/shared/types';

interface TranslationRouteState {
	currentChapterId?: string;
	currentChapterNumber?: number;
	initialSelectedChapters?: string[];
}

function useTranslationBookLoader(bookId?: string) {
	const [book, setBook] = useState<Book | null>(null);
	const [loadingBook, setLoadingBook] = useState(false);

	useEffect(() => {
		if (!bookId) {
			setBook(null);
			return;
		}
		let active = true;
		setLoadingBook(true);
		BookRepository.getBook(bookId)
			.then((res) => {
				if (active && res) setBook(res);
			})
			.catch((err) => {
				console.warn('[TranslationScreen] Load book error:', err);
			})
			.finally(() => {
				if (active) setLoadingBook(false);
			});
		return () => {
			active = false;
		};
	}, [bookId]);

	return { book, loadingBook };
}

function useBookSelectionHandlers(
	bookId: string | undefined,
	books: Book[],
	selectedBooks: Set<string>,
	setSelectedBooks: (next: Set<string>) => void
) {
	const toggleBook = useCallback(
		(id: string) => {
			triggerHaptic('selection');
			const next = new Set(selectedBooks);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			setSelectedBooks(next);
		},
		[selectedBooks, setSelectedBooks]
	);

	const handleSelectAllBooks = useCallback(() => {
		triggerHaptic('selection');
		// Nếu mở màn hình theo bookId cụ thể, nút "Tất cả" chỉ chọn đúng truyện đó để tránh dịch nhầm toàn bộ thư viện
		const scopedBooks = bookId ? books.filter((b) => b.bookId === bookId) : books;
		const allIds = new Set(scopedBooks.map((b) => b.bookId));
		setSelectedBooks(allIds);
	}, [books, bookId, setSelectedBooks]);

	const handleClearBooks = useCallback(() => {
		triggerHaptic('selection');
		setSelectedBooks(new Set());
	}, [setSelectedBooks]);

	return { toggleBook, handleSelectAllBooks, handleClearBooks };
}

export function useTranslationScreenState() {
	const { bookId } = useParams<{ bookId?: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const routeState = (location.state as TranslationRouteState | null) ?? null;
	const initialSelectedChapters = useMemo(() => routeState?.initialSelectedChapters ?? [], [routeState?.initialSelectedChapters]);

	const { book, loadingBook } = useTranslationBookLoader(bookId);
	const [activeTab, setActiveTab] = useState<Tab>(bookId ? 'batch_chapter' : 'story');
	const [chapterSearch, setChapterSearch] = useState('');

	const handleBack = useCallback(() => {
		triggerHaptic('light');
		if (location.key !== 'default' || window.history.length > 1) {
			navigate(-1);
			return;
		}
		navigate('/');
	}, [location.key, navigate]);

	const { options, setOptions, showConfig, setShowConfig, poolStatus, setPoolStatus, quotas } = useTranslationOptions(activeTab);

	const batch = useTranslationBatchPagination(activeTab, bookId, routeState?.currentChapterNumber, initialSelectedChapters);

	const actions = useTranslationActions({
		activeTab,
		currentBookId: bookId,
		currentChapterId: routeState?.currentChapterId,
		initialSelectedChapters,
		options,
		batch,
		onClose: handleBack,
		onSuccess: () => {
			if (bookId) {
				batch.loadInitialChapters();
			}
		},
	});

	const selection = useBatchSelectionHandlers(bookId, batch, actions.setIsSubmitting);
	const { toggleBook, handleSelectAllBooks, handleClearBooks } = useBookSelectionHandlers(
		bookId,
		actions.books,
		actions.selectedBooks,
		actions.setSelectedBooks
	);

	const handleRefresh = useCallback(() => {
		triggerHaptic('light');
		if (activeTab === 'batch_chapter') {
			batch.loadInitialChapters();
		}
	}, [activeTab, batch]);

	const syncButtonLabel = getSyncButtonLabel(
		actions.isSubmitting,
		actions.submittingType,
		activeTab,
		batch.selectedChapters.size,
		actions.selectedBooks.size
	);

	const asyncButtonLabel = getAsyncButtonLabel(
		actions.isSubmitting,
		actions.submittingType,
		activeTab,
		batch.selectedChapters.size,
		actions.selectedBooks.size
	);

	return {
		bookId,
		book,
		loadingBook,
		activeTab,
		setActiveTab,
		chapterSearch,
		setChapterSearch,
		handleBack,
		handleRefresh,
		options,
		setOptions,
		showConfig,
		setShowConfig,
		poolStatus,
		setPoolStatus,
		quotas,
		batch,
		actions,
		selection,
		toggleBook,
		handleSelectAllBooks,
		handleClearBooks,
		syncButtonLabel,
		asyncButtonLabel,
	};
}
