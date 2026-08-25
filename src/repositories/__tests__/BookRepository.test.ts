// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookRepository } from '../BookRepository';
import { apiClient } from '../../services/apiClient';
import { offlineDb } from '../../lib/offlineDb';
import { useAppStore } from '../../stores/useAppStore';
import { useFavoriteStore } from '../../stores/useFavoriteStore';

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
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
      data: { bookId: 'b-99', isFavorite: true },
    });

    const res = await BookRepository.toggleFavorite('b-99');

    expect(apiClient.post).toHaveBeenCalledWith('/api/books/b-99/favorite', {});
    expect(res).toEqual({ bookId: 'b-99', isFavorite: true });
    expect(useFavoriteStore.getState().isFavorite('b-99')).toBe(true);
  });

  it('QC-2 [Online]: getBooks with tab FAVORITE queries API with tab=FAVORITE parameter', async () => {
    const mockBooks = [
      { bookId: 'b-1', bookName: 'Book 1', isFavorite: true, chapterCount: 100, totalTranslated: 100, totalPending: 0, createdAt: '2024-01-01', updatedAt: '2024-01-02', lastReadChapter: null as any },
      { bookId: 'b-2', bookName: 'Book 2', isFavorite: true, chapterCount: 200, totalTranslated: 200, totalPending: 0, createdAt: '2024-01-01', updatedAt: '2024-01-02', lastReadChapter: null as any },
    ];

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      books: mockBooks,
      pagination: { currentPage: 1, totalPages: 1, total: 2 },
    });

    const res = await BookRepository.getBooks(1, 20, '', 'FAVORITE');

    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('tab=FAVORITE')
    );
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
      { bookId: 'b-fav-offline', bookName: 'Offline Fav', isFavorite: true, chapterCount: 10, totalTranslated: 10, totalPending: 0, createdAt: '', updatedAt: '', lastReadChapter: null as any },
      { bookId: 'b-other', bookName: 'Other Book', isFavorite: false, chapterCount: 10, totalTranslated: 10, totalPending: 0, createdAt: '', updatedAt: '', lastReadChapter: null as any },
    ]);

    const res = await BookRepository.getBooks(1, 20, '', 'FAVORITE');

    expect(res.books.length).toBe(1);
    expect(res.books[0].bookId).toBe('b-fav-offline');
  });
});
