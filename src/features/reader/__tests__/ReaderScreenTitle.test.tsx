// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReaderScreen } from '../ReaderScreen';
import { ChapterListScreen } from '../../chapter-list/ChapterListScreen';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { BookRepository } from '../../../repositories/BookRepository';
import { DEFAULT_APP_TITLE } from '../../../hooks/useDocumentTitle';

vi.mock('../../../repositories/ChapterRepository', () => ({
  ChapterRepository: {
    getChapterContent: vi.fn(),
    getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
  },
}));

vi.mock('../../../repositories/BookRepository', () => ({
  BookRepository: {
    getBook: vi.fn(),
  },
}));

describe('ReaderScreen & ChapterListScreen Document Title Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = DEFAULT_APP_TITLE;
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    document.title = DEFAULT_APP_TITLE;
  });

  it('QC-1: Đặt document.title là tên truyện khi đọc chương truyện thành công', async () => {
    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValueOnce({
      chapter: {
        chapterId: 'chap-1',
        chapterNumber: 1,
        title: 'Chương 1: Khởi đầu mới',
        bookName: 'Phàm Nhân Tu Tiên',
        state: 'SUCCEEDED',
        totalTokens: 1000,
        content: ['Vạn sự khởi đầu nan.'],
        rootTab: '',
      },
    });

    render(
      <MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.title).toBe('Phàm Nhân Tu Tiên');
    });
  });

  it('QC-5: Giữ title mặc định an toàn khi API tải chương bị lỗi', async () => {
    vi.mocked(ChapterRepository.getChapterContent).mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter initialEntries={['/book/book-1/chapter/chap-fail']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải chương/i)).toBeDefined();
    });

    expect(document.title).toBe(DEFAULT_APP_TITLE);
  });

  it('QC-6: Khôi phục document.title về mặc định khi unmount khỏi màn hình đọc', async () => {
    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValueOnce({
      chapter: {
        chapterId: 'chap-1',
        chapterNumber: 1,
        title: 'Chương 1',
        bookName: 'Đấu La Đại Lục',
        state: 'SUCCEEDED',
        totalTokens: 500,
        content: ['Nội dung chương.'],
        rootTab: '',
      },
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.title).toBe('Đấu La Đại Lục');
    });

    unmount();
    expect(document.title).toBe(DEFAULT_APP_TITLE);
  });

  it('QC-7: ChapterListScreen cập nhật title theo tên sách khi tải xong', async () => {
    vi.mocked(BookRepository.getBook).mockResolvedValueOnce({
      bookId: 'book-1',
      bookName: 'Tiên Nghịch',
      chapterCount: 2000,
      totalTranslated: 2000,
      totalPending: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
      lastReadChapter: { chapterId: 'chap-1', chapterNumber: '1', title: 'Chương 1' },
    });

    render(
      <MemoryRouter initialEntries={['/book/book-1']}>
        <Routes>
          <Route path="/book/:bookId" element={<ChapterListScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.title).toBe('Tiên Nghịch');
    });
  });
});
