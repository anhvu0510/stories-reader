// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReaderScreen } from '@/features/reader/ReaderScreen';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { BookRepository } from '@/repositories/BookRepository';

vi.mock('../../../repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapterContent: vi.fn(),
		getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
		getLatestChapter: vi.fn().mockResolvedValue(null)
	}
}));

vi.mock('../../../repositories/BookRepository', () => ({
	BookRepository: {
		getBookDetail: vi.fn().mockResolvedValue({ book: { title: 'Test Book' } }),
		updateLastReadChapter: vi.fn().mockResolvedValue({})
	}
}));

vi.mock('@/hooks/useEdgeReadAloudBgm', () => ({
	isEdgeReadAloudActive: vi.fn().mockReturnValue(false),
	useEdgeReadAloudBgm: vi.fn().mockReturnValue({
		isBgmPlaying: false,
		toggleBgm: vi.fn(),
		setBgmVolume: vi.fn(),
		bgmVolume: 0.3
	})
}));

describe('ReaderScreen - Swipe Skeleton Loading Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollTo = vi.fn();
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	afterEach(() => {
		cleanup();
	});

	it('displays rich multi-layer skeleton screen while chapter is loading', async () => {
		let resolveChapter: (data: any) => void;
		const chapterPromise = new Promise((resolve) => {
			resolveChapter = resolve;
		});

		vi.mocked(ChapterRepository.getChapterContent).mockReturnValue(chapterPromise as any);

		render(
			<MemoryRouter initialEntries={['/book/b1/chapter/chap-1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		// Trong khi đang loading, Skeleton Screen phải xuất hiện
		expect(screen.getByTestId('reader-chapter-skeleton')).toBeDefined();

		// Khi dữ liệu tải xong
		act(() => {
			resolveChapter!({
				chapter: {
					chapterId: 'chap-1',
					chapterNumber: 1,
					title: 'Chương 1: Mở Đầu Hùng Tráng',
					bookName: 'Test Book',
					content: ['<p>Nội dung chương 1 đầy đủ</p>']
				},
				navigation: {
					prev: null,
					next: { chapterId: 'chap-2', chapterNumber: 2, title: 'Chương 2' }
				}
			});
		});

		// Chờ nội dung thật xuất hiện
		await waitFor(() => {
			expect(screen.getByText('Nội dung chương 1 đầy đủ')).toBeDefined();
		});
	});
});
