// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoriteStore } from '../useFavoriteStore';

describe('useFavoriteStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoriteStore.getState().clearFavorites();
  });

  it('QC-1: Khởi tạo rỗng và toggle thêm truyện vào danh sách yêu thích', () => {
    const store = useFavoriteStore.getState();
    expect(store.favoriteBookIds).toEqual([]);
    expect(store.isFavorite('book-1')).toBe(false);

    const isAdded = store.toggleFavorite('book-1');
    expect(isAdded).toBe(true);
    expect(useFavoriteStore.getState().favoriteBookIds).toEqual(['book-1']);
    expect(useFavoriteStore.getState().isFavorite('book-1')).toBe(true);
  });

  it('QC-2: Toggle lần 2 sẽ xóa truyện khỏi danh sách yêu thích', () => {
    const store = useFavoriteStore.getState();
    store.addFavorite('book-1');
    expect(useFavoriteStore.getState().isFavorite('book-1')).toBe(true);

    const isAdded = store.toggleFavorite('book-1');
    expect(isAdded).toBe(false);
    expect(useFavoriteStore.getState().favoriteBookIds).toEqual([]);
    expect(useFavoriteStore.getState().isFavorite('book-1')).toBe(false);
  });

  it('QC-3: Thêm nhiều truyện và kiểm tra thứ tự yêu thích mới nhất lên đầu', () => {
    const store = useFavoriteStore.getState();
    store.addFavorite('book-1');
    store.addFavorite('book-2');
    store.addFavorite('book-3');

    expect(useFavoriteStore.getState().favoriteBookIds).toEqual(['book-3', 'book-2', 'book-1']);
    expect(useFavoriteStore.getState().isFavorite('book-2')).toBe(true);
    expect(useFavoriteStore.getState().isFavorite('book-999')).toBe(false);
  });

  it('QC-4: Không thêm trùng lặp bookId khi gọi addFavorite nhiều lần', () => {
    const store = useFavoriteStore.getState();
    store.addFavorite('book-1');
    store.addFavorite('book-1');
    store.addFavorite('book-1');

    expect(useFavoriteStore.getState().favoriteBookIds).toEqual(['book-1']);
  });

  it('QC-5: Persist lưu danh sách yêu thích vào localStorage', () => {
    useFavoriteStore.getState().addFavorite('book-fav-100');

    const stored = localStorage.getItem('stories_favorite_books');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.favoriteBookIds).toEqual(['book-fav-100']);
  });
});
