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

  it('QC-1 & QC-2 [Instant Jump 0ms]: Render đủ nút số tròn mini và cuộn khi click', () => {
    const mockScrollIntoView = vi.fn();
    const sectionEl = document.createElement('div');
    sectionEl.id = 'chapter-section-c2';
    sectionEl.scrollIntoView = mockScrollIntoView;
    document.body.appendChild(sectionEl);

    render(
      <VerticalBatchChapterNav
        chapters={mockChapters}
        activeChapterId="c1"
        isVisible={true}
      />
    );

    const btn2 = screen.getByTitle('Chương 2: Đột phá');
    expect(btn2).toBeDefined();

    fireEvent.click(btn2);

    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    document.body.removeChild(sectionEl);
  });

  it('QC-3 [Active Highlight]: Highlight đĩa tròn mini active', () => {
    render(
      <VerticalBatchChapterNav
        chapters={mockChapters}
        activeChapterId="c2"
        isVisible={true}
      />
    );

    const activeBtn = screen.getByTitle('Chương 2: Đột phá');
    const inactiveBtn = screen.getByTitle('Chương 1: Khởi đầu');

    expect(activeBtn.className).toContain('bg-primary');
    expect(inactiveBtn.className).not.toContain('bg-primary text-on-primary');
  });

  it('QC-4 [Sync Dock Hide/Show]: Áp dụng class trượt ẩn khi isVisible === false', () => {
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
  });

  it('QC-6 [Highlight Line Jump]: Cuộn tới dòng có class .msreadout-line-highlight khi click nút LocateFixed', () => {
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

