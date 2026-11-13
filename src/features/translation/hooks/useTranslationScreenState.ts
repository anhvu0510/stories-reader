import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getAsyncButtonLabel, getSyncButtonLabel, type Tab } from '@/components/translation-sheet/translationHelpers';
import { useBatchSelectionHandlers, useTranslationActions } from '@/components/translation-sheet/useTranslationActions';
import { useTranslationBatchPagination, useTranslationOptions } from '@/components/translation-sheet/useTranslationSheet';
import { triggerHaptic } from '@/hooks/useHaptic';
import { BookRepository } from '@/repositories/BookRepository';

import type { Book } from '@/shared/types';

export function useTranslationScreenState() {
	const { bookId } = useParams<{ bookId?: string }>();
	const navigate = useNavigate();

	const [book, setBook] = useState<Book | null>(null);
	const [loadingBook, setLoadingBook] = useState(false);
	const [activeTab, setActiveTab] = useState<Tab>(bookId ? 'batch_chapter' : 'story');
	const [chapterSearch, setChapterSearch] = useState('');

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

	const handleBack = useCallback(() => {
		triggerHaptic('light');
		if (window.history.length > 1) {
			navigate(-1);
		} else {
			navigate('/');
		}
	}, [navigate]);

	const { options, setOptions, showConfig, setShowConfig, poolStatus, setPoolStatus, quotas } = useTranslationOptions(activeTab);

	const batch = useTranslationBatchPagination(activeTab, bookId, undefined, undefined);

	const actions = useTranslationActions({
		activeTab,
		currentBookId: bookId,
		initialSelectedChapters: [],
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

	const handleRefresh = useCallback(() => {
		triggerHaptic('light');
		if (activeTab === 'batch_chapter') {
			batch.loadInitialChapters();
		}
	}, [activeTab, batch]);

	const toggleBook = useCallback(
		(id: string) => {
			triggerHaptic('selection');
			const next = new Set(actions.selectedBooks);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			actions.setSelectedBooks(next);
		},
		[actions]
	);

	const handleSelectAllBooks = useCallback(() => {
		triggerHaptic('selection');
		const allIds = new Set(actions.books.map((b) => b.bookId));
		actions.setSelectedBooks(allIds);
	}, [actions]);

	const handleClearBooks = useCallback(() => {
		triggerHaptic('selection');
		actions.setSelectedBooks(new Set());
	}, [actions]);

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
