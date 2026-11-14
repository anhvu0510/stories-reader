// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReaderScreen } from '@/features/reader/ReaderScreen';
import { TranslationScreen } from '@/features/translation/TranslationScreen';
import { ChapterRepository } from '@/repositories/ChapterRepository';

vi.mock('@/repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapterContent: vi.fn(),
		getChapters: vi.fn(),
		getPoolStatus: vi.fn().mockResolvedValue({ model: 'gemini-2.5-flash', remain: 1450, total: 1500 }),
	},
}));

vi.mock('@/repositories/BookRepository', () => ({
	BookRepository: {
		getBook: vi.fn().mockResolvedValue({
			bookId: 'b1',
			bookName: 'Đại Đạo Triều Thiên',
			chapterCount: 2,
			totalTranslated: 1,
			totalPending: 1,
		}),
		getBooks: vi.fn().mockResolvedValue({
			books: [{ bookId: 'b1', bookName: 'Đại Đạo Triều Thiên', chapterCount: 2, totalTranslated: 1 }],
			pagination: { currentPage: 1, totalPages: 1, total: 1 },
		}),
		updateLastReadChapter: vi.fn().mockResolvedValue({}),
	},
}));

vi.mock('@/repositories/AIRepository', () => ({
	AIRepository: {
		getQuotas: vi.fn().mockResolvedValue({
			availableModels: [{ model: 'gemini-2.5-flash', platform: 'AI_STUDIO', isActive: true }],
			currentConfig: {
				model: 'gemini-2.5-flash',
				platform: 'AI_STUDIO',
				minWords: 100,
				maxWords: 500,
				temperature: 0.7,
				forceRetranslate: false,
			},
		}),
	},
}));

vi.mock('@/repositories/SettingsRepository', () => ({
	SettingsRepository: {
		getSettings: vi.fn().mockResolvedValue(null),
	},
}));

describe('ReaderScreen -> Full TranslationScreen Navigation & Back', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.scrollTo = vi.fn();

		vi.mocked(ChapterRepository.getChapterContent).mockResolvedValue({
			chapter: {
				chapterId: 'c1',
				chapterNumber: 1,
				title: 'Chương 1: Mở đầu',
				bookName: 'Đại Đạo Triều Thiên',
				state: 'SUCCEEDED',
				content: ['Đoạn văn 1 dài', 'Đoạn văn 2 dài'],
			},
			chapters: [
				{
					chapterId: 'c1',
					chapterNumber: 1,
					title: 'Chương 1: Mở đầu',
					bookName: 'Đại Đạo Triều Thiên',
					state: 'SUCCEEDED',
					content: ['Đoạn văn 1 dài', 'Đoạn văn 2 dài'],
				},
			],
			navigation: {
				prev: null,
				next: { chapterId: 'c2', chapterNumber: 2, title: 'Chương 2' },
			},
		});

		vi.mocked(ChapterRepository.getChapters).mockResolvedValue({
			chapters: [
				{ chapterId: 'c1', chapterNumber: 1, title: 'Chương 1: Mở đầu', state: 'SUCCEEDED', updatedAt: '2026-01-01T00:00:00Z' },
				{ chapterId: 'c2', chapterNumber: 2, title: 'Chương 2: Nhập thế', state: 'PENDING', updatedAt: '2026-01-01T00:00:00Z' },
			],
			pagination: { currentPage: 1, totalPages: 1, total: 2 },
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('navigates from ReaderScreen to full TranslationScreen with current chapter selected and returns to ReaderScreen on Back', async () => {
		render(
			<MemoryRouter initialEntries={['/book/b1/chapter/c1']}>
				<Routes>
					<Route path="/book/:bookId/chapter/:chapterId" element={<ReaderScreen />} />
					<Route path="/book/:bookId/translate" element={<TranslationScreen />} />
					<Route path="/" element={<div>Trang chủ</div>} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getAllByText('Chương 1: Mở đầu').length).toBeGreaterThan(0);
		});

		const translateBtn = screen.getByTitle('Dịch AI');
		fireEvent.click(translateBtn);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Quay lại/i })).toBeDefined();
			expect(screen.getByRole('button', { name: /Dịch \(1\)/i })).toBeDefined();
		});

		const backBtn = screen.getByRole('button', { name: /Quay lại/i });
		fireEvent.click(backBtn);

		await waitFor(() => {
			expect(screen.getAllByText('Đoạn văn 1 dài').length).toBeGreaterThan(0);
		});
	});
});
