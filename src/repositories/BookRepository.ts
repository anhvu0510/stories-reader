import { offlineDb } from '@/lib/offlineDb';
import { apiClient, type RequestOptions } from '@/services/apiClient';
import { useAppStore } from '@/stores/useAppStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

import type { Book, LastReadChapter } from '@/shared/types';

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

interface ApiBookListResponse {
	books?: Book[];
	data?: Book[];
	pagination?: {
		total?: number;
		totalPages?: number;
		page?: number;
	};
}

interface ApiSingleBookResponse {
	books?: Book[];
	data?: Book[] | Book;
	book?: Book;
}

async function syncOfflineLastReadBook(
	bookId: string,
	book: { lastReadChapter?: Book['lastReadChapter']; lastedReadAt?: string } | null
): Promise<void> {
	const offlineBook = await offlineDb.getBook(bookId);
	if (!offlineBook || !book?.lastReadChapter) return;
	offlineBook.lastReadChapter = book.lastReadChapter;
	offlineBook.lastedReadAt = book.lastedReadAt || new Date().toISOString();
	await offlineDb.saveBook(offlineBook);
}

async function updateLocalFavorite(bookId: string, nextFavorite: boolean): Promise<void> {
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
}

function parseLastReadChapter(lastRead?: LastReadChapter | null) {
	if (!lastRead?.chapterId) return null;
	const chapterNumber =
		typeof lastRead.chapterNumber === 'number' ? lastRead.chapterNumber : parseInt(String(lastRead.chapterNumber), 10) || 1;
	const title = lastRead.title || `Chương ${chapterNumber}`;
	return { chapterId: lastRead.chapterId, chapterNumber, title };
}

function buildLastReadTargetBook(
	bookId: string,
	lastRead: { chapterId: string; chapterNumber: number; title?: string },
	existingBook?: Book | null
): Book {
	const lastedReadAt = new Date().toISOString();
	const chapterTitle = lastRead.title || `Chương ${lastRead.chapterNumber}`;
	const lastReadChapter: LastReadChapter = {
		chapterId: lastRead.chapterId,
		chapterNumber: lastRead.chapterNumber,
		title: chapterTitle,
	};

	if (existingBook) {
		return {
			...existingBook,
			lastReadChapter,
			lastedReadAt,
		};
	}

	return {
		bookId,
		bookName: chapterTitle,
		chapterCount: lastRead.chapterNumber || 1,
		totalTranslated: lastRead.chapterNumber || 1,
		totalPending: 0,
		createdAt: lastedReadAt,
		updatedAt: lastedReadAt,
		lastReadChapter,
		lastedReadAt,
	};
}

function getBookTimestamp(book: Book, field: 'lastedReadAt' | 'createdAt' | 'updatedAt'): number {
	const raw = field === 'updatedAt' ? book.updatedAt || book.createdAt : book[field];
	return raw ? new Date(raw).getTime() : 0;
}

function compareBooks(a: Book, b: Book, sortBy: string, direction: number): number {
	if (sortBy === 'bookName') {
		return (
			direction *
			(a.bookName || '').localeCompare(b.bookName || '', 'vi', {
				sensitivity: 'base',
			})
		);
	}
	if (sortBy === 'lastedReadAt' || sortBy === 'createdAt') {
		return direction * (getBookTimestamp(a, sortBy) - getBookTimestamp(b, sortBy));
	}
	return direction * (getBookTimestamp(a, 'updatedAt') - getBookTimestamp(b, 'updatedAt'));
}

function filterOfflineBooks(books: Book[], tab?: string, tags?: string[], search?: string): Book[] {
	let list = books;
	if (tab === 'HISTORY') {
		list = list.filter((b) => Boolean(b.lastReadChapter || b.totalTranslated > 0));
	} else if (tab === 'AI') {
		list = list.filter((b) => b.totalPending > 0);
	} else if (tab === 'FAVORITE') {
		const favoriteIds = useFavoriteStore.getState().favoriteBookIds;
		list = list.filter((b) => b.isFavorite || favoriteIds.includes(b.bookId));
		list.sort((a, b) => favoriteIds.indexOf(a.bookId) - favoriteIds.indexOf(b.bookId));
	}

	if (tags && tags.length > 0) {
		list = list.filter((b) => b.tags && tags.some((t) => b.tags?.includes(t)));
	}

	if (search) {
		const queryStr = search.toLowerCase();
		list = list.filter((b) => b.bookName.toLowerCase().includes(queryStr));
	}

	return list;
}

