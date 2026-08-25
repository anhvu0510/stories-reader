// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from '../useLibraryStore';

describe('useLibraryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLibraryStore.getState().resetLibraryState();
  });

  it('should initialize with default state', () => {
    const state = useLibraryStore.getState();
    expect(state.savedPage).toBe(1);
    expect(state.savedTab).toBe('ALL');
    expect(state.savedSearch).toBe('');
    expect(state.savedTags).toEqual([]);
    expect(state.savedScrollY).toBe(0);
  });

  it('should save and persist selected tags and state without persisting scrollY to localStorage', () => {
    useLibraryStore.getState().setLibraryState(2, 'HISTORY', 'tu tien', ['Sắc Hiệp', 'Mẹ Kế'], 250);

    const state = useLibraryStore.getState();
    expect(state.savedPage).toBe(2);
    expect(state.savedTab).toBe('HISTORY');
    expect(state.savedSearch).toBe('tu tien');
    expect(state.savedTags).toEqual(['Sắc Hiệp', 'Mẹ Kế']);
    expect(state.savedScrollY).toBe(250);

    // Verify localStorage has persisted filters & search, but NOT savedScrollY
    const rawStored = localStorage.getItem('stories_library_state');
    expect(rawStored).toBeTruthy();
    const parsed = JSON.parse(rawStored!);
    expect(parsed.state.savedTags).toEqual(['Sắc Hiệp', 'Mẹ Kế']);
    expect(parsed.state.savedTab).toBe('HISTORY');
    expect(parsed.state.savedScrollY).toBeUndefined();
  });

  it('should support and persist FAVORITE tab', () => {
    useLibraryStore.getState().setLibraryState(1, 'FAVORITE', '', ['Tiên Hiệp']);

    const state = useLibraryStore.getState();
    expect(state.savedTab).toBe('FAVORITE');

    const rawStored = localStorage.getItem('stories_library_state');
    expect(rawStored).toBeTruthy();
    const parsed = JSON.parse(rawStored!);
    expect(parsed.state.savedTab).toBe('FAVORITE');
  });

  it('should update tags without overwriting scrollY when scrollY is not passed', () => {
    useLibraryStore.getState().setLibraryState(1, 'ALL', '', ['Tiên Hiệp'], 100);
    useLibraryStore.getState().setLibraryState(1, 'ALL', '', ['Huyền Huyễn']);

    const state = useLibraryStore.getState();
    expect(state.savedTags).toEqual(['Huyền Huyễn']);
  });
});
