// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LibraryScreen } from '../LibraryScreen';
import { BookRepository } from '../../../repositories/BookRepository';
import { useFavoriteStore } from '../../../stores/useFavoriteStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';

vi.mock('../../../repositories/BookRepository', () => ({
  BookRepository: {
    getBooks: vi.fn(),
  },
}));

const mockBooks = [
  {
    bookId: 'book-fav-1',
    bookName: 'Toàn Chức Cao Thủ',
    chapterCount: 1728,
    totalTranslated: 1728,
    totalPending: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    lastReadChapter: { chapterId: 'c1', chapterNumber: '1', title: 'Diệp Tu' },
  },
  {
    bookId: 'book-fav-2',
    bookName: 'Quỷ Bí Chi Chủ',
    chapterCount: 1400,
    totalTranslated: 1400,
    totalPending: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    lastReadChapter: { chapterId: 'c2', chapterNumber: '1', title: 'Thằng Hề' },
  },
];

describe('LibraryScreen FAVORITE Tab Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useFavoriteStore.getState().clearFavorites();
    useLibraryStore.getState().resetLibraryState();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders FAVORITE tab button and switches to TRUYỆN YÊU THÍCH', async () => {
    vi.mocked(BookRepository.getBooks).mockResolvedValue({
      books: mockBooks,
      pagination: { currentPage: 1, totalPages: 1, total: 2 },
    });

    render(
      <MemoryRouter>
        <LibraryScreen />
      </MemoryRouter>
    );

    const favTabButton = screen.getByTitle('Truyện yêu thích');
    expect(favTabButton).toBeDefined();

    fireEvent.click(favTabButton);

    await waitFor(() => {
      expect(screen.getByText('Yêu thích')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });

    expect(BookRepository.getBooks).toHaveBeenCalledWith(
      1,
      20,
      '',
      'FAVORITE',
      'createdAt',
      'DESC',
      []
    );
  });

  it('displays empty state message when FAVORITE tab has no books', async () => {
    vi.mocked(BookRepository.getBooks).mockResolvedValue({
      books: [],
      pagination: { currentPage: 1, totalPages: 1, total: 0 },
    });

    render(
      <MemoryRouter>
        <LibraryScreen />
      </MemoryRouter>
    );

    const favTabButton = screen.getByTitle('Truyện yêu thích');
    fireEvent.click(favTabButton);

    await waitFor(() => {
      expect(screen.getByText('Chưa có truyện nào trong danh sách yêu thích')).toBeDefined();
    });
  });
});