function buildBooksQueryParams(
	page: number,
	limit: number,
	sortBy: string,
	sortOrder: string,
	search?: string,
	tab?: string,
	tags?: string[],
	forceFresh?: boolean
): string {
	const query = new URLSearchParams({
		page: page.toString(),
		limit: limit.toString(),
		sortBy,
		sortOrder,
	});
	if (search) query.append('search', search);
	if (tab && tab !== 'ALL') {
		query.append('tab', tab);
		query.append('rootTab', tab.toLowerCase());
	}
	if (tags && tags.length > 0) {
		query.append('tags', tags.join(','));
	}
	if (forceFresh) {
		query.append('_t', Date.now().toString());
	}
	return query.toString();
}

function buildOnlineRequestOptions(tab?: string, options?: GetBooksOptions): RequestOptions {
	const requestTimeout = options?.timeout ?? (tab === 'HISTORY' ? 10000 : 8000);
	const requestOptions: RequestOptions = {
		timeout: requestTimeout,
		retries: 1,
	};
	if (options?.forceFresh) {
		requestOptions.headers = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
		requestOptions.cache = 'no-store';
	}
	return requestOptions;
}

function normalizeBookListResponse(res: ApiBookListResponse, page: number, limit: number): GetBooksResult {
	const books = res.books || res.data || (Array.isArray(res) ? (res as unknown as Book[]) : []);
	const pag = res.pagination || {};
	const total = pag.total ?? books.length;
	const totalPages = pag.totalPages ?? (Math.ceil(total / limit) || 1);
	const currentPage = pag.page ?? page;

	useFavoriteStore.getState().syncFromBooks(books);

	return {
		books,
		pagination: {
			currentPage,
			totalPages,
			total,
		},
	};
}

async function fetchOnlineBooks(
	page: number,
	limit: number,
	sortBy: string,
	sortOrder: string,
	search?: string,
	tab?: string,
	tags?: string[],
	options?: GetBooksOptions
): Promise<GetBooksResult | null> {
	const queryString = buildBooksQueryParams(page, limit, sortBy, sortOrder, search, tab, tags, options?.forceFresh);
	const requestOptions = buildOnlineRequestOptions(tab, options);

	const res = await apiClient.get<ApiBookListResponse>(`/api/books?${queryString}`, requestOptions);
	if (!res) return null;

	return normalizeBookListResponse(res, page, limit);
}

function resolveGetBooksParams(page?: number, limit?: number, sortBy?: string, sortOrder?: string) {
	return {
		page: typeof page === 'number' ? page : 1,
		limit: typeof limit === 'number' ? limit : 20,
		sortBy: sortBy || 'createdAt',
		sortOrder: sortOrder || 'DESC',
	};
}

function extractBookFromList(items?: unknown): Book | null {
	if (Array.isArray(items) && items.length > 0) {
		return items[0] as Book;
	}
	return null;
}

function extractBookFromApiResponse(data?: ApiSingleBookResponse): Book | null {
	if (!data) return null;
	const fromList = extractBookFromList(data.books) || extractBookFromList(data.data) || extractBookFromList(data);
	if (fromList) return fromList;
	if (data.data && !Array.isArray(data.data)) {
		return data.data;
	}
	return data.book || null;
}

function buildSingleBookRequest(bookId: string, options?: { forceFresh?: boolean }, timeout = 10000, silent = false) {
	let url = `/api/books?bookId=${encodeURIComponent(bookId)}&limit=1`;
	const requestOptions: RequestOptions = { timeout, retries: 0, silent };
	if (options?.forceFresh) {
		url += `&_t=${Date.now()}`;
		requestOptions.headers = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
		requestOptions.cache = 'no-store';
	}
	return { url, requestOptions };
}

async function fetchOnlineLastReadChapter(bookId: string, options?: { forceFresh?: boolean }) {
	try {
		const { url, requestOptions } = buildSingleBookRequest(bookId, options, 4000, true);
		const res = await apiClient.get<ApiSingleBookResponse>(url, requestOptions);
		const book = extractBookFromApiResponse(res);

		if (book?.lastReadChapter?.chapterId) {
			await syncOfflineLastReadBook(bookId, book);
			return parseLastReadChapter(book.lastReadChapter);
		}
		return null;
	} catch (e: unknown) {
		console.warn('Failed to fetch last read chapter online:', e);
		if (options?.forceFresh) {
			const msg = e instanceof Error ? e.message : 'Không thể lấy thông tin chương đọc gần nhất từ máy chủ';
			throw new Error(msg, { cause: e });
		}
		return null;
	}
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
