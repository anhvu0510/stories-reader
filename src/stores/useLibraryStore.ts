import { create } from 'zustand';

interface LibraryState {
  savedPage: number;
  savedTab: 'ALL' | 'HISTORY' | 'AI';
  savedSearch: string;
  savedScrollY: number;
  
  setLibraryState: (page: number, tab: 'ALL' | 'HISTORY' | 'AI', search: string, scrollY?: number) => void;
  setSavedScrollY: (scrollY: number) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  savedPage: 1,
  savedTab: 'ALL',
  savedSearch: '',
  savedScrollY: 0,

  setLibraryState: (page, tab, search, scrollY) =>
    set((state) => ({
      savedPage: page,
      savedTab: tab,
      savedSearch: search,
      savedScrollY: scrollY !== undefined ? scrollY : (typeof window !== 'undefined' ? window.scrollY : state.savedScrollY),
    })),

  setSavedScrollY: (scrollY) => set({ savedScrollY: scrollY }),
}));
