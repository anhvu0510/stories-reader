// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReaderScreen } from '../ReaderScreen';
import { ChapterRepository } from '../../../repositories/ChapterRepository';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { useAppStore } from '../../../stores/useAppStore';

vi.mock('../../../repositories/ChapterRepository', () => ({
  ChapterRepository: {
    getChapterContent: vi.fn(),
    getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
  },
}));

describe('ReaderScreen - Multi-Chapter Batch Loading (Frontend Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    useReaderConfigStore.setState({ batchChapterSize: 3, groupLines: 1, isEnabledReplace: false });
    useAppStore.setState({ isOfflineMode: false });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all chapters in batch and displays batch section titles', async () => {
    const mockData = {
      chapter: {
        chapterId: 'c1',
        chapterNumber: 1,
        title: 'Tiêu đề Chương 1',
        bookName: 'Truyện Đỉnh Cao',
        state: 'SUCCEEDED',
        totalTokens: 100,
        content: ['Đoạn văn 1 của chương 1'],
        rootTab: '',
      },
      chapters: [
        {
          chapterId: 'c1',
          chapterNumber: 1,
          title: 'Tiêu đề Chương 1',
          bookName: 'Truyện Đỉnh Cao',
          state: 'SUCCEEDED',
          totalTokens: 100,
          content: ['Đoạn văn 1 của chương 1'],
          rootTab: '',
        },
        {
          chapterId: 'c2',
          chapterNumber: 2,
          title: 'Tiêu đề Chương 2',
          bookName: 'Truyện Đỉnh Cao',
          state: 'SUCCEEDED',
          totalTokens: 100,
          content: ['Đoạn văn 1 của chương 2'],
          rootTab: '',
        },
        {
          chapterId: 'c3',
          chapterNumber: 3,
          title: 'Tiêu đề Chương 3',
          bookName: 'Truyện Đỉnh Cao',
          state: 'SUCCEEDED',
          totalTokens: 100,
          content: ['Đoạn văn 1 của chương 3'],
          rootTab: '',
        },
      ],
      navigation: {
        prev: null,
        next: { chapterId: 'c4', chapterNumber: 4, title: 'Tiêu đề Chương 4' },
      },
    };

    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue(mockData as any);

    render(
      <MemoryRouter initialEntries={['/book/b1/chapter/c1']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Chương 1: Tiêu đề Chương 1/)).toBeDefined();
      expect(screen.getByText(/Chương 2: Tiêu đề Chương 2/)).toBeDefined();
      expect(screen.getByText(/Chương 3: Tiêu đề Chương 3/)).toBeDefined();
    }, { timeout: 3000 });

    expect(ChapterRepository.getChapterContent).toHaveBeenCalledWith('c1', 1, false, '', 3);
  });

  it('QC-6 [Tier 3 - Offline Mode Fallback]: forces batchSize = 1 when offline mode is active', async () => {
    useAppStore.setState({ isOfflineMode: true });
    useReaderConfigStore.setState({ batchChapterSize: 5 });

    const mockSingleData = {
      chapter: {
        chapterId: 'c1',
        chapterNumber: 1,
        title: 'Chương Đơn Offline',
        bookName: 'Truyện Đỉnh Cao',
        state: 'SUCCEEDED',
        totalTokens: 100,
        content: ['Nội dung offline'],
        rootTab: '',
      },
      navigation: {
        prev: null,
        next: null,
      },
    };

    vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue(mockSingleData as any);

    render(
      <MemoryRouter initialEntries={['/book/b1/chapter/c1']}>
        <Routes>
          <Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Chương Đơn Offline').length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    expect(ChapterRepository.getChapterContent).toHaveBeenCalledWith('c1', 1, false, '', 1);
  });
});
