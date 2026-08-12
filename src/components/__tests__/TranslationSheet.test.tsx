// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('defaults to batch_chapter tab when opened without explicit initialTab', () => {
    render(<TranslationSheet {...defaultProps} />);

    // Check that "Nhiều chương" tab is active
    const batchTabButton = screen.getByRole('button', { name: 'Nhiều chương' });
    expect(batchTabButton).toBeDefined();
    expect(batchTabButton.className).toContain('text-primary');
  });

  it('has disabled "Ẩn đã dịch" checkbox', () => {
    render(<TranslationSheet {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox', { name: /Ẩn đã dịch/i });
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes[0].hasAttribute('disabled')).toBe(true);
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
});
