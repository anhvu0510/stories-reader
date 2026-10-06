import { offlineDb } from '@/lib/offlineDb';
import { apiClient } from '@/services/apiClient';
import { useAppStore } from '@/stores/useAppStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

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
}

async function syncOfflineLastReadBook(bookId: string, book: any): Promise<void> {
	const offlineBook = await offlineDb.getBook(bookId);
	if (!offlineBook || !book?.lastReadChapter) return;
	offlineBook.lastReadChapter = book.lastReadChapter;
	offlineBook.lastedReadAt = book.lastedReadAt || new Date().toISOString();
	await offlineDb.saveBook(offlineBook);
}

export const BookRepository = {
	async getBooks(
		page: number = 1,
		limit: number = 20,
		search?: string,
		tab?: string,
		sortBy: string = 'createdAt',
		sortOrder: string = 'DESC',
		tags?: string[],
		options?: GetBooksOptions
	): Promise<GetBooksResult> {
		const isOffline = useAppStore.getState().isOfflineMode;

		let allBooks: Book[] = [];
		if (isOffline) {
			allBooks = await offlineDb.getBooks();
		} else {
			try {
				const query = new URLSearchParams({
					page: page.toString(),
					limit: limit.toString(),
					sortBy,
					sortOrder
				});
				if (search) query.append('search', search);
				if (tab && tab !== 'ALL') {
					query.append('tab', tab);
					query.append('rootTab', tab.toLowerCase());
				}
				if (tags && tags.length > 0) {
					query.append('tags', tags.join(','));
				}
				if (options?.forceFresh) {
					query.append('_t', Date.now().toString());
				}

				const requestOptions: any = {
					timeout: 2500,
					retries: 0
				};
				if (options?.forceFresh) {
					requestOptions.headers = {
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						Pragma: 'no-cache'
					};
					requestOptions.cache = 'no-store';
				}

				const res = await apiClient.get<any>(`/api/books?${query.toString()}`, requestOptions);
				if (res) {
					const books = res.books || res.data || (Array.isArray(res) ? res : []);
					const pag = res.pagination || {};
					const total = pag.total ?? books.length;
					const totalPages = pag.totalPages ?? (Math.ceil(total / limit) || 1);
					const currentPage = pag.page ?? page;

					// Sync returned books to useFavoriteStore for offline mirror
					useFavoriteStore.getState().syncFromBooks(books);

					return {
						books,
						pagination: {
							currentPage,
							totalPages,
							total
						}
					};
				}
			} catch (e) {
				allBooks = await offlineDb.getBooks();
			}
		}

		// Offline / Client-side fallback filtering by tab
		if (tab === 'HISTORY') {
			allBooks = allBooks.filter((b) => Boolean(b.lastReadChapter || b.totalTranslated > 0));
		} else if (tab === 'AI') {
			allBooks = allBooks.filter((b) => b.totalPending > 0);
		} else if (tab === 'FAVORITE') {
			const favoriteIds = useFavoriteStore.getState().favoriteBookIds;
			allBooks = allBooks.filter((b) => b.isFavorite || favoriteIds.includes(b.bookId));
			allBooks.sort((a, b) => favoriteIds.indexOf(a.bookId) - favoriteIds.indexOf(b.bookId));
		}

		if (tags && tags.length > 0) {
			allBooks = allBooks.filter((b) => b.tags && tags.some((t) => b.tags?.includes(t)));
		}

		if (search) {
			const queryStr = search.toLowerCase();
			allBooks = allBooks.filter((b) => b.bookName.toLowerCase().includes(queryStr));
		}

		// Offline / Client-side fallback sorting
		const isAsc = sortOrder === 'ASC' || sortOrder === '1';
		const direction = isAsc ? 1 : -1;

		allBooks.sort((a, b) => {
			if (sortBy === 'bookName') {
				return (
					direction *
					(a.bookName || '').localeCompare(b.bookName || '', 'vi', {
						sensitivity: 'base'
					})
				);
			}
			if (sortBy === 'lastedReadAt') {
				const timeA = a.lastedReadAt ? new Date(a.lastedReadAt).getTime() : 0;
				const timeB = b.lastedReadAt ? new Date(b.lastedReadAt).getTime() : 0;
				return direction * (timeA - timeB);
			}
			if (sortBy === 'createdAt') {
				const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return direction * (timeA - timeB);
			}
			// default 'updatedAt'
			const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
			const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
			return direction * (timeA - timeB);
		});

		const total = allBooks.length;
		const totalPages = Math.ceil(total / limit) || 1;
		const paginated = allBooks.slice((page - 1) * limit, page * limit);

		return {
			books: paginated,
			pagination: {
				currentPage: page,
				totalPages,
				total
			}
		};
	},

	async toggleFavorite(bookId: string, isFavorite?: boolean): Promise<{ isFavorite: boolean; bookId: string }> {
		const isOffline = useAppStore.getState().isOfflineMode;

		if (!isOffline) {
			try {
				const payload = typeof isFavorite === 'boolean' ? { isFavorite } : {};
				const res = await apiClient.post<any>(`/api/books/${bookId}/favorite`, payload);
				const data = res?.data || res;
				const nextFavorite = data?.isFavorite ?? isFavorite ?? true;

				if (nextFavorite) {
					useFavoriteStore.getState().addFavorite(bookId);
				} else {
					useFavoriteStore.getState().removeFavorite(bookId);
				}

				const offlineBook = await offlineDb.getBook(bookId);
				if (offlineBook) {
					offlineBook.isFavorite = nextFavorite;
					await offlineDb.saveBook(offlineBook);
				}

				return { bookId, isFavorite: nextFavorite };
			} catch (e) {
				console.warn('API toggle favorite failed, fallback to local store:', e);
			}
		}

		// Offline mode / Fallback
		const currentFav = useFavoriteStore.getState().isFavorite(bookId);
		const nextFavorite = typeof isFavorite === 'boolean' ? isFavorite : !currentFav;

		if (nextFavorite) {
			useFavoriteStore.getState().addFavorite(bookId);
		} else {
			useFavoriteStore.getState().removeFavorite(bookId);
		}

		const offlineBook = await offlineDb.getBook(bookId);
		if (offlineBook) {
			offlineBook.isFavorite = nextFavorite;
			await offlineDb.saveBook(offlineBook);
		}

		return { bookId, isFavorite: nextFavorite };
	},

	async getBook(bookId: string, options?: { forceFresh?: boolean }): Promise<Book | undefined> {
		const isOffline = useAppStore.getState().isOfflineMode;
		if (isOffline) {
			return await offlineDb.getBook(bookId);
		}
		try {
			let url = `/api/books?bookId=${encodeURIComponent(bookId)}&limit=1`;
			const requestOptions: any = { timeout: 10000, retries: 0 };
			if (options?.forceFresh) {
				url += `&_t=${Date.now()}`;
				requestOptions.headers = {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache'
				};
				requestOptions.cache = 'no-store';
			}
			const data = await apiClient.get<any>(url, requestOptions);
			const books = data?.books || data?.data || (Array.isArray(data) ? data : []);
			const book = books.length > 0 ? books[0] : data?.book || data;
			if (book && book.bookId) {
				useFavoriteStore.getState().syncFromBooks([book]);
				await offlineDb.saveBook(book).catch(() => {});
				return book;
			}
		} catch (e) {
			if (options?.forceFresh) {
				throw new Error('Không thể tải thông tin truyện từ máy chủ');
			}
			return await offlineDb.getBook(bookId);
		}
		return await offlineDb.getBook(bookId);
	},

	async getLastReadChapter(bookId: string, options?: { forceFresh?: boolean }): Promise<{ chapterId: string; chapterNumber?: number; title?: string } | null> {
		const isOffline = useAppStore.getState().isOfflineMode;

		if (!isOffline) {
			try {
				let url = `/api/books?bookId=${encodeURIComponent(bookId)}&limit=1`;
				const requestOptions: any = { timeout: 4000, retries: 0, silent: true };
				if (options?.forceFresh) {
					url += `&_t=${Date.now()}`;
					requestOptions.headers = {
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						Pragma: 'no-cache'
					};
					requestOptions.cache = 'no-store';
				}
				const res = await apiClient.get<any>(url, requestOptions);
				const books = res?.books || res?.data || (Array.isArray(res) ? res : []);
				const book = books.length > 0 ? books[0] : res?.book || null;

				if (book?.lastReadChapter?.chapterId) {
					await syncOfflineLastReadBook(bookId, book);
					return {
						chapterId: book.lastReadChapter.chapterId,
						chapterNumber: typeof book.lastReadChapter.chapterNumber === 'number' ? book.lastReadChapter.chapterNumber : parseInt(book.lastReadChapter.chapterNumber, 10) || 1,
						title: book.lastReadChapter.title || `Chương ${book.lastReadChapter.chapterNumber || 1}`
					};
				}
			} catch (e: any) {
				console.warn('Failed to fetch last read chapter online:', e);
				if (options?.forceFresh) {
					throw new Error(e?.message || 'Không thể lấy thông tin chương đọc gần nhất từ máy chủ');
				}
			}
		}

		if (options?.forceFresh && isOffline) {
			throw new Error('Đang ở chế độ offline, không thể tải từ máy chủ');
		}

		const offlineBook = await offlineDb.getBook(bookId);
		if (!offlineBook?.lastReadChapter?.chapterId) return null;
		return {
			chapterId: offlineBook.lastReadChapter.chapterId,
			chapterNumber: typeof offlineBook.lastReadChapter.chapterNumber === 'number' ? offlineBook.lastReadChapter.chapterNumber : parseInt(offlineBook.lastReadChapter.chapterNumber, 10) || 1,
			title: offlineBook.lastReadChapter.title || `Chương ${offlineBook.lastReadChapter.chapterNumber || 1}`
		};
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

		const lastedReadAt = new Date().toISOString();
		const offlineBook = await offlineDb.getBook(bookId);
		if (offlineBook) {
			offlineBook.lastReadChapter = {
				chapterId: lastRead.chapterId,
				chapterNumber: lastRead.chapterNumber,
				title: lastRead.title || `Chương ${lastRead.chapterNumber}`
			};
			offlineBook.lastedReadAt = lastedReadAt;
			await offlineDb.saveBook(offlineBook);
		}

		const isOffline = useAppStore.getState().isOfflineMode;
		if (!isOffline) {
			try {
				await apiClient.post(
					`/api/books/${encodeURIComponent(bookId)}/last-read`,
					{
						chapterId: lastRead.chapterId,
						chapterNumber: lastRead.chapterNumber,
						title: lastRead.title
					},
					{ silent: true, timeout: 3000, retries: 0 }
				);
			} catch (e) {
				console.warn('Failed to sync lastReadChapter to server:', e);
			}
		}
	}
};
