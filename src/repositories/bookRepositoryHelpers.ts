import { offlineDb } from '@/lib/offlineDb';
import { apiClient, type RequestOptions } from '@/services/apiClient';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

import type { GetBooksOptions, GetBooksResult } from './BookRepository';
import type { Book, LastReadChapter } from '@/shared/types';

export interface ApiBookListResponse {
	books?: Book[];
	data?: Book[];
	pagination?: {
		total?: number;
		totalPages?: number;
		page?: number;
	};
}

export interface ApiSingleBookResponse {
	books?: Book[];
	data?: Book[] | Book;
	book?: Book;
}

export async function syncOfflineLastReadBook(
	bookId: string,
	book: { lastReadChapter?: Book['lastReadChapter']; lastedReadAt?: string } | null
): Promise<void> {
	const offlineBook = await offlineDb.getBook(bookId);
	if (!offlineBook || !book?.lastReadChapter) return;
	offlineBook.lastReadChapter = book.lastReadChapter;
	offlineBook.lastedReadAt = book.lastedReadAt || new Date().toISOString();
	await offlineDb.saveBook(offlineBook);
}

export async function updateLocalFavorite(bookId: string, nextFavorite: boolean): Promise<void> {
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

export function parseLastReadChapter(lastRead?: LastReadChapter | null) {
	if (!lastRead?.chapterId) return null;
	const chapterNumber =
		typeof lastRead.chapterNumber === 'number' ? lastRead.chapterNumber : parseInt(String(lastRead.chapterNumber), 10) || 1;
	const title = lastRead.title || `Chương ${chapterNumber}`;
	return { chapterId: lastRead.chapterId, chapterNumber, title };
}

export function buildLastReadTargetBook(
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

export function compareBooks(a: Book, b: Book, sortBy: string, direction: number): number {
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

export function filterOfflineBooks(books: Book[], tab?: string, tags?: string[], search?: string): Book[] {
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

export async function fetchOnlineBooks(
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

export function resolveGetBooksParams(page?: number, limit?: number, sortBy?: string, sortOrder?: string) {
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

export function extractBookFromApiResponse(data?: ApiSingleBookResponse): Book | null {
	if (!data) return null;
	const fromList = extractBookFromList(data.books) || extractBookFromList(data.data) || extractBookFromList(data);
	if (fromList) return fromList;
	if (data.data && !Array.isArray(data.data)) {
		return data.data;
	}
	return data.book || null;
}

export function buildSingleBookRequest(bookId: string, options?: { forceFresh?: boolean }, timeout = 10000, silent = false) {
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

export async function fetchOnlineLastReadChapter(bookId: string, options?: { forceFresh?: boolean }) {
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
