// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReaderQuickControl } from '../ReaderQuickControl';

describe('ReaderQuickControl - Horizontal Chapter Circles above Range Button', () => {
  const mockChapters = [
    { chapterId: 'c551', chapterNumber: 551, title: 'Chương 551', content: [] },
    { chapterId: 'c552', chapterNumber: 552, title: 'Chương 552', content: [] },
    { chapterId: 'c553', chapterNumber: 553, title: 'Chương 553', content: [] },
  ];

  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders horizontal circular buttons for batch chapters 551, 552, 553 above range button', () => {
    render(
      <MemoryRouter>
        <ReaderQuickControl
          bookId="b1"
          chapterDisplayLabel="551 - 553"
          chapters={mockChapters}
          activeChapterId="c551"
          onOpenChapterSelect={vi.fn()}
          onOpenTranslation={vi.fn()}
        />
      </MemoryRouter>
    );

    // List menu button to open full chapter list sheet
    expect(screen.getByTitle('Mở danh sách tất cả các chương')).toBeDefined();

    // Horizontal circular buttons for loaded chapters
    expect(screen.getByTitle('Chương 551')).toBeDefined();
    expect(screen.getByText('551')).toBeDefined();
    expect(screen.getByText('552')).toBeDefined();
    expect(screen.getByText('553')).toBeDefined();
  });

  it('scrolls smooth to target chapter when clicking circular chapter button', () => {
    const mockScrollIntoView = vi.fn();
    const sectionEl = document.createElement('div');
    sectionEl.id = 'chapter-section-c552';
    sectionEl.scrollIntoView = mockScrollIntoView;
    document.body.appendChild(sectionEl);

    render(
      <MemoryRouter>
        <ReaderQuickControl
          bookId="b1"
          chapterDisplayLabel="551 - 553"
          chapters={mockChapters}
          activeChapterId="c551"
          onOpenChapterSelect={vi.fn()}
          onOpenTranslation={vi.fn()}
        />
      </MemoryRouter>
    );

    const circleBtn552 = screen.getByText('552');
    fireEvent.click(circleBtn552);

    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });

    document.body.removeChild(sectionEl);
  });

  it('calls onOpenChapterSelect when clicking the menu list button inside dock', () => {
    const mockOnOpenChapterSelect = vi.fn();
    render(
      <MemoryRouter>
        <ReaderQuickControl
          bookId="b1"
          chapterDisplayLabel="551 - 553"
          chapters={mockChapters}
          activeChapterId="c551"
          onOpenChapterSelect={mockOnOpenChapterSelect}
          onOpenTranslation={vi.fn()}
        />
      </MemoryRouter>
    );

    const listMenuBtn = screen.getByTitle('Mở danh sách tất cả các chương');
    fireEvent.click(listMenuBtn);

    expect(mockOnOpenChapterSelect).toHaveBeenCalledTimes(1);
  });
});
