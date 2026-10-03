// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';

import { QuickBookSheet } from '@/features/library/components/QuickBookSheet';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import type { Book, Chapter } from '@/shared/types';

const mockBook: Book = {
	bookId: 'book-quick-sheet-1',
	bookName: 'Đại Phụng Đả Canh Nhân',
	chapterCount: 100,
	totalTranslated: 80,
	totalPending: 20,
	createdAt: '2024-01-01',
	updatedAt: '2024-01-02',
	lastReadChapter: { chapterId: 'c-20', chapterNumber: '20', title: 'Chương 20: Manh mối' }
};

const mockChapters: Chapter[] = Array.from({ length: 30 }, (_, i) => ({
	chapterId: `c-${i + 15}`,
	chapterNumber: i + 15,
	title: `Chương ${i + 15}`,
	state: 'SUCCEEDED' as const,
	updatedAt: '2024-01-02'
}));

describe('QuickBookSheet Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(ChapterRepository, 'getChapters').mockResolvedValue({
			chapters: mockChapters,
			pagination: { currentPage: 1, totalPages: 4, total: 100 }
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders dialog with disableDrag to prevent conflicting with inner scrolling', async () => {
		const onClose = vi.fn();
		render(
			<MemoryRouter>
				<QuickBookSheet book={mockBook} onClose={onClose} />
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByText('Đại Phụng Đả Canh Nhân')).toBeDefined();
		});

		const dialog = screen.getByRole('dialog', { name: 'Đại Phụng Đả Canh Nhân' });
		expect(dialog).toBeDefined();

		// Should render chapter items
		await waitFor(() => {
			expect(screen.getByText('Chương 20')).toBeDefined();
		});

		const sheetContainer = screen.getByTestId('bottom-sheet-container');
		// When disableDrag={true}, drag is false so Framer Motion does not set touch-action: pan-x
		expect(sheetContainer.style.touchAction).not.toBe('pan-x');
	});

	it('matches active chapter by both chapterId and chapterNumber', async () => {
		const bookWithNumericChapter: Book = {
			...mockBook,
			lastReadChapter: { chapterId: 'different-id', chapterNumber: 20, title: 'Chương 20' }
		};

		render(
			<MemoryRouter>
				<QuickBookSheet book={bookWithNumericChapter} onClose={vi.fn()} />
			</MemoryRouter>
		);

		await waitFor(() => {
			// Find chapter 20 and verify it has active primary styling
			const activeItem = screen.getByText('Chương 20').closest('.group');
			expect(activeItem?.className).toContain('text-primary');
		});
	});
});
