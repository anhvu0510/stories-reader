// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

import { ReaderScreen } from '@/features/reader/ReaderScreen';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { BookRepository } from '@/repositories/BookRepository';
import * as openChapterUtils from '@/shared/utils/openChapter';

vi.mock('../../../repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapterContent: vi.fn(),
		getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
		getLatestChapter: vi.fn().mockResolvedValue(null)
	}
}));

vi.mock('../../../repositories/BookRepository', () => ({
	BookRepository: {
		getLastReadChapter: vi.fn().mockResolvedValue(null),
		getBook: vi.fn().mockResolvedValue(null),
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
		prevSection: vi.fn(),
		jumpToContent: vi.fn()
	})
}));

describe('ReaderScreen - Swipe Gesture Chapter Navigation', () => {
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

	it('swiping left navigates to the next chapter when available', async () => {
		const openNextSpy = vi.spyOn(openChapterUtils, 'openNextChapter').mockImplementation(() => {});

		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'chap-1',
				chapterNumber: 1,
				title: 'Chương 1',
				bookName: 'Test Book',
				content: ['<p>Nội dung chương 1</p>']
			},
			navigation: {
				prev: null,
				next: { chapterId: 'chap-2', chapterNumber: 2, title: 'Chương 2' }
			}
		} as any);

		render(
			<MemoryRouter initialEntries={['/book/b1/chapter/chap-1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByText('Nội dung chương 1')).toBeDefined();
		});

		// Simulate swipe left (touch from 250px to 100px)
		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 250, clientY: 200 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 100, clientY: 205 } as any]
				})
			);
		});

		expect(openNextSpy).toHaveBeenCalledWith('b1', 'chap-1', 'chap-2');
	});

	it('swiping right navigates to the previous chapter when available', async () => {
		const openPrevSpy = vi.spyOn(openChapterUtils, 'openPrevChapter').mockImplementation(() => {});

		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'chap-2',
				chapterNumber: 2,
				title: 'Chương 2',
				bookName: 'Test Book',
				content: ['<p>Nội dung chương 2</p>']
			},
			navigation: {
				prev: { chapterId: 'chap-1', chapterNumber: 1, title: 'Chương 1' },
				next: null
			}
		} as any);

		render(
			<MemoryRouter initialEntries={['/book/b1/chapter/chap-2']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByText('Nội dung chương 2')).toBeDefined();
		});

		// Simulate swipe right (touch from 80px to 220px)
		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 80, clientY: 200 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 220, clientY: 205 } as any]
				})
			);
		});

		expect(openPrevSpy).toHaveBeenCalledWith('b1', 'chap-2', 'chap-1');
	});
});
