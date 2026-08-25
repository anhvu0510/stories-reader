// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from '../useLibraryStore';

describe('useLibraryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLibraryStore.getState().resetLibraryState();
  });

  it('should initialize with default state including sortBy and sortOrder', () => {
    const state = useLibraryStore.getState();
    expect(state.savedPage).toBe(1);
    expect(state.savedTab).toBe('ALL');
    expect(state.savedSearch).toBe('');
    expect(state.savedTags).toEqual([]);
    expect(state.savedSortBy).toBe('updatedAt');
    expect(state.savedSortOrder).toBe('DESC');
    expect(state.savedScrollY).toBe(0);
  });

  it('should save and persist selected tags, sort state and filters to localStorage', () => {
    useLibraryStore
      .getState()
      .setLibraryState(2, 'HISTORY', 'tu tien', ['Sắc Hiệp', 'Mẹ Kế'], 'bookName', 'ASC', 250);

    const state = useLibraryStore.getState();
    expect(state.savedPage).toBe(2);
    expect(state.savedTab).toBe('HISTORY');
    expect(state.savedSearch).toBe('tu tien');
    expect(state.savedTags).toEqual(['Sắc Hiệp', 'Mẹ Kế']);
    expect(state.savedSortBy).toBe('bookName');
    expect(state.savedSortOrder).toBe('ASC');
    expect(state.savedScrollY).toBe(250);

    const rawStored = localStorage.getItem('stories_library_state');
    expect(rawStored).toBeTruthy();
    const parsed = JSON.parse(rawStored!);
    expect(parsed.state.savedTags).toEqual(['Sắc Hiệp', 'Mẹ Kế']);
    expect(parsed.state.savedTab).toBe('HISTORY');
    expect(parsed.state.savedSortBy).toBe('bookName');
    expect(parsed.state.savedSortOrder).toBe('ASC');
    expect(parsed.state.savedScrollY).toBeUndefined();
  });

  it('should support and persist setSort directly', () => {
    useLibraryStore.getState().setSort('lastedReadAt', 'DESC');

    const state = useLibraryStore.getState();
    expect(state.savedSortBy).toBe('lastedReadAt');
    expect(state.savedSortOrder).toBe('DESC');
    expect(state.savedPage).toBe(1);
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
});
