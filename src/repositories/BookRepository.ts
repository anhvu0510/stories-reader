import { Book } from '../shared/types';
import { apiClient } from '../services/apiClient';
import { offlineDb } from '../lib/offlineDb';
import { useAppStore } from '../stores/useAppStore';
import { useFavoriteStore } from '../stores/useFavoriteStore';

export interface GetBooksResult {
  books: Book[];
  pagination: {
    currentPage: number;
    totalPages: number;
    total: number;
  };
}

export const BookRepository = {
  async getBooks(
    page: number = 1,
    limit: number = 20,
    search?: string,
    tab?: string,
    sortBy: string = 'updatedAt',
    sortOrder: string = 'DESC',
    tags?: string[]
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

        const res = await apiClient.get<any>(`/api/books?${query.toString()}`);
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
              total,
            },
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

  async getBook(bookId: string): Promise<Book | undefined> {
    const isOffline = useAppStore.getState().isOfflineMode;
    if (isOffline) {
      return await offlineDb.getBook(bookId);
    }
    try {
      const data = await apiClient.get<any>(`/api/books/${bookId}`);
      const book = data?.data || data;
      if (book) {
        useFavoriteStore.getState().syncFromBooks([book]);
      }
      return book;
    } catch (e) {
      return await offlineDb.getBook(bookId);
    }
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
};
