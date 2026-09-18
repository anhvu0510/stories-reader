// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { VerticalBatchChapterNav } from '../VerticalBatchChapterNav';

describe('VerticalBatchChapterNav Component', () => {
  const mockChapters = [
    { chapterId: 'c1', chapterNumber: 1, title: 'Chương 1: Khởi đầu', content: [] },
    { chapterId: 'c2', chapterNumber: 2, title: 'Chương 2: Đột phá', content: [] },
    { chapterId: 'c3', chapterNumber: 3, title: 'Chương 3: Ngoại truyện', content: [] },
  ];

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('QC-5 [Single Chapter Hidden]: Ẩn khi chỉ có 1 chương trong lô', () => {
    const { container } = render(
      <VerticalBatchChapterNav
        chapters={[{ chapterId: 'c1', chapterNumber: 1, title: 'Chương 1', content: [] }]}
        activeChapterId="c1"
        isVisible={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('QC-1 [Locate Button Render]: Chỉ hiện khi Edge Read Aloud tạo class .msreadout-line-highlight', () => {
    const { container } = render(
      <VerticalBatchChapterNav
        chapters={mockChapters}
        activeChapterId="c1"
        isVisible={true}
      />
    );
    expect(container.firstChild).toBeNull();

    // Add highlight element to DOM
    const highlightEl = document.createElement('span');
    highlightEl.className = 'msreadout-line-highlight';
    document.body.appendChild(highlightEl);

    render(
      <VerticalBatchChapterNav
        chapters={mockChapters}
        activeChapterId="c1"
        isVisible={true}
      />
    );

    const locateBtn = screen.getByLabelText('Nhảy tới dòng đang đọc');
    expect(locateBtn).toBeDefined();

    document.body.removeChild(highlightEl);
  });

  it('QC-4 [Sync Dock Hide/Show]: Áp dụng class trượt ẩn khi isVisible === false', () => {
    const highlightEl = document.createElement('span');
    highlightEl.className = 'msreadout-line-highlight';
    document.body.appendChild(highlightEl);

    const { container } = render(
      <VerticalBatchChapterNav
        chapters={mockChapters}
        activeChapterId="c1"
        isVisible={false}
      />
    );

    const nav = container.firstChild as HTMLElement;
    expect(nav.className).toContain('-translate-x-12');
    expect(nav.className).toContain('opacity-0');

    document.body.removeChild(highlightEl);
  });

  it('QC-6 [Highlight Line Jump]: Cuộn tới dòng Edge Read Aloud khi click nút LocateFixed', () => {
    const mockScrollIntoView = vi.fn();
    const highlightEl = document.createElement('span');
    highlightEl.className = 'msreadout-line-highlight';
    highlightEl.scrollIntoView = mockScrollIntoView;
    document.body.appendChild(highlightEl);

    render(
      <VerticalBatchChapterNav
        chapters={mockChapters}
        activeChapterId="c1"
        isVisible={true}
      />
    );

    const locateBtn = screen.getByLabelText('Nhảy tới dòng đang đọc');
    expect(locateBtn).toBeDefined();

    fireEvent.click(locateBtn);

    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    document.body.removeChild(highlightEl);
  });
});

