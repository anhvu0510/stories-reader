// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReaderScreen } from '@/features/reader/ReaderScreen';
import { isEdgeBrowser } from '@/features/reader/utils/readerHelpers';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import * as openChapterUtils from '@/shared/utils/openChapter';

vi.mock('../../../repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapterContent: vi.fn(),
		getChapters: vi.fn().mockResolvedValue({ chapters: [], pagination: {} }),
		getLatestChapter: vi.fn().mockResolvedValue(null),
	},
}));

vi.mock('../../../repositories/BookRepository', () => ({
	BookRepository: {
		getLastReadChapter: vi.fn().mockResolvedValue(null),
		getBook: vi.fn().mockResolvedValue(null),
		updateLastReadChapter: vi.fn().mockResolvedValue({}),
	},
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
		jumpToContent: vi.fn(),
	}),
}));

describe('ReaderScreen - Edge Browser Swipe Disabled (TDD)', () => {
	const originalUserAgent = navigator.userAgent;

	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollTo = vi.fn();
	});

	afterEach(() => {
		cleanup();
		Object.defineProperty(navigator, 'userAgent', {
			value: originalUserAgent,
			configurable: true,
		});
	});

	describe('isEdgeBrowser helper unit tests', () => {
		it('detects Edge Desktop (Edg/)', () => {
			const ua =
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
			expect(isEdgeBrowser(ua)).toBe(true);
		});

		it('detects Edge Android (EdgA/)', () => {
			const ua =
				'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0';
			expect(isEdgeBrowser(ua)).toBe(true);
		});

		it('detects Edge iOS (EdgiOS/)', () => {
			const ua =
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 EdgiOS/120.0.0.0';
			expect(isEdgeBrowser(ua)).toBe(true);
		});

		it('returns false for standard Chrome', () => {
			const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
			expect(isEdgeBrowser(ua)).toBe(false);
		});

		it('returns false for Safari', () => {
			const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
			expect(isEdgeBrowser(ua)).toBe(false);
		});
	});

	describe('ReaderScreen integration on Edge browser', () => {
		it('QC-EDGE-1: Disables swipe navigation when browsing on Microsoft Edge', async () => {
			// Mock Microsoft Edge User Agent
			const edgeUa =
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
			Object.defineProperty(navigator, 'userAgent', {
				value: edgeUa,
				configurable: true,
			});

			const openNextSpy = vi.spyOn(openChapterUtils, 'openNextChapter').mockImplementation(() => {});
			const openPrevSpy = vi.spyOn(openChapterUtils, 'openPrevChapter').mockImplementation(() => {});

			vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
				chapter: {
					chapterId: 'chap-1',
					chapterNumber: 1,
					title: 'Chương 1',
					bookName: 'Test Book',
					content: ['<p>Nội dung chương 1</p>'],
				},
				navigation: {
					prev: { chapterId: 'chap-0', chapterNumber: 0, title: 'Chương 0' },
					next: { chapterId: 'chap-2', chapterNumber: 2, title: 'Chương 2' },
				},
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
			await new Promise((resolve) => setTimeout(resolve, 250));

			// Thực hiện thao tác vuốt trái mạnh (từ 250px sang 80px)
			act(() => {
				window.dispatchEvent(
					new TouchEvent('touchstart', {
						touches: [{ clientX: 250, clientY: 200 } as any],
					})
				);
				window.dispatchEvent(
					new TouchEvent('touchend', {
						changedTouches: [{ clientX: 80, clientY: 205 } as any],
					})
				);
			});

			// Không được chuyển chương vì trên Edge đã disable vuốt
			expect(openNextSpy).not.toHaveBeenCalled();
			expect(openPrevSpy).not.toHaveBeenCalled();
		});
	});
});
