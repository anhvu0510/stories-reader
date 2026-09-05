// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadingProgress } from '../useReadingProgress';

describe('useReadingProgress Hook', () => {
  const bookId = 'book_123';
  const chapterId = 'chap_1';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('QC-1 [Happy Path]: Lưu thông tin scrollY khi scroll và khi tab hidden', () => {
    const { unmount } = renderHook(() =>
      useReadingProgress(bookId, chapterId, true)
    );

    // Mock scrollY
    Object.defineProperty(window, 'scrollY', { value: 1250, writable: true, configurable: true });

    // Trigger visibilitychange hidden
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const stored = localStorage.getItem(`reading_progress_${bookId}_${chapterId}`);
    expect(stored).not.toBeNull();
    const data = JSON.parse(stored!);
    expect(data.chapterId).toBe('chap_1');
    expect(data.scrollY).toBe(1250);

    unmount();
  });

  it('QC-2 [Next Chapter]: Reset scroll = 0 khi đổi sang chapterId mới', () => {
    // Preset old chapter cache
    localStorage.setItem(
      `reading_progress_${bookId}_chap_1`,
      JSON.stringify({ chapterId: 'chap_1', scrollY: 800, updatedAt: Date.now() })
    );

    const { rerender } = renderHook(
      ({ cId }) => useReadingProgress(bookId, cId, true),
      { initialProps: { cId: 'chap_1' } }
    );

    // Change chapter to chap_2
    act(() => {
      rerender({ cId: 'chap_2' });
    });

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(localStorage.getItem(`reading_progress_${bookId}_chap_1`)).toBeNull();
  });

  it('QC-3 [Auto Restore]: Tự động scroll đến vị trí đọc cũ khi content ready', async () => {
    // Preset saved position for chap_1
    localStorage.setItem(
      `reading_progress_${bookId}_${chapterId}`,
      JSON.stringify({ chapterId, scrollY: 1500, updatedAt: Date.now() })
    );

    renderHook(() => useReadingProgress(bookId, chapterId, true));

    // Wait for animation frame / timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: 'instant' });
  });

  it('QC-4 [Auto Cleanup]: Tự động dọn dẹp các cache quá giới hạn maxItems', () => {
    // Fill 25 items
    for (let i = 1; i <= 25; i++) {
      localStorage.setItem(
        `reading_progress_book_${i}_chap_1`,
        JSON.stringify({ chapterId: 'chap_1', scrollY: 100, updatedAt: Date.now() - (25 - i) * 1000 })
      );
    }

    renderHook(() => useReadingProgress('new_book', 'new_chap', true));

    // Trigger save to run cleanup
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Count reading_progress_ keys
    const progressKeys = Object.keys(localStorage).filter((k) => k.startsWith('reading_progress_'));
    expect(progressKeys.length).toBeLessThanOrEqual(21);
  });

  it('QC-5 [Resilience]: Xử lý an toàn khi localStorage bị lỗi', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage error');
    });

    expect(() => {
      renderHook(() => useReadingProgress(bookId, chapterId, true));
    }).not.toThrow();
  });

  it('QC-6 [Paragraph Level Restore]: Cuộn chính xác theo đoạn văn khi có paragraphIndex', async () => {
    const mockScrollIntoView = vi.fn();
    const sectionEl = document.createElement('section');
    sectionEl.id = 'chapter-section-chap_3';
    const paraEl = document.createElement('div');
    paraEl.setAttribute('data-paragraph-index', '5');
    paraEl.scrollIntoView = mockScrollIntoView;
    sectionEl.appendChild(paraEl);
    document.body.appendChild(sectionEl);

    localStorage.setItem(
      `reading_progress_${bookId}_${chapterId}`,
      JSON.stringify({
        chapterId,
        activeChapterId: 'chap_3',
        paragraphIndex: 5,
        scrollY: 2000,
        updatedAt: Date.now(),
      })
    );

    renderHook(() => useReadingProgress(bookId, chapterId, true));

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    expect(paraEl.className).toContain('bg-primary/20');

    document.body.removeChild(sectionEl);
  });
});

