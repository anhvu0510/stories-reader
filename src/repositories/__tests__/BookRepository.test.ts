// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

import { offlineDb } from '@/lib/offlineDb';
import { BookRepository } from '@/repositories/BookRepository';
import { apiClient } from '@/services/apiClient';
import { useAppStore } from '@/stores/useAppStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';

vi.mock('../../services/apiClient', () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn()
	}
}));

describe('BookRepository Favorite Server Management', () => {
	beforeEach(() => {
		localStorage.clear();
		useFavoriteStore.getState().clearFavorites();
		useAppStore.getState().setOfflineMode(false);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('QC-1 [Online]: toggleFavorite calls server API and syncs to useFavoriteStore and offlineDb', async () => {
		vi.mocked(apiClient.post).mockResolvedValueOnce({
			code: 1000,
			data: { bookId: 'b-99', isFavorite: true }
		});

		const res = await BookRepository.toggleFavorite('b-99');

		expect(apiClient.post).toHaveBeenCalledWith('/api/books/b-99/favorite', {});
		expect(res).toEqual({ bookId: 'b-99', isFavorite: true });
		expect(useFavoriteStore.getState().isFavorite('b-99')).toBe(true);
	});

	it('QC-2 [Online]: getBooks with tab FAVORITE queries API with tab=FAVORITE parameter', async () => {
		const mockBooks = [
			{
				bookId: 'b-1',
				bookName: 'Book 1',
				isFavorite: true,
				chapterCount: 100,
				totalTranslated: 100,
				totalPending: 0,
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastReadChapter: null as any
			},
			{
				bookId: 'b-2',
				bookName: 'Book 2',
				isFavorite: true,
				chapterCount: 200,
				totalTranslated: 200,
				totalPending: 0,
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastReadChapter: null as any
			}
		];

		vi.mocked(apiClient.get).mockResolvedValueOnce({
			books: mockBooks,
			pagination: { currentPage: 1, totalPages: 1, total: 2 }
		});

		const res = await BookRepository.getBooks(1, 20, '', 'FAVORITE');

		expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('tab=FAVORITE'), expect.anything());
		expect(res.books.length).toBe(2);
		expect(useFavoriteStore.getState().isFavorite('b-1')).toBe(true);
		expect(useFavoriteStore.getState().isFavorite('b-2')).toBe(true);
	});

	it('QC-3 [Offline]: toggleFavorite updates offlineDb and useFavoriteStore when offline', async () => {
		useAppStore.getState().setOfflineMode(true);

		const res = await BookRepository.toggleFavorite('b-offline-1', true);

		expect(apiClient.post).not.toHaveBeenCalled();
		expect(res).toEqual({ bookId: 'b-offline-1', isFavorite: true });
		expect(useFavoriteStore.getState().isFavorite('b-offline-1')).toBe(true);
	});

	it('QC-4 [Offline]: getBooks filters offlineDb books by favorite status when offline', async () => {
		useAppStore.getState().setOfflineMode(true);
		useFavoriteStore.getState().addFavorite('b-fav-offline');

		vi.spyOn(offlineDb, 'getBooks').mockResolvedValueOnce([
			{
				bookId: 'b-fav-offline',
				bookName: 'Offline Fav',
				isFavorite: true,
				chapterCount: 10,
				totalTranslated: 10,
				totalPending: 0,
				createdAt: '',
				updatedAt: '',
				lastReadChapter: null as any
			},
			{
				bookId: 'b-other',
				bookName: 'Other Book',
				isFavorite: false,
				chapterCount: 10,
				totalTranslated: 10,
				totalPending: 0,
				createdAt: '',
				updatedAt: '',
				lastReadChapter: null as any
			}
		]);

		const res = await BookRepository.getBooks(1, 20, '', 'FAVORITE');

		expect(res.books.length).toBe(1);
		expect(res.books[0].bookId).toBe('b-fav-offline');
	});

	it('QC-5 [Online]: getBooks passes sortBy and sortOrder parameters to API', async () => {
		vi.mocked(apiClient.get).mockResolvedValueOnce({
			books: [],
			pagination: { currentPage: 1, totalPages: 1, total: 0 }
		});

		await BookRepository.getBooks(1, 20, '', 'ALL', 'bookName', 'ASC');

		expect(apiClient.get).toHaveBeenCalledWith(expect.stringMatching(/sortBy=bookName.*sortOrder=ASC|sortOrder=ASC.*sortBy=bookName/), expect.anything());
	});

	it('QC-6 [Offline]: getBooks sorts offline books by Vietnamese alphabet (bookName ASC)', async () => {
		useAppStore.getState().setOfflineMode(true);

		vi.spyOn(offlineDb, 'getBooks').mockResolvedValueOnce([
			{
				bookId: 'b-2',
				bookName: 'Đại Đạo',
				isFavorite: false,
				chapterCount: 10,
				totalTranslated: 10,
				totalPending: 0,
				createdAt: '',
				updatedAt: '',
				lastReadChapter: null as any
			},
			{
				bookId: 'b-1',
				bookName: 'Áo Trắng',
				isFavorite: false,
				chapterCount: 10,
				totalTranslated: 10,
				totalPending: 0,
				createdAt: '',
				updatedAt: '',
				lastReadChapter: null as any
			},
			{
				bookId: 'b-3',
				bookName: 'Bất Hủ',
				isFavorite: false,
				chapterCount: 10,
				totalTranslated: 10,
				totalPending: 0,
				createdAt: '',
				updatedAt: '',
				lastReadChapter: null as any
			}
		]);

		const res = await BookRepository.getBooks(1, 20, '', 'ALL', 'bookName', 'ASC');

		expect(res.books.map((b) => b.bookName)).toEqual(['Áo Trắng', 'Bất Hủ', 'Đại Đạo']);
	});

	it('QC-7 [Online]: getLastReadChapter queries API with bookId query param and forceFresh headers', async () => {
		vi.mocked(apiClient.get).mockResolvedValueOnce({
			books: [
				{
					bookId: 'b-99',
					bookName: 'Truyện Hay',
					lastReadChapter: {
						chapterId: 'c-20',
						chapterNumber: 20,
						title: 'Chương 20: Chiến Thắng'
					}
				}
			]
		});

		const res = await BookRepository.getLastReadChapter('b-99', { forceFresh: true });

		expect(res).toEqual({
			chapterId: 'c-20',
			chapterNumber: 20,
			title: 'Chương 20: Chiến Thắng'
		});

		const [calledUrl, calledOptions] = vi.mocked(apiClient.get).mock.calls[0];
		expect(calledUrl).toContain('/api/books?bookId=b-99&limit=1');
		expect(calledUrl).toContain('_t=');
		expect(calledOptions).toMatchObject({
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache'
			},
			cache: 'no-store'
		});
	});

	it('QC-8 [Online]: getBook correctly queries /api/books?bookId=... instead of 404 path', async () => {
		vi.mocked(apiClient.get).mockResolvedValueOnce({
			books: [
				{
					bookId: 'b-55',
					bookName: 'Quyển 55'
				}
			]
		});

		const res = await BookRepository.getBook('b-55');

		expect(res?.bookId).toBe('b-55');
		const [calledUrl] = vi.mocked(apiClient.get).mock.calls[0];
		expect(calledUrl).toBe('/api/books?bookId=b-55&limit=1');
	});

	it('QC-9 [Online]: updateLastReadChapter calls server API and saves to offlineDb', async () => {
		const mockBook = {
			bookId: 'b-99',
			bookName: 'Đấu Phá Khung Thương'
		} as any;
		await offlineDb.saveBook(mockBook);

		vi.mocked(apiClient.post).mockResolvedValueOnce({
			code: 1000,
			data: { bookId: 'b-99', lastReadChapter: { chapterId: 'c-10', chapterNumber: 10, title: 'Chương 10' } }
		});

		await (BookRepository as any).updateLastReadChapter('b-99', {
			chapterId: 'c-10',
			chapterNumber: 10,
			title: 'Chương 10'
		});

		expect(apiClient.post).toHaveBeenCalledWith(
			'/api/books/b-99/last-read',
			{
				chapterId: 'c-10',
				chapterNumber: 10,
				title: 'Chương 10'
			},
			expect.objectContaining({ silent: true })
		);

		const saved = await offlineDb.getBook('b-99');
		expect(saved?.lastReadChapter).toEqual({
			chapterId: 'c-10',
			chapterNumber: 10,
			title: 'Chương 10'
		});
		expect(saved?.lastedReadAt).toBeDefined();
	});

	it('QC-10 [Offline]: updateLastReadChapter only updates offlineDb and skips API call', async () => {
		useAppStore.getState().setOfflineMode(true);
		const mockBook = {
			bookId: 'b-99',
			bookName: 'Đấu Phá Khung Thương'
		} as any;
		await offlineDb.saveBook(mockBook);

		await (BookRepository as any).updateLastReadChapter('b-99', {
			chapterId: 'c-11',
			chapterNumber: 11,
			title: 'Chương 11'
		});

		expect(apiClient.post).not.toHaveBeenCalled();
		const saved = await offlineDb.getBook('b-99');
		expect(saved?.lastReadChapter?.chapterId).toBe('c-11');
	});

	it('QC-11 [Network Error]: updateLastReadChapter safely handles API rejection while keeping offlineDb updated', async () => {
		const mockBook = {
			bookId: 'b-99',
			bookName: 'Đấu Phá Khung Thương'
		} as any;
		await offlineDb.saveBook(mockBook);

		vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network disconnected'));

		await expect(
			(BookRepository as any).updateLastReadChapter('b-99', {
				chapterId: 'c-12',
				chapterNumber: 12,
				title: 'Chương 12'
			})
		).resolves.not.toThrow();

		const saved = await offlineDb.getBook('b-99');
		expect(saved?.lastReadChapter?.chapterId).toBe('c-12');
	});
});
