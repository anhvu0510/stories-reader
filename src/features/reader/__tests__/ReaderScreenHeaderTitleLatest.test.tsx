// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ReaderScreen } from '@/features/reader/ReaderScreen';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';

vi.mock('../../../repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapterContent: vi.fn(),
		getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
		getLatestChapter: vi.fn()
	}
}));

vi.mock('../../../repositories/BookRepository', () => ({
	BookRepository: {
		getLastReadChapter: vi.fn(),
		getBook: vi.fn(),
		updateLastReadChapter: vi.fn().mockResolvedValue({})
	}
}));

vi.mock('../../../hooks/useReadAloud', () => ({
	useReadAloud: () => ({
		isPlaying: false,
		isPaused: false,
		currentChunkIndex: 0,
		activeParagraphIndex: 0,
		startReading: vi.fn(),
		pauseReading: vi.fn(),
		stopReading: vi.fn(),
		nextSection: vi.fn(),
		prevSection: vi.fn()
	})
}));

describe('ReaderScreen - Title Bar Actions (Single Click Read Aloud & Double Click Force Reload)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollTo = vi.fn();
		useAppStore.setState({ isOfflineMode: false });
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('QC-1: Double click header title reloads current chapter with forceFresh: true directly from API', async () => {
		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'chap-1',
				chapterNumber: 1,
				title: 'Chương 1: Khởi đầu',
				bookName: 'Đại Phụng Đả Canh Nhân',
				content: ['Nội dung chương 1']
			}
		});

		render(
			<MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByText('Đại Phụng Đả Canh Nhân')).toBeDefined();
		});

		// Initial load called without forceFresh
		expect(ChapterRepository.getChapterContent).toHaveBeenCalledWith('chap-1', expect.any(Number), expect.any(Boolean), '', expect.any(Number));

		const titleBtn = screen.getByText(/Đại Phụng/).closest('button')!;

		// Double click: 2 clicks within 100ms
		fireEvent.click(titleBtn);
		fireEvent.click(titleBtn);

		await waitFor(() => {
			expect(ChapterRepository.getChapterContent).toHaveBeenLastCalledWith(
				'chap-1',
				expect.any(Number),
				expect.any(Boolean),
				'',
				expect.any(Number),
				{ forceFresh: true }
			);
		});
	});

	it('QC-2: Single click header title scrolls to read aloud highlight element', async () => {
		vi.useFakeTimers();

		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'chap-1',
				chapterNumber: 1,
				title: 'Chương 1: Khởi đầu',
				bookName: 'Đại Phụng Đả Canh Nhân',
				content: ['Nội dung câu 1', 'Nội dung câu 2']
			}
		});

		render(
			<MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		// Allow async promises to resolve under fake timers
		await act(async () => {
			await vi.runAllTimersAsync();
		});

		expect(screen.getByText('Đại Phụng Đả Canh Nhân')).toBeDefined();

		// Add mock read aloud element in DOM
		const highlightSpan = document.createElement('span');
		highlightSpan.className = 'msreadout-line-highlight';
		const scrollMock = vi.fn();
		highlightSpan.scrollIntoView = scrollMock;
		document.body.appendChild(highlightSpan);

		const titleBtn = screen.getByText(/Đại Phụng/).closest('button')!;

		// Single click
		fireEvent.click(titleBtn);

		// Advance timer for 250ms debounce
		act(() => {
			vi.advanceTimersByTime(250);
		});

		expect(scrollMock).toHaveBeenCalledWith({
			behavior: 'smooth',
			block: 'center'
		});

		document.body.removeChild(highlightSpan);
	});

	it('QC-3: Single click header title falls back to window.scrollTo top if no read-aloud element is found', async () => {
		vi.useFakeTimers();

		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'chap-1',
				chapterNumber: 1,
				title: 'Chương 1: Khởi đầu',
				bookName: 'Đại Phụng Đả Canh Nhân',
				content: ['Nội dung']
			}
		});

		render(
			<MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await act(async () => {
			await vi.runAllTimersAsync();
		});

		expect(screen.getByText('Đại Phụng Đả Canh Nhân')).toBeDefined();

		const titleBtn = screen.getByText(/Đại Phụng/).closest('button')!;
		fireEvent.click(titleBtn);

		act(() => {
			vi.advanceTimersByTime(250);
		});

		expect(window.scrollTo).toHaveBeenCalledWith({
			top: 0,
			behavior: 'smooth'
		});
	});

	it('QC-4: Handles network error gracefully on double click with error toast feedback', async () => {
		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValueOnce({
			chapter: {
				chapterId: 'chap-1',
				chapterNumber: 1,
				title: 'Chương 1',
				bookName: 'Đại Phụng',
				content: ['Nội dung']
			}
		});

		render(
			<MemoryRouter initialEntries={['/book/book-1/chapter/chap-1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByText('Đại Phụng')).toBeDefined();
		});

		// Second call throws network error
		vi.mocked(ChapterRepository.getChapterContent).mockRejectedValueOnce(new Error('Mạng bị mất kết nối'));

		const titleBtn = screen.getByText(/Đại Phụng/).closest('button')!;
		fireEvent.click(titleBtn);
		fireEvent.click(titleBtn);

		await waitFor(() => {
			expect(screen.getByText('Không thể tải chương')).toBeDefined();
			expect(screen.getByText('Mạng bị mất kết nối')).toBeDefined();
		});
	});
});
