// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookCard } from '../BookCard';
import { Book } from '../../../../shared/types';
import * as useHapticModule from '../../../../hooks/useHaptic';

const mockBook: Book = {
  bookId: 'book-action-test-1',
  bookName: 'Vũ Động Càn Khôn',
  chapterCount: 300,
  totalTranslated: 150,
  totalPending: 150,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02',
  lastReadChapter: { chapterId: 'c10', chapterNumber: '10', title: 'Đột phá Cảnh giới' },
};

describe('BookCard Quick Action Menu & Long Press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useHapticModule, 'triggerHaptic').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders 3-dot button and opens BookActionSheet when clicked', () => {
    render(
      <MemoryRouter>
        <BookCard book={mockBook} activeTab="ALL" />
      </MemoryRouter>
    );

    const moreButton = screen.getByRole('button', { name: /Tùy chọn cho truyện Vũ Động Càn Khôn/i });
    expect(moreButton).toBeDefined();

    fireEvent.click(moreButton);

    // Dialog should be visible with actions
    expect(screen.getByRole('dialog', { name: /Thao tác cho truyện Vũ Động Càn Khôn/i })).toBeDefined();
    expect(screen.getByText('Đọc tiếp')).toBeDefined();
    expect(screen.getByText('Mục lục')).toBeDefined();
    expect(screen.getByText('Dịch AI')).toBeDefined();
    expect(screen.getByText('Dịch tiêu đề')).toBeDefined();
    expect(screen.getByText('Dịch tên')).toBeDefined();
    expect(screen.getByText('Dịch POV')).toBeDefined();
    expect(screen.getByText('Tab mới')).toBeDefined();
    expect(screen.getByText('Tải về')).toBeDefined();
  });

  it('opens BookActionSheet on touch long-press (after 400ms hold)', () => {
    vi.useFakeTimers();

    const { container } = render(
      <MemoryRouter>
        <BookCard book={mockBook} activeTab="ALL" />
      </MemoryRouter>
    );

    const card = container.querySelector('.group.relative.z-10');
    expect(card).toBeDefined();

    // Start touch
    fireEvent.touchStart(card!, {
      touches: [{ clientX: 100, clientY: 100 }],
    });

    // Advance 400ms
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole('dialog', { name: /Thao tác cho truyện Vũ Động Càn Khôn/i })).toBeDefined();

    vi.useRealTimers();
  });

  it('triggers AI API calls when clicking Dịch tiêu đề, Dịch tên, Dịch POV without waiting', async () => {
    const { AIRepository } = await import('../../../../repositories/AIRepository');
    vi.spyOn(AIRepository, 'translateChineseTitles').mockResolvedValue({});
    vi.spyOn(AIRepository, 'detectProperNouns').mockResolvedValue({});
    vi.spyOn(AIRepository, 'detectTagsAndPov').mockResolvedValue({ tags: ['Tiên Hiệp'], pointOfView: 'Ngôi thứ 3' });

    render(
      <MemoryRouter>
        <BookCard book={mockBook} activeTab="ALL" />
      </MemoryRouter>
    );

    const moreButton = screen.getByRole('button', { name: /Tùy chọn cho truyện Vũ Động Càn Khôn/i });
    fireEvent.click(moreButton);

    const titleBtn = screen.getByText('Dịch tiêu đề');
    fireEvent.click(titleBtn);
    expect(AIRepository.translateChineseTitles).toHaveBeenCalledWith({ bookId: 'book-action-test-1' });

    // Open again
    fireEvent.click(moreButton);
    const nameBtn = screen.getByText('Dịch tên');
    fireEvent.click(nameBtn);
    expect(AIRepository.detectProperNouns).toHaveBeenCalledWith({ bookId: 'book-action-test-1' });

    // Open again
    fireEvent.click(moreButton);
    const povBtn = screen.getByText('Dịch POV');
    fireEvent.click(povBtn);
    expect(AIRepository.detectTagsAndPov).toHaveBeenCalledWith({ bookId: 'book-action-test-1' });
  });
});

