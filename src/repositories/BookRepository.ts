import { offlineDb } from '@/lib/offlineDb';
import { apiClient } from '@/services/apiClient';
import { useAppStore } from '@/stores/useAppStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

import {
	buildLastReadTargetBook,
	buildSingleBookRequest,
	compareBooks,
	extractBookFromApiResponse,
	fetchOnlineBooks,
	fetchOnlineLastReadChapter,
	filterOfflineBooks,
	parseLastReadChapter,
	resolveGetBooksParams,
	updateLocalFavorite,
	type ApiSingleBookResponse,
} from './bookRepositoryHelpers';

import type { Book } from '@/shared/types';

export interface GetBooksResult {
	books: Book[];
	pagination: {
		currentPage: number;
		totalPages: number;
		total: number;
	};
}

export interface GetBooksOptions {
	forceFresh?: boolean;
	timeout?: number;
}

export const BookRepository = {
	async getBooks(
		rawPage?: number,
		rawLimit?: number,
		search?: string,
		tab?: string,
		rawSortBy?: string,
		rawSortOrder?: string,
		tags?: string[],
		options?: GetBooksOptions
	): Promise<GetBooksResult> {
		const { page, limit, sortBy, sortOrder } = resolveGetBooksParams(rawPage, rawLimit, rawSortBy, rawSortOrder);
		const isOffline = useAppStore.getState().isOfflineMode;

		if (!isOffline) {
			try {
				const onlineResult = await fetchOnlineBooks(page, limit, sortBy, sortOrder, search, tab, tags, options);
				if (onlineResult) {
					return onlineResult;
				}
			} catch {
				// Fallback to offlineDb
			}
		}

		let allBooks = await offlineDb.getBooks();
		allBooks = filterOfflineBooks(allBooks, tab, tags, search);

		const isAsc = sortOrder === 'ASC' || sortOrder === '1';
		const direction = isAsc ? 1 : -1;
		allBooks.sort((a, b) => compareBooks(a, b, sortBy, direction));

		const total = allBooks.length;
		const totalPages = Math.ceil(total / limit) || 1;
		const paginated = allBooks.slice((page - 1) * limit, page * limit);

		return {
			books: paginated,
			pagination: {
				currentPage: page,
				totalPages,
				total,
			},
		};
	},

	async toggleFavorite(bookId: string, isFavorite?: boolean): Promise<{ isFavorite: boolean; bookId: string }> {
		const isOffline = useAppStore.getState().isOfflineMode;

		if (!isOffline) {
			try {
				const payload = typeof isFavorite === 'boolean' ? { isFavorite } : {};
				const res = await apiClient.post<{ data?: { isFavorite?: boolean }; isFavorite?: boolean }>(
					`/api/books/${bookId}/favorite`,
					payload
				);
				const data = res?.data || res;
				const nextFavorite = data?.isFavorite ?? isFavorite ?? true;

				await updateLocalFavorite(bookId, nextFavorite);
				return { bookId, isFavorite: nextFavorite };
			} catch (e) {
				console.warn('API toggle favorite failed, fallback to local store:', e);
			}
		}

		// Offline mode / Fallback
		const currentFav = useFavoriteStore.getState().isFavorite(bookId);
		const nextFavorite = typeof isFavorite === 'boolean' ? isFavorite : !currentFav;
		await updateLocalFavorite(bookId, nextFavorite);

		return { bookId, isFavorite: nextFavorite };
	},

	async getBook(bookId: string, options?: { forceFresh?: boolean }): Promise<Book | undefined> {
		if (useAppStore.getState().isOfflineMode) {
			return await offlineDb.getBook(bookId);
		}
		try {
			const { url, requestOptions } = buildSingleBookRequest(bookId, options, 10000);
			const data = await apiClient.get<ApiSingleBookResponse>(url, requestOptions);
			const book = extractBookFromApiResponse(data);
			if (book && book.bookId) {
				useFavoriteStore.getState().syncFromBooks([book]);
				await offlineDb.saveBook(book).catch(() => {});
				return book;
			}
		} catch (_e) {
			if (options?.forceFresh) {
				throw new Error('Không thể tải thông tin truyện từ máy chủ', { cause: _e });
			}
			return await offlineDb.getBook(bookId);
		}
		return await offlineDb.getBook(bookId);
	},

	async getLastReadChapter(
		bookId: string,
		options?: { forceFresh?: boolean }
	): Promise<{ chapterId: string; chapterNumber?: number; title?: string } | null> {
		const isOffline = useAppStore.getState().isOfflineMode;

		if (options?.forceFresh && isOffline) {
			throw new Error('Đang ở chế độ offline, không thể tải từ máy chủ');
		}

		if (!isOffline) {
			const onlineChapter = await fetchOnlineLastReadChapter(bookId, options);
			if (onlineChapter) {
				return onlineChapter;
			}
		}

		const offlineBook = await offlineDb.getBook(bookId);
		return parseLastReadChapter(offlineBook?.lastReadChapter);
	},

	async deleteBook(bookId: string): Promise<boolean> {
		const isOffline = useAppStore.getState().isOfflineMode;
		if (!isOffline) {
			try {
				await apiClient.delete(`/api/books/${bookId}`);
			} catch (e) {
				console.warn('API delete book error:', e);
			}
		}
		await offlineDb.deleteBook(bookId);
		return true;
	},

	async saveBookOffline(book: Book): Promise<void> {
		await offlineDb.saveBook(book);
	},

	async updateLastReadChapter(bookId: string, lastRead: { chapterId: string; chapterNumber: number; title?: string }): Promise<void> {
		if (!bookId || !lastRead?.chapterId) return;

		const offlineBook = await offlineDb.getBook(bookId);
		const targetBook = buildLastReadTargetBook(bookId, lastRead, offlineBook);
		await offlineDb.saveBook(targetBook);

		const isOffline = useAppStore.getState().isOfflineMode;
		if (isOffline) return;

		try {
			await apiClient.post(
				`/api/books/${encodeURIComponent(bookId)}/last-read`,
				{
					chapterId: lastRead.chapterId,
					chapterNumber: lastRead.chapterNumber,
					title: lastRead.title,
				},
				{ silent: true, timeout: 3000, retries: 0 }
			);
		} catch (e) {
			console.warn('Failed to sync lastReadChapter to server:', e);
		}
	},
};
