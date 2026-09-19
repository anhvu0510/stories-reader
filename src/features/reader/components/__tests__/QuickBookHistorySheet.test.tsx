// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickBookHistorySheet } from '../QuickBookHistorySheet';
import { BookRepository } from '../../../../repositories/BookRepository';
import { Book } from '../../../../shared/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('QuickBookHistorySheet', () => {
  const mockBooks: Book[] = [
    {
      bookId: 'book-1',
      bookName: 'Truyện Đang Đọc',
      chapterCount: 100,
      totalTranslated: 80,
      totalPending: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      lastedReadAt: '2026-09-12T10:00:00Z',
      lastReadChapter: {
        chapterId: 'chap-50',
        chapterNumber: '50',
        title: 'Chương 50: Đại chiến',
      },
    },
    {
      bookId: 'book-2',
      bookName: 'Truyện Cũ Hơn',
      chapterCount: 50,
      totalTranslated: 50,
      totalPending: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
      lastedReadAt: '2026-09-10T10:00:00Z',
      lastReadChapter: {
        chapterId: 'chap-10',
        chapterNumber: '10',
        title: 'Chương 10: Khởi đầu',
      },
    },
  ];

  let getBooksSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    getBooksSpy = vi.spyOn(BookRepository, 'getBooks').mockImplementation(async () => ({
      books: mockBooks,
      pagination: { currentPage: 1, totalPages: 1, total: 2 },
    }));
  });

  afterEach(() => {
    cleanup();
    getBooksSpy?.mockRestore();
  });

  it('fetches history books sorted by lastedReadAt DESC', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <QuickBookHistorySheet currentBookId="book-1" onClose={onClose} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getBooksSpy).toHaveBeenCalledWith(1, 9999, '', 'HISTORY', 'lastedReadAt', 'DESC');
    });

    await waitFor(() => {
      expect(screen.getByText('Truyện Đang Đọc')).toBeDefined();
      expect(screen.getByText('Truyện Cũ Hơn')).toBeDefined();
    });
  });

  it('allows searching and includes current book when search query matches', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <QuickBookHistorySheet currentBookId="book-1" onClose={onClose} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Truyện Đang Đọc')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm truyện trong lịch sử/i);
    fireEvent.change(searchInput, { target: { value: 'Truyện Đang Đọc' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(getBooksSpy).toHaveBeenCalledWith(1, 9999, 'Truyện Đang Đọc', 'HISTORY', 'lastedReadAt', 'DESC');
    });

    await waitFor(() => {
      expect(screen.getByText('Truyện Đang Đọc')).toBeDefined();
    });
  });

  it('navigates to book chapter when clicked', async () => {
    const onClose = vi.fn();
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        hash: '',
        reload: reloadSpy,
      },
    });

    render(
      <MemoryRouter>
        <QuickBookHistorySheet currentBookId="book-1" onClose={onClose} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Truyện Cũ Hơn')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Truyện Cũ Hơn'));

    expect(onClose).toHaveBeenCalled();
    expect(window.location.hash).toBe('#/book/book-2/chapter/chap-10');
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
