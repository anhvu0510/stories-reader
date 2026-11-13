// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AIRepository } from '@/repositories/AIRepository';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';

import { TranslationScreen } from '../TranslationScreen';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom');
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock('@/repositories/ChapterRepository', () => ({
	ChapterRepository: {
		getChapters: vi.fn().mockResolvedValue({
			chapters: [
				{ chapterId: 'c-1', chapterNumber: 1, title: 'Chương 1: Khởi đầu', state: 'SUCCEEDED' },
				{ chapterId: 'c-2', chapterNumber: 2, title: 'Chương 2: Biến cố', state: 'PENDING' },
				{ chapterId: 'c-3', chapterNumber: 3, title: 'Chương 3: Rời đi', state: 'PENDING' },
			],
			pagination: { currentPage: 1, totalPages: 1, total: 3 },
		}),
		getPoolStatus: vi.fn().mockResolvedValue({ model: 'gemini-2.5-flash', remain: 1450, total: 1500 }),
		translate: vi.fn().mockResolvedValue({ success: true }),
	},
}));

vi.mock('@/repositories/BookRepository', () => ({
	BookRepository: {
		getBook: vi.fn().mockResolvedValue({
			bookId: 'book-456',
			bookName: 'Toàn Trí Độc Giả',
			chapterCount: 3,
			totalTranslated: 1,
			totalPending: 2,
		}),
		getBooks: vi.fn().mockResolvedValue({
			books: [
				{ bookId: 'book-456', bookName: 'Toàn Trí Độc Giả', chapterCount: 3, totalTranslated: 1 },
				{ bookId: 'book-789', bookName: 'Mục Thần Ký', chapterCount: 100, totalTranslated: 50 },
			],
			pagination: { currentPage: 1, totalPages: 1, total: 2 },
		}),
	},
}));

vi.mock('@/repositories/AIRepository', () => ({
	AIRepository: {
		getQuotas: vi.fn().mockResolvedValue({ quotas: [], currentConfig: { model: 'gemini-2.5-flash' } }),
		detectProperNouns: vi.fn().mockResolvedValue({ success: true }),
		translateChineseTitles: vi.fn().mockResolvedValue({ success: true }),
	},
}));

vi.mock('@/repositories/SettingsRepository', () => ({
	SettingsRepository: {
		getSettings: vi.fn().mockResolvedValue(null),
		updateSettings: vi.fn().mockResolvedValue(null),
	},
}));

describe('TranslationScreen Full-Screen Implementation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	function renderScreen(initialPath = '/book/book-456/translate') {
		return render(
			<MemoryRouter initialEntries={[initialPath]}>
				<Routes>
					<Route path="/book/:bookId/translate" element={<TranslationScreen />} />
					<Route path="/translate" element={<TranslationScreen />} />
				</Routes>
			</MemoryRouter>
		);
	}

	it('renders full-screen translation page with header, book info, and chapters', async () => {
		renderScreen();

		// Screen container should render and not be a bottom sheet modal
		expect(await screen.findByText('Toàn Trí Độc Giả')).toBeDefined();
		expect(screen.getByRole('button', { name: /Quay lại/i })).toBeDefined();

		// Should render chapter batch controls
		expect(screen.getByText(/Nhiều chương/i)).toBeDefined();
		expect(await screen.findByText('Chương 1: Khởi đầu')).toBeDefined();
		expect(await screen.findByText('Chương 2: Biến cố')).toBeDefined();
	});

	it('navigates back when clicking the back button', async () => {
		renderScreen();

		const backBtn = await screen.findByRole('button', { name: /Quay lại/i });
		fireEvent.click(backBtn);

		expect(mockNavigate).toHaveBeenCalled();
	});

	it('allows selecting chapters and updates the selected counter in batch controls and bottom dock', async () => {
		renderScreen();

		await screen.findByText('Chương 2: Biến cố');

		// Click to select Chapter 2
		const chap2Item = screen.getByText('Chương 2: Biến cố');
		fireEvent.click(chap2Item);

		// Batch controls counter and action dock should reflect selection count
		await waitFor(() => {
			expect(screen.getByText(/Đã chọn: 1/i)).toBeDefined();
			expect(screen.getByRole('button', { name: /Dịch \(1\)/i })).toBeDefined();
		});
	});

	it('allows selecting only pending chapters when clicking "Chưa dịch"', async () => {
		renderScreen();

		await screen.findByText('Chương 2: Biến cố');

		const pendingBtn = screen.getByRole('button', { name: 'Chưa dịch' });
		fireEvent.click(pendingBtn);

		await waitFor(() => {
			// Chapters 2 and 3 are pending -> 2 chapters selected
			expect(screen.getByText(/Đã chọn: 2/i)).toBeDefined();
			expect(screen.getByRole('button', { name: /Dịch \(2\)/i })).toBeDefined();
		});
	});

	it('switches to story tab and displays books in library', async () => {
		renderScreen();

		const storyTabBtn = await screen.findByRole('button', { name: /Toàn bộ truyện/i });
		fireEvent.click(storyTabBtn);

		expect(await screen.findByText('Mục Thần Ký')).toBeDefined();
	});

	it('triggers translate when clicking sync translate button', async () => {
		renderScreen();

		await screen.findByText('Chương 2: Biến cố');
		const pendingBtn = screen.getByRole('button', { name: 'Chưa dịch' });
		fireEvent.click(pendingBtn);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Dịch \(2\)/i })).toBeDefined();
		});

		const syncBtn = screen.getByRole('button', { name: /Dịch \(2\)/i });
		fireEvent.click(syncBtn);

		await waitFor(() => {
			expect(ChapterRepository.translate).toHaveBeenCalled();
		});
	});
});
