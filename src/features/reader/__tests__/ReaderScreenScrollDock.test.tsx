// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as readerContentViews from '@/features/reader/components/ReaderContentViews';
import { ReaderScreen } from '@/features/reader/ReaderScreen';
import * as edgeBgmModule from '@/hooks/useEdgeReadAloudBgm';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';

vi.mock('../../../repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapterContent: vi.fn(),
		getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
	},
}));

vi.mock('../../../repositories/BookRepository', () => ({
	BookRepository: {
		getBookDetail: vi.fn().mockResolvedValue({ book: { title: 'Test Book' } }),
		updateLastReadChapter: vi.fn().mockResolvedValue({}),
	},
}));

describe('ReaderScreen Scroll Visibility & Dock Auto-Hide', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollTo = vi.fn();
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(performance.now());
			return 1;
		});

		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'c1',
				chapterNumber: 1,
				title: 'Chương 1: Mở đầu',
				bookName: 'Đại Đạo Triều Thiên',
				state: 'SUCCEEDED',
				content: ['Đoạn văn 1 dài', 'Đoạn văn 2 dài', 'Đoạn văn 3 dài'],
			},
			chapters: [
				{
					chapterId: 'c1',
					chapterNumber: 1,
					title: 'Chương 1: Mở đầu',
					bookName: 'Đại Đạo Triều Thiên',
					state: 'SUCCEEDED',
					content: ['Đoạn văn 1 dài', 'Đoạn văn 2 dài', 'Đoạn văn 3 dài'],
				},
			],
			navigation: {
				prev: null,
				next: { chapterId: 'c2', chapterNumber: 2, title: 'Chương 2' },
			},
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('QC-1: Tự động ẩn thanh dock điều khiển khi scroll down và hiện lại khi scroll up', async () => {
		render(
			<MemoryRouter initialEntries={['/books/b1/chapters/c1']}>
				<Routes>
					<Route path="/books/:bookId/chapters/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getAllByText('Chương 1: Mở đầu').length).toBeGreaterThan(0);
		});

		const getDock = () => document.querySelector('.fixed.bottom-\\[max\\(1rem\\,env\\(safe-area-inset-bottom\\)\\)\\]');
		expect(getDock()?.classList.contains('translate-y-0')).toBe(true);

		// Giả lập cuộn xuống (scroll down 120px)
		act(() => {
			Object.defineProperty(window, 'scrollY', { value: 120, writable: true });
			fireEvent.scroll(window);
		});

		// Dock ẩn đi khi scroll down
		await waitFor(() => {
			expect(getDock()?.classList.contains('translate-y-16')).toBe(true);
		});

		// Giả lập cuộn ngược lên (scroll up)
		act(() => {
			Object.defineProperty(window, 'scrollY', { value: 40, writable: true });
			fireEvent.scroll(window);
		});

		// Dock hiện lại khi scroll up
		await waitFor(() => {
			expect(getDock()?.classList.contains('translate-y-0')).toBe(true);
		});
	});

	it('updates scroll progress without re-rendering the reader content tree', async () => {
		const activeViewSpy = vi.spyOn(readerContentViews, 'ReaderActiveView');
		Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1100 });
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 100 });

		render(
			<MemoryRouter initialEntries={['/books/b1/chapters/c1']}>
				<Routes>
					<Route path="/books/:bookId/chapters/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getAllByText('Chương 1: Mở đầu').length).toBeGreaterThan(0);
		});
		activeViewSpy.mockClear();

		act(() => {
			Object.defineProperty(window, 'scrollY', { value: 10, configurable: true });
			fireEvent.scroll(window);
		});

		await waitFor(() => {
			const progress = document.querySelector('header > div:last-child > div');
			expect(progress?.getAttribute('style')).toContain('scaleX(0.01)');
		});
		expect(activeViewSpy).not.toHaveBeenCalled();
		expect(ChapterRepository.getChapterContent).toHaveBeenCalledTimes(1);
	});

	it('QC-2: Khi Edge Read Aloud đang active, double-tap vẫn ẩn/hiện thanh dock không bị chặn', async () => {
		// Mock Edge Read Aloud active
		vi.spyOn(edgeBgmModule, 'isEdgeReadAloudActive').mockReturnValue(true);

		render(
			<MemoryRouter initialEntries={['/books/b1/chapters/c1']}>
				<Routes>
					<Route path="/books/:bookId/chapters/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getAllByText('Chương 1: Mở đầu').length).toBeGreaterThan(0);
		});

		const getDock = () => document.querySelector('.fixed.bottom-\\[max\\(1rem\\,env\\(safe-area-inset-bottom\\)\\)\\]');
		expect(getDock()?.classList.contains('translate-y-0')).toBe(true);

		const mainContainer = document.querySelector('article') || document.body;

		// Double click vào vùng đọc
		act(() => {
			fireEvent.doubleClick(mainContainer);
		});

		await waitFor(() => {
			expect(getDock()?.classList.contains('translate-y-16')).toBe(true);
		});
	});
});
