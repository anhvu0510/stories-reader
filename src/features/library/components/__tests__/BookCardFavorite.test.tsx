// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookCard } from '../BookCard';
import { useFavoriteStore } from '../../../../stores/useFavoriteStore';
import { BookRepository } from '../../../../repositories/BookRepository';
import { Book } from '../../../../shared/types';

const mockBook: Book = {
  bookId: 'book-fav-test-1',
  bookName: 'Đấu La Đại Lục II',
  chapterCount: 500,
  totalTranslated: 500,
  totalPending: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02',
  lastReadChapter: { chapterId: 'c1', chapterNumber: '1', title: 'Khởi đầu' },
};

describe('BookCard Favorite Toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoriteStore.getState().clearFavorites();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders unfavorited Heart icon initially and toggles to favorited on click', async () => {
    vi.spyOn(BookRepository, 'toggleFavorite').mockImplementation(async (bookId) => {
      useFavoriteStore.getState().addFavorite(bookId);
      return { bookId, isFavorite: true };
    });

    render(
      <MemoryRouter>
        <BookCard book={mockBook} activeTab="ALL" />
      </MemoryRouter>
    );

    const favButton = screen.getByTitle(/Thêm vào yêu thích/i);
    expect(favButton).toBeDefined();

    // Click to add to favorite
    fireEvent.click(favButton);

    await waitFor(() => {
      expect(BookRepository.toggleFavorite).toHaveBeenCalledWith('book-fav-test-1');
      expect(useFavoriteStore.getState().isFavorite('book-fav-test-1')).toBe(true);
      expect(screen.getByTitle(/Bỏ yêu thích/i)).toBeDefined();
    });
  });

  it('removes from favorite when clicking an already favorited book', async () => {
    useFavoriteStore.getState().addFavorite('book-fav-test-1');
    vi.spyOn(BookRepository, 'toggleFavorite').mockImplementation(async (bookId) => {
      useFavoriteStore.getState().removeFavorite(bookId);
      return { bookId, isFavorite: false };
    });

    render(
      <MemoryRouter>
        <BookCard book={mockBook} activeTab="FAVORITE" />
      </MemoryRouter>
    );

    const favButton = screen.getByTitle(/Bỏ yêu thích/i);
    expect(favButton).toBeDefined();

    fireEvent.click(favButton);

    await waitFor(() => {
      expect(BookRepository.toggleFavorite).toHaveBeenCalledWith('book-fav-test-1');
      expect(useFavoriteStore.getState().isFavorite('book-fav-test-1')).toBe(false);
      expect(screen.getByTitle(/Thêm vào yêu thích/i)).toBeDefined();
    });
  });
});
