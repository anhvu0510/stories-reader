import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LibraryState {
  savedPage: number;
  savedTab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI';
  savedSearch: string;
  savedTags: string[];
  savedScrollY: number;
  
  setLibraryState: (page: number, tab: 'ALL' | 'HISTORY' | 'FAVORITE' | 'AI', search: string, tags?: string[], scrollY?: number) => void;
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
      savedScrollY: 0,

      setLibraryState: (page, tab, search, tags, scrollY) =>
        set((state) => ({
          savedPage: page,
          savedTab: tab,
          savedSearch: search,
          savedTags: tags !== undefined ? tags : state.savedTags,
          savedScrollY: scrollY !== undefined ? scrollY : state.savedScrollY,
        })),

      setSavedScrollY: (scrollY) => set({ savedScrollY: scrollY }),

      resetLibraryState: () =>
        set({
          savedPage: 1,
          savedTab: 'ALL',
          savedSearch: '',
          savedTags: [],
          savedScrollY: 0,
        }),
    }),
    {
      name: 'stories_library_state',
      // Only persist filters & search to localStorage; do NOT persist scrollY so page reload always starts cleanly at the top
      partialize: (state) => ({
        savedPage: state.savedPage,
        savedTab: state.savedTab,
        savedSearch: state.savedSearch,
        savedTags: state.savedTags,
      }),
    }
  )
);
