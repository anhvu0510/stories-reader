// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChapterRepository } from '../ChapterRepository';
import { offlineDb } from '../../lib/offlineDb';
import { useAppStore } from '../../stores/useAppStore';

vi.mock('../../lib/offlineDb', () => ({
  offlineDb: {
    getChapterContent: vi.fn(),
    getChapterMeta: vi.fn(),
    getChapters: vi.fn(),
    getReplacements: vi.fn().mockResolvedValue([]),
  },
}));

describe('ChapterRepository - Offline Batch Chapters (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ isOfflineMode: true });
  });

  it('QC-1 [Tier 1 - Happy Path]: loads multiple chapters from offlineDb when batchSize > 1', async () => {
    const bookChapters = [
      { chapterId: 'c1', bookId: 'b1', chapterNumber: 1, title: 'Chương 1' },
      { chapterId: 'c2', bookId: 'b1', chapterNumber: 2, title: 'Chương 2' },
      { chapterId: 'c3', bookId: 'b1', chapterNumber: 3, title: 'Chương 3' },
      { chapterId: 'c4', bookId: 'b1', chapterNumber: 4, title: 'Chương 4' },
    ];

    vi.mocked(offlineDb.getChapterMeta).mockResolvedValue(bookChapters[0] as any);
    vi.mocked(offlineDb.getChapters).mockResolvedValue(bookChapters as any);

    vi.mocked(offlineDb.getChapterContent).mockImplementation(async (id: string) => {
      if (id === 'c1') {
        return {
          chapter: { chapterId: 'c1', bookId: 'b1', chapterNumber: 1, title: 'Chương 1', content: ['Nội dung 1'] },
          navigation: { prev: null, next: null },
        } as any;
      }
      if (id === 'c2') {
        return {
          chapter: { chapterId: 'c2', bookId: 'b1', chapterNumber: 2, title: 'Chương 2', content: ['Nội dung 2'] },
          navigation: { prev: null, next: null },
        } as any;
      }
      if (id === 'c3') {
        return {
          chapter: { chapterId: 'c3', bookId: 'b1', chapterNumber: 3, title: 'Chương 3', content: ['Nội dung 3'] },
          navigation: { prev: null, next: null },
        } as any;
      }
      return undefined;
    });

    const result = await ChapterRepository.getChapterContent('c1', 1, false, '', 3);

    expect(result.chapter.chapterId).toBe('c1');
    expect(result.chapters).toBeDefined();
    expect(result.chapters?.length).toBe(3);
    expect(result.chapters?.[0].chapterNumber).toBe(1);
    expect(result.chapters?.[1].chapterNumber).toBe(2);
    expect(result.chapters?.[2].chapterNumber).toBe(3);
    expect(result.navigation.next?.chapterId).toBe('c4');
    expect(result.navigation.prev).toBeNull();
  });

  it('QC-3 [Tier 2 - Boundary/Edge]: calculates prev batch jump properly in offline mode', async () => {
    const bookChapters = [
      { chapterId: 'c1', bookId: 'b1', chapterNumber: 1, title: 'Chương 1' },
      { chapterId: 'c2', bookId: 'b1', chapterNumber: 2, title: 'Chương 2' },
      { chapterId: 'c3', bookId: 'b1', chapterNumber: 3, title: 'Chương 3' },
      { chapterId: 'c4', bookId: 'b1', chapterNumber: 4, title: 'Chương 4' },
      { chapterId: 'c5', bookId: 'b1', chapterNumber: 5, title: 'Chương 5' },
      { chapterId: 'c6', bookId: 'b1', chapterNumber: 6, title: 'Chương 6' },
    ];

    vi.mocked(offlineDb.getChapterMeta).mockResolvedValue(bookChapters[3] as any);
    vi.mocked(offlineDb.getChapters).mockResolvedValue(bookChapters as any);

    vi.mocked(offlineDb.getChapterContent).mockImplementation(async (id: string) => {
      const found = bookChapters.find((c) => c.chapterId === id);
      if (found) {
        return {
          chapter: { ...found, content: [`Nội dung ${found.chapterNumber}`] },
          navigation: { prev: null, next: null },
        } as any;
      }
      return undefined;
    });

    // Reading from c4 with batchSize 3 (c4, c5, c6). Prev should jump back 3 chapters to c1
    const result = await ChapterRepository.getChapterContent('c4', 1, false, '', 3);

    expect(result.chapters?.length).toBe(3);
    expect(result.navigation.prev?.chapterId).toBe('c1');
    expect(result.navigation.next).toBeNull();
  });

  it('QC-4 [Tier 2 - Boundary/Edge]: returns remaining chapters when near end of book', async () => {
    const bookChapters = [
      { chapterId: 'c1', bookId: 'b1', chapterNumber: 1, title: 'Chương 1' },
      { chapterId: 'c2', bookId: 'b1', chapterNumber: 2, title: 'Chương 2' },
      { chapterId: 'c3', bookId: 'b1', chapterNumber: 3, title: 'Chương 3' },
      { chapterId: 'c4', bookId: 'b1', chapterNumber: 4, title: 'Chương 4' },
      { chapterId: 'c5', bookId: 'b1', chapterNumber: 5, title: 'Chương 5' },
    ];

    vi.mocked(offlineDb.getChapterMeta).mockResolvedValue(bookChapters[3] as any);
    vi.mocked(offlineDb.getChapters).mockResolvedValue(bookChapters as any);

    vi.mocked(offlineDb.getChapterContent).mockImplementation(async (id: string) => {
      const found = bookChapters.find((c) => c.chapterId === id);
      if (found) {
        return {
          chapter: { ...found, content: [`Nội dung ${found.chapterNumber}`] },
          navigation: { prev: null, next: null },
        } as any;
      }
      return undefined;
    });

    const result = await ChapterRepository.getChapterContent('c4', 1, false, '', 3);

    expect(result.chapters?.length).toBe(2);
    expect(result.chapters?.[0].chapterNumber).toBe(4);
    expect(result.chapters?.[1].chapterNumber).toBe(5);
    expect(result.navigation.next).toBeNull();
  });

  it('QC-5 [Tier 3 - Error/Resilience]: gracefully falls back to available chapters if next is missing in offlineDb', async () => {
    const bookChapters = [
      { chapterId: 'c1', bookId: 'b1', chapterNumber: 1, title: 'Chương 1' },
      { chapterId: 'c2', bookId: 'b1', chapterNumber: 2, title: 'Chương 2' },
      { chapterId: 'c3', bookId: 'b1', chapterNumber: 3, title: 'Chương 3' },
    ];

    vi.mocked(offlineDb.getChapterMeta).mockResolvedValue(bookChapters[0] as any);
    vi.mocked(offlineDb.getChapters).mockResolvedValue(bookChapters as any);

    vi.mocked(offlineDb.getChapterContent).mockImplementation(async (id: string) => {
      if (id === 'c1') {
        return {
          chapter: { chapterId: 'c1', bookId: 'b1', chapterNumber: 1, title: 'Chương 1', content: ['Nội dung 1'] },
          navigation: { prev: null, next: null },
        } as any;
      }
      // c2 is not downloaded
      return undefined;
    });

    const result = await ChapterRepository.getChapterContent('c1', 1, false, '', 3);

    expect(result.chapter.chapterId).toBe('c1');
    expect(result.chapters?.length).toBe(1);
    expect(result.chapters?.[0].chapterNumber).toBe(1);
  });
});
