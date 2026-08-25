import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SortByField = 'updatedAt' | 'createdAt' | 'bookName' | 'lastedReadAt';
export type SortOrderDirection = 'ASC' | 'DESC';

interface LibraryState {
  savedPage: number;
  savedTab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI';
  savedSearch: string;
  savedTags: string[];
  savedSortBy: SortByField;
  savedSortOrder: SortOrderDirection;
  savedScrollY: number;

  setLibraryState: (
    page: number,
    tab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI',
    search: string,
    tags?: string[],
    sortBy?: SortByField,
    sortOrder?: SortOrderDirection,
    scrollY?: number
  ) => void;
  setSort: (sortBy: SortByField, sortOrder: SortOrderDirection) => void;
  setSavedScrollY: (scrollY: number) => void;
  resetLibraryState: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      savedPage: 1,
      savedTab: 'ALL',
      savedSearch: '',
      savedTags: [],
      savedSortBy: 'createdAt',
      savedSortOrder: 'DESC',
      savedScrollY: 0,

      setLibraryState: (page, tab, search, tags, sortBy, sortOrder, scrollY) =>
        set((state) => ({
          savedPage: page,
          savedTab: tab,
          savedSearch: search,
          savedTags: tags !== undefined ? tags : state.savedTags,
          savedSortBy: sortBy !== undefined ? sortBy : state.savedSortBy,
          savedSortOrder: sortOrder !== undefined ? sortOrder : state.savedSortOrder,
          savedScrollY: scrollY !== undefined ? scrollY : state.savedScrollY,
        })),

      setSort: (sortBy, sortOrder) =>
        set({
          savedSortBy: sortBy,
          savedSortOrder: sortOrder,
          savedPage: 1,
        }),

      setSavedScrollY: (scrollY) => set({ savedScrollY: scrollY }),

      resetLibraryState: () =>
        set({
          savedPage: 1,
          savedTab: 'ALL',
          savedSearch: '',
          savedTags: [],
          savedSortBy: 'createdAt',
          savedSortOrder: 'DESC',
          savedScrollY: 0,
        }),
    }),
    {
      name: 'stories_library_state',
      partialize: (state) => ({
        savedPage: state.savedPage,
        savedTab: state.savedTab,
        savedSearch: state.savedSearch,
        savedTags: state.savedTags,
        savedSortBy: state.savedSortBy,
        savedSortOrder: state.savedSortOrder,
      }),
    }
  )
);
