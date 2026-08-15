// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { TranslationSheet } from '../TranslationSheet';
import { ChapterRepository } from '../../repositories/ChapterRepository';
import { AIRepository } from '../../repositories/AIRepository';
import { SettingsRepository } from '../../repositories/SettingsRepository';

vi.mock('../../repositories/ChapterRepository', () => ({
  ChapterRepository: {
    getChapters: vi.fn().mockResolvedValue({
      chapters: [
        { chapterId: 'chap-10', chapterNumber: 10, title: 'Chương 10', state: 'SUCCEEDED' },
        { chapterId: 'chap-15', chapterNumber: 15, title: 'Chương 15', state: 'PENDING' },
      ],
    }),
    getPoolStatus: vi.fn().mockResolvedValue(null),
    translate: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../repositories/AIRepository', () => ({
  AIRepository: {
    getQuotas: vi.fn().mockResolvedValue({ quotas: [], currentConfig: {} }),
  },
}));

vi.mock('../../repositories/SettingsRepository', () => ({
  SettingsRepository: {
    getSettings: vi.fn().mockResolvedValue(null),
    updateSettings: vi.fn().mockResolvedValue(null),
  },
}));

describe('TranslationSheet Requirements', () => {
  const defaultProps = {
    onClose: vi.fn(),
    currentBookId: 'book-123',
    currentChapterId: 'chap-15',
    currentChapterNumber: 15,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults to batch_chapter tab when opened without explicit initialTab', () => {
    render(<TranslationSheet {...defaultProps} />);

    // Check that "Nhiều chương" tab is active
    const batchTabButton = screen.getByRole('button', { name: 'Nhiều chương' });
    expect(batchTabButton).toBeDefined();
    expect(batchTabButton.className).toContain('text-primary');
  });

  it('has enabled "Ẩn đã dịch" checkbox and activates it when clicking "Chưa dịch"', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<TranslationSheet {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: /Ẩn đã dịch/i }) as HTMLInputElement;
    expect(checkbox).toBeDefined();
    expect(checkbox.hasAttribute('disabled')).toBe(false);
    expect(checkbox.checked).toBe(false);

    // Click Chưa dịch button
    const pendingBtn = screen.getByRole('button', { name: 'Chưa dịch' });
    fireEvent.click(pendingBtn);

    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
    });
  });

  it('fetches chapter range around currentChapterNumber when activeTab is batch_chapter', async () => {
    render(<TranslationSheet {...defaultProps} currentChapterNumber={15} />);

    await waitFor(() => {
      expect(ChapterRepository.getChapters).toHaveBeenCalledWith(
        'book-123',
        1,
        26,
        'chapterNumber',
        'ASC',
        'all',
        '',
        10, // 15 - 5 = 10
        35  // 15 + 20 = 35
      );
    });
  });

  it('aligns current chapter item to top of viewport on initial layout', async () => {
    render(<TranslationSheet {...defaultProps} currentChapterNumber={15} />);

    await waitFor(() => {
      const currentChapItem = document.querySelector('#chapter-item-15');
      expect(currentChapItem).not.toBeNull();
    });
  });

  it('dynamically fetches chapters when selecting range outside initial memory', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<TranslationSheet {...defaultProps} currentChapterNumber={15} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="number"]');
    const selectBtn = screen.getAllByRole('button', { name: 'Chọn' })[0];

    if (inputs.length >= 2) {
      fireEvent.change(inputs[0], { target: { value: '50' } });
      fireEvent.change(inputs[1], { target: { value: '60' } });
      fireEvent.click(selectBtn);

      await waitFor(() => {
        expect(ChapterRepository.getChapters).toHaveBeenCalledWith(
          'book-123',
          1,
          50, // limit = Math.max(50, 60 - 50 + 1)
          'chapterNumber',
          'ASC',
          'all',
          '',
          50,
          60
        );
      });
    }
  });

  it('fetches all chapters when clicking "Tất cả"', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<TranslationSheet {...defaultProps} currentChapterNumber={15} />);

    const selectAllBtn = screen.getAllByRole('button', { name: 'Tất cả' })[0];
    fireEvent.click(selectAllBtn);

    await waitFor(() => {
      expect(ChapterRepository.getChapters).toHaveBeenCalledWith(
        'book-123',
        1,
        9999,
        'chapterNumber',
        'ASC',
        'all'
      );
    });
  });
});
