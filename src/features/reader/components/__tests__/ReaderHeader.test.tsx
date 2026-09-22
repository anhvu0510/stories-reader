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

  it('renders manual BGM toggle button when onToggleBgm is provided', () => {
    const handleToggleBgm = vi.fn();

    render(
      <MemoryRouter>
        <ReaderHeader
          bookId="b1"
          bookName="Tu Chân Giới"
          chapterTitle="Chương 1"
          isBgmActive={false}
          onToggleBgm={handleToggleBgm}
          onOpenHistory={vi.fn()}
        />
      </MemoryRouter>
    );

    const bgmBtn = screen.getByTitle('Bật nhạc nền thư giãn');
    expect(bgmBtn).toBeDefined();

    fireEvent.click(bgmBtn);
    expect(handleToggleBgm).toHaveBeenCalledTimes(1);
  });

  it('displays active state and proper title when isBgmActive is true', () => {
    render(
      <MemoryRouter>
        <ReaderHeader
          bookId="b1"
          bookName="Tu Chân Giới"
          chapterTitle="Chương 1"
          isBgmActive={true}
          onToggleBgm={vi.fn()}
          onOpenHistory={vi.fn()}
        />
      </MemoryRouter>
    );

    const activeBgmBtn = screen.getByTitle('Tắt nhạc nền (Đang phát)');
    expect(activeBgmBtn).toBeDefined();
    expect(activeBgmBtn.className).toContain('text-primary');
  });
});
