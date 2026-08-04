// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickChapterSelectSheet } from '../QuickChapterSelectSheet';
import { downloadManager } from '../../../../lib/DownloadManager';
import { offlineDb } from '../../../../lib/offlineDb';

vi.mock('../../../../lib/DownloadManager', () => ({
  downloadManager: {
    addBook: vi.fn(),
    getTask: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../../../../lib/offlineDb', () => ({
  offlineDb: {
    getBook: vi.fn().mockImplementation((id: string) => {
      if (id === 'book-downloaded') {
        return Promise.resolve({ bookId: 'book-downloaded', bookName: 'Saved Book' });
      }
      return Promise.resolve(undefined);
    }),
    deleteBook: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../repositories/ChapterRepository', () => ({
  ChapterRepository: {
    getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
  },
}));

describe('QuickChapterSelectSheet Download Button & Mobile Confirm Modal', () => {
  const defaultProps = {
    bookId: 'book-test-1',
    currentChapterId: 'chap-1',
    currentChapterNumber: 1,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders download button next to close button in header and triggers downloadManager.addBook on click', () => {
    render(
      <MemoryRouter>
        <QuickChapterSelectSheet {...defaultProps} />
      </MemoryRouter>
    );

    const downloadBtn = screen.getByTitle(/Tải bộ truyện|Tải ngoại tuyến/i);
    expect(downloadBtn).toBeDefined();

    fireEvent.click(downloadBtn);
    expect(downloadManager.addBook).toHaveBeenCalledWith('book-test-1', expect.any(String));
  });

  it('opens mobile confirm dialog when clicking delete button, closes on cancel, and deletes on confirm', async () => {
    render(
      <MemoryRouter>
        <QuickChapterSelectSheet {...defaultProps} bookId="book-downloaded" />
      </MemoryRouter>
    );

    const deleteIconBtn = await screen.findByTitle(/Xóa khỏi máy|Xóa dữ liệu/i);
    expect(deleteIconBtn).toBeDefined();

    // Click Trash icon -> open modal
    fireEvent.click(deleteIconBtn);

    const modalTitle = screen.getByText('Xóa dữ liệu ngoại tuyến?');
    expect(modalTitle).toBeDefined();

    // Test cancel button
    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelBtn);
    expect(offlineDb.deleteBook).not.toHaveBeenCalled();

    // Click Trash icon again -> confirm delete
    fireEvent.click(deleteIconBtn);
    const confirmBtn = screen.getByRole('button', { name: 'Xóa khỏi máy' });
    fireEvent.click(confirmBtn);

    expect(offlineDb.deleteBook).toHaveBeenCalledWith('book-downloaded');
  });
});
