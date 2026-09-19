// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openChapter } from '../openChapter';

describe('openChapter utility', () => {
  const originalLocation = window.location;

  beforeEach(() => {
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
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('updates window.location.hash and calls reload when bookId and chapterId are valid', () => {
    openChapter('b123', 'c456');

    expect(window.location.hash).toBe('#/book/b123/chapter/c456');
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing if bookId or chapterId is missing', () => {
    openChapter('', 'c456');
    expect(window.location.reload).not.toHaveBeenCalled();

    openChapter('b123', '');
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
