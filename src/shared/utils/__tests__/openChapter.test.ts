// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openChapter, openNextChapter, openPrevChapter } from '../openChapter';

describe('openChapter utility', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = vi.fn();
    // Mock window.location reload
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        hash: '',
        reload: vi.fn(),
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('updates window.location.hash without calling reload when bookId and chapterId are valid', () => {
    openChapter('b123', 'c456');

    expect(window.location.hash).toBe('#/book/b123/chapter/c456');
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('does nothing if bookId or chapterId is missing', () => {
    openChapter('', 'c456');
    expect(window.location.hash).toBe('');
    expect(window.location.reload).not.toHaveBeenCalled();

    openChapter('b123', '');
    expect(window.location.hash).toBe('');
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('openNextChapter clears previous and next chapter progress, resets scroll, and navigates', () => {
    localStorage.setItem('reading_progress_b1_c1', JSON.stringify({ chapterId: 'c1', scrollY: 3000 }));
    localStorage.setItem('reading_progress_b1_c2', JSON.stringify({ chapterId: 'c2', scrollY: 2000 }));

    openNextChapter('b1', 'c1', 'c2');

    expect(localStorage.getItem('reading_progress_b1_c1')).toBeNull();
    expect(localStorage.getItem('reading_progress_b1_c2')).toBeNull();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(window.location.hash).toBe('#/book/b1/chapter/c2');
  });

  it('openPrevChapter resets scroll and navigates to previous chapter', () => {
    openPrevChapter('b1', 'c2', 'c1');

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(window.location.hash).toBe('#/book/b1/chapter/c1');
  });
});

