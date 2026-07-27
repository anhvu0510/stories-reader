import { Book } from '../shared/types';
import { apiClient } from '../services/apiClient';
import { offlineDb } from '../lib/offlineDb';
import { useAppStore } from '../stores/useAppStore';

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
    sortOrder: string = 'DESC'
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

        const res = await apiClient.get<any>(`/api/books?${query.toString()}`);
        if (res) {
          const books = res.books || res.data || (Array.isArray(res) ? res : []);
          const pag = res.pagination || {};
          const total = pag.total ?? books.length;
          const totalPages = pag.totalPages ?? (Math.ceil(total / limit) || 1);
          const currentPage = pag.page ?? page;

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

    // Offline / Fallback filtering by tab
    if (tab === 'HISTORY') {
      allBooks = allBooks.filter((b) => Boolean(b.lastReadChapter || b.totalTranslated > 0));
    } else if (tab === 'AI') {
      allBooks = allBooks.filter((b) => b.totalPending > 0);
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

  async getBook(bookId: string): Promise<Book | undefined> {
    const isOffline = useAppStore.getState().isOfflineMode;
    if (isOffline) {
      return await offlineDb.getBook(bookId);
    }
    try {
      const data = await apiClient.get<any>(`/api/books/${bookId}`);
      return data?.data || data;
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
