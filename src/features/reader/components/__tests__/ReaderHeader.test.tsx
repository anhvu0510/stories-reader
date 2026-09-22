// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReaderHeader } from '../ReaderHeader';

describe('ReaderHeader Component', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders book name and chapter title', () => {
    render(
      <MemoryRouter>
        <ReaderHeader
          bookId="b1"
          bookName="Tu Chân Giới"
          chapterNumber={10}
          chapterTitle="Chương 10: Trúc Cơ Kỳ"
          onOpenHistory={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Tu Chân Giới')).toBeDefined();
    expect(screen.getByText('Chương 10: Trúc Cơ Kỳ')).toBeDefined();
  });

  it('renders history button and triggers onOpenHistory when clicked', () => {
    const handleOpenHistory = vi.fn();

    render(
      <MemoryRouter>
        <ReaderHeader
          bookId="b1"
          bookName="Tu Chân Giới"
          chapterTitle="Chương 1"
          onOpenHistory={handleOpenHistory}
        />
      </MemoryRouter>
    );

    const historyBtn = screen.getByTitle('Lịch sử đọc gần đây');
    expect(historyBtn).toBeDefined();

    fireEvent.click(historyBtn);
    expect(handleOpenHistory).toHaveBeenCalledTimes(1);
  });
});
