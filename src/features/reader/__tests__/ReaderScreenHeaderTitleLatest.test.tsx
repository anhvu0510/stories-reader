// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReaderScreen } from '../ReaderScreen';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { useToastStore } from '../../../stores/useToastStore';
import { useAppStore } from '../../../stores/useAppStore';

vi.mock('../../../repositories/ChapterRepository', () => ({
  ChapterRepository: {
    getChapterContent: vi.fn(),
    getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
    getLatestChapter: vi.fn(),
  },
}));

vi.mock('../../../hooks/useReadAloud', () => ({
  useReadAloud: () => ({
    isPlaying: false,
    isPaused: false,
    currentChunkIndex: 0,
    activeParagraphIndex: 0,
    startReading: vi.fn(),
    pauseReading: vi.fn(),
    stopReading: vi.fn(),
    nextSection: vi.fn(),
    prevSection: vi.fn(),
  }),
}));

describe('ReaderScreen - Load Latest Chapter from Header Title (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    useAppStore.setState({ isOfflineMode: false });
  });

  afterEach(() => {
    cleanup();
  });

  it('QC-1: Clicks header title, detects newer latest chapter, and navigates with force-fresh', async () => {
    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
      chapter: {
        chapterId: 'chap-1',
        chapterNumber: 1,
        title: 'Chương 1: Khởi đầu',
        bookName: 'Đại Phụng Đả Canh Nhân',
        content: ['Nội dung chương 1'],
      },
    });

    vi.mocked(ChapterRepository.getLatestChapter).mockResolvedValueOnce({
      chapterId: 'chap-99',
      chapterNumber: 99,
      title: 'Chương 99: Đột Phá',
      state: 'SUCCEEDED',
      updatedAt: new Date().toISOString(),
      bookId: 'book-1',
    });

    render(
      <MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial chapter load
    await waitFor(() => {
      expect(screen.getByText('Đại Phụng Đả Canh Nhân')).toBeDefined();
    });

    // Find and click the header title bar
    const titleBtn = screen.getByTitle('Bấm để tải chương mới nhất từ máy chủ');
    fireEvent.click(titleBtn);

    // Verify ChapterRepository.getLatestChapter was called with forceFresh: true
    await waitFor(() => {
      expect(ChapterRepository.getLatestChapter).toHaveBeenCalledWith('book-1', {
        forceFresh: true,
      });
    });

    // Check toast notification
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.message.includes('Chương 99'))).toBe(true);
  });

  it('QC-2: If already on latest chapter, reloads content with forceFresh: true directly from API', async () => {
    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
      chapter: {
        chapterId: 'chap-100',
        chapterNumber: 100,
        title: 'Chương 100: Đại Kết Cục',
        bookName: 'Đại Phụng Đả Canh Nhân',
        content: ['Nội dung chương 100'],
      },
    });

    vi.mocked(ChapterRepository.getLatestChapter).mockResolvedValueOnce({
      chapterId: 'chap-100',
      chapterNumber: 100,
      title: 'Chương 100: Đại Kết Cục',
      state: 'SUCCEEDED',
      updatedAt: new Date().toISOString(),
      bookId: 'book-1',
    });

    render(
      <MemoryRouter initialEntries={['/book/book-1/chapter/chap-100']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Đại Phụng Đả Canh Nhân')).toBeDefined();
    });

    // Initial load called without forceFresh
    expect(ChapterRepository.getChapterContent).toHaveBeenCalledWith(
      'chap-100',
      expect.any(Number),
      expect.any(Boolean),
      '',
      expect.any(Number)
    );

    // Click header title
    const titleBtn = screen.getByTitle('Bấm để tải chương mới nhất từ máy chủ');
    fireEvent.click(titleBtn);

    await waitFor(() => {
      expect(ChapterRepository.getLatestChapter).toHaveBeenCalledWith('book-1', {
        forceFresh: true,
      });
    });

    // Second load called with forceFresh: true
    await waitFor(() => {
      expect(ChapterRepository.getChapterContent).toHaveBeenLastCalledWith(
        'chap-100',
        expect.any(Number),
        expect.any(Boolean),
        '',
        expect.any(Number),
        { forceFresh: true }
      );
    });

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.message.includes('Đã tải bản mới nhất'))).toBe(true);
    });
  });

  it('QC-3: Handles network error gracefully with error toast feedback', async () => {
    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
      chapter: {
        chapterId: 'chap-1',
        chapterNumber: 1,
        title: 'Chương 1',
        bookName: 'Đại Phụng',
        content: ['Nội dung'],
      },
    });

    vi.mocked(ChapterRepository.getLatestChapter).mockRejectedValueOnce(
      new Error('Mạng bị mất kết nối')
    );

    render(
      <MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Đại Phụng')).toBeDefined();
    });

    const titleBtn = screen.getByTitle('Bấm để tải chương mới nhất từ máy chủ');
    fireEvent.click(titleBtn);

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.message.includes('Mạng bị mất kết nối'))).toBe(true);
    });

    // Button should be interactive again after failure
    expect((titleBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
