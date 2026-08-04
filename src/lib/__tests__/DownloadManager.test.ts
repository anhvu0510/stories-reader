// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import oboe from 'oboe';
import { downloadManager } from '../DownloadManager';
import { offlineDb } from '../offlineDb';
import { useAppStore } from '../../stores/useAppStore';

let oboeNodeHandlers: Record<string, Function> = {};
let doneHandler: Function = () => {};
let lastOptions: any = null;

vi.mock('oboe', () => {
  return {
    default: vi.fn((options: any) => {
      lastOptions = options;
      oboeNodeHandlers = {};
      doneHandler = () => {};

      const mockStream = {
        node: vi.fn((pattern: string, cb: Function) => {
          oboeNodeHandlers[pattern] = cb;
          return mockStream;
        }),
        done: vi.fn((cb: Function) => {
          doneHandler = cb;
          return mockStream;
        }),
        fail: vi.fn(() => mockStream),
        abort: vi.fn(),
      };
      return mockStream;
    }),
    drop: Symbol('oboe.drop'),
  };
});

describe('DownloadManager Stream & ID Normalization', () => {
  beforeEach(async () => {
    await offlineDb.deleteAllBooks();
    useAppStore.setState({
      activeDomain: { id: '1', name: 'Local', url: 'http://localhost:3000/' },
      activeDomainId: '1',
    });
  });

  it('normalizes book and chapter IDs when server returns _id or id instead of bookId or chapterId', async () => {
    downloadManager.addBook('book-123', 'Test Story');

    await new Promise((r) => setTimeout(r, 20));

    expect(lastOptions.url).toBe('http://localhost:3000/api/books/download');

    const bookHandler = oboeNodeHandlers['data.*.book'];
    expect(bookHandler).toBeDefined();

    bookHandler({ _id: 'book-123', bookName: 'Test Story', chapterCount: 2 });

    const chapterHandler = oboeNodeHandlers['data.*.chapters.*'];
    expect(chapterHandler).toBeDefined();

    chapterHandler({ _id: 'chap-1', chapterNumber: 1, title: 'Chap 1', content: ['Line 1'] });
    chapterHandler({ id: 'chap-2', chapterNumber: 2, title: 'Chap 2', content: ['Line 2'] });

    await doneHandler();

    const savedBook = await offlineDb.getBook('book-123');
    expect(savedBook).toBeDefined();
    expect(savedBook?.bookId).toBe('book-123');

    const savedChapters = await offlineDb.getChapters('book-123');
    expect(savedChapters.length).toBe(2);
    expect(savedChapters[0].chapterId).toBe('chap-1');
    expect(savedChapters[1].chapterId).toBe('chap-2');
  });

  it('handles object node matching for data.book and data.chapters.* patterns', async () => {
    useAppStore.setState({
      activeDomain: { id: '1', name: 'Local', url: 'http://api.example.com' },
      activeDomainId: '1',
    });

    downloadManager.addBook('book-456', 'Another Story');

    await new Promise((r) => setTimeout(r, 20));

    expect(lastOptions.url).toBe('http://api.example.com/api/books/download');

    const bookHandler = oboeNodeHandlers['data.book'];
    expect(bookHandler).toBeDefined();

    bookHandler({ bookId: 'book-456', bookName: 'Another Story', chapterCount: 1 });

    const chapterHandler = oboeNodeHandlers['data.chapters.*'];
    expect(chapterHandler).toBeDefined();

    chapterHandler({ chapterId: 'chap-100', chapterNumber: 1, title: 'Chap 100', content: ['Content line'] });

    await doneHandler();

    const savedBook = await offlineDb.getBook('book-456');
    expect(savedBook?.bookName).toBe('Another Story');

    const savedChapters = await offlineDb.getChapters('book-456');
    expect(savedChapters.length).toBe(1);
    expect(savedChapters[0].chapterId).toBe('chap-100');
  });
});
