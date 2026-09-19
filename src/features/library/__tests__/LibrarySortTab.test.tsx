// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SortSheet, SORT_OPTIONS } from '../components/SortSheet';
import { LibraryHeader } from '../components/LibraryHeader';
import { LibraryScreen } from '../LibraryScreen';
import { BookRepository } from '../../../repositories/BookRepository';

vi.mock('../../../repositories/BookRepository', () => ({
  BookRepository: {
    getBooks: vi.fn().mockResolvedValue({
      books: [],
      pagination: { currentPage: 1, totalPages: 1, total: 0 },
    }),
  },
}));

describe('Library Tab Sorting Requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('QC-1 & QC-5: SORT_OPTIONS only contains createdAt (mặc định) and updatedAt options', () => {
    expect(SORT_OPTIONS).toHaveLength(2);
    expect(SORT_OPTIONS.map((opt) => opt.sortBy)).toEqual(['createdAt', 'updatedAt']);
    expect(SORT_OPTIONS[0].sortBy).toBe('createdAt');
    expect(SORT_OPTIONS[0].sortOrder).toBe('DESC');
    expect(SORT_OPTIONS[1].sortBy).toBe('updatedAt');
    expect(SORT_OPTIONS[1].sortOrder).toBe('DESC');
  });

  it('QC-2: LibraryHeader hides sort button when onOpenSort is undefined', () => {
    const { queryByTestId } = render(
      <LibraryHeader
        searchQuery=""
        onSearchChange={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(queryByTestId('sort-trigger-btn')).toBeNull();
  });

  it('QC-3: LibraryHeader shows sort button when onOpenSort is provided', () => {
    const { getByTestId } = render(
      <LibraryHeader
        searchQuery=""
        onSearchChange={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenSort={vi.fn()}
      />
    );
    expect(getByTestId('sort-trigger-btn')).toBeDefined();
  });

  it('QC-4: LibraryScreen handles sort rules for ALL, HISTORY, FAVORITE, and AI tabs', async () => {
    render(<LibraryScreen />);

    // Initially on Tab ALL -> calls getBooks with default sortBy 'createdAt' and sortOrder 'DESC'
    await waitFor(() => {
      expect(BookRepository.getBooks).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        '',
        'ALL',
        'createdAt',
        'DESC',
        []
      );
    });

    // Switch to Tab HISTORY -> sort button should be hidden & calls getBooks with lastedReadAt / DESC
    const historyTabBtn = screen.getByText('Lịch sử');
    fireEvent.click(historyTabBtn);

    await waitFor(() => {
      expect(BookRepository.getBooks).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        '',
        'HISTORY',
        'lastedReadAt',
        'DESC',
        []
      );
    });

    // Switch to Tab FAVORITE -> calls getBooks with createdAt / DESC
    const favoriteTabBtn = screen.getByText('Yêu thích');
    fireEvent.click(favoriteTabBtn);

    await waitFor(() => {
      expect(BookRepository.getBooks).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        '',
        'FAVORITE',
        'createdAt',
        'DESC',
        []
      );
    });

    // Switch to Tab AI -> calls getBooks with createdAt / DESC
    const aiTabBtn = screen.getByText('Dịch AI');
    fireEvent.click(aiTabBtn);

    await waitFor(() => {
      expect(BookRepository.getBooks).toHaveBeenCalledWith(
        1,
        expect.any(Number),
        '',
        'AI',
        'createdAt',
        'DESC',
        []
      );
    });
  });

  it('QC-1: Sticky tab navigation bar has sticky top-0 and bg-background/95 classes', async () => {
    const { container } = render(<LibraryScreen />);
    await waitFor(() => {
      expect(BookRepository.getBooks).toHaveBeenCalled();
    });

    const stickyNavBar = container.querySelector('.sticky.top-0');
    expect(stickyNavBar).not.toBeNull();
    expect(stickyNavBar?.className).toContain('bg-background/95');
  });
});

