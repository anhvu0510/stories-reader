import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Book } from '../shared/types';

interface FavoriteState {
  favoriteBookIds: string[];
  toggleFavorite: (bookId: string) => boolean;
  addFavorite: (bookId: string) => void;
  removeFavorite: (bookId: string) => void;
  isFavorite: (bookId: string) => boolean;
  syncFromBooks: (books: Book[]) => void;
  clearFavorites: () => void;
}

export const useFavoriteStore = create<FavoriteState>()(
  persist(
    (set, get) => ({
      favoriteBookIds: [],

      toggleFavorite: (bookId: string) => {
        const { favoriteBookIds } = get();
        const exists = favoriteBookIds.includes(bookId);
        if (exists) {
          set({ favoriteBookIds: favoriteBookIds.filter((id) => id !== bookId) });
          return false;
        } else {
          set({ favoriteBookIds: [bookId, ...favoriteBookIds.filter((id) => id !== bookId)] });
          return true;
        }
      },

      addFavorite: (bookId: string) => {
        const { favoriteBookIds } = get();
        if (!favoriteBookIds.includes(bookId)) {
          set({ favoriteBookIds: [bookId, ...favoriteBookIds] });
        }
      },

      removeFavorite: (bookId: string) => {
        const { favoriteBookIds } = get();
        set({ favoriteBookIds: favoriteBookIds.filter((id) => id !== bookId) });
      },

      isFavorite: (bookId: string) => {
        return get().favoriteBookIds.includes(bookId);
      },

      syncFromBooks: (books: Book[]) => {
        if (!Array.isArray(books) || books.length === 0) return;
        const { favoriteBookIds } = get();
        const serverFavIds = books.filter((b) => b.isFavorite).map((b) => b.bookId);
        const serverUnfavIds = new Set(books.filter((b) => b.isFavorite === false).map((b) => b.bookId));

        const updated = Array.from(new Set([...serverFavIds, ...favoriteBookIds])).filter(
          (id) => !serverUnfavIds.has(id) || serverFavIds.includes(id)
        );
        set({ favoriteBookIds: updated });
      },

      clearFavorites: () => set({ favoriteBookIds: [] }),
    }),
    {
      name: 'stories_favorite_books',
    }
  )
);
