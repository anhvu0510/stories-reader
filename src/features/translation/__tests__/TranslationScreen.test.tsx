// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
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
		getQuotas: vi.fn().mockResolvedValue({
			availableModels: [
				{ model: 'gemini-2.5-flash', platform: 'AI_STUDIO', isActive: true },
				{ model: 'deepseek-chat', platform: 'DEPLOYAI', isActive: true },
			],
			currentConfig: {
				model: 'gemini-2.5-flash',
				platform: 'AI_STUDIO',
				minWords: 100,
				maxWords: 500,
				temperature: 0.7,
				forceRetranslate: false,
			},
		}),
		detectProperNouns: vi.fn().mockResolvedValue({ success: true }),
		translateChineseTitles: vi.fn().mockResolvedValue({ success: true }),
		detectTagsAndPov: vi.fn().mockResolvedValue({ success: true }),
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

	it('displays dynamic platform pills and hides unsupported platforms', async () => {
		renderScreen();

		// Click to expand AI config card
		const configToggle = await screen.findByText('2.5 FLASH');
		fireEvent.click(configToggle);

		const platformTabs = await screen.findByTestId('platform-filter-tabs');
		expect(within(platformTabs).getByRole('button', { name: 'AI Studio' })).toBeDefined();
		expect(within(platformTabs).getByRole('button', { name: 'DeployAI' })).toBeDefined();

		// "Tất cả" tab should NOT exist
		expect(within(platformTabs).queryByRole('button', { name: 'Tất cả' })).toBeNull();

		// Unsupported platforms like Vertex AI, OpenAI should NOT be displayed
		expect(within(platformTabs).queryByRole('button', { name: 'Vertex AI' })).toBeNull();
		expect(within(platformTabs).queryByRole('button', { name: 'OpenAI' })).toBeNull();
	});

	it('renders standalone quick tools outside AI config card and triggers handlers', async () => {
		renderScreen();

		const properNounsBtn = await screen.findByRole('button', { name: /Phát hiện xưng hô/i });
		expect(properNounsBtn).toBeDefined();
		fireEvent.click(properNounsBtn);
		expect(AIRepository.detectProperNouns).toHaveBeenCalled();

		const translateTitlesBtn = screen.getByRole('button', { name: /Dịch tiêu đề tiếng Trung/i });
		expect(translateTitlesBtn).toBeDefined();
		fireEvent.click(translateTitlesBtn);
		expect(AIRepository.translateChineseTitles).toHaveBeenCalled();
	});

	it('shows empty state and disables translate button when BE returns no models', async () => {
		// Mock empty quotas from BE
		vi.mocked(AIRepository.getQuotas).mockResolvedValueOnce({
			availableModels: [],
			currentConfig: {
				model: '',
				platform: '',
				minWords: 100,
				maxWords: 500,
				temperature: 0.7,
				forceRetranslate: false,
			},
		});

		renderScreen();

		// Wait for load and select chapters
		await screen.findByText('Chương 2: Biến cố');
		const pendingBtn = screen.getByRole('button', { name: 'Chưa dịch' });
		fireEvent.click(pendingBtn);

		// Action dock should be disabled because hasModel is false
		const syncBtn = screen.getByRole('button', { name: /Dịch \(2\)/i }) as HTMLButtonElement;
		expect(syncBtn.disabled).toBe(true);

		// Open config card to verify empty state message
		const configCard = screen.getByText('Chưa chọn model AI');
		fireEvent.click(configCard);
		expect(await screen.findByText(/Chưa có mô hình AI từ máy chủ/i)).toBeDefined();
	});

	it('restricts "Tất cả" book selection to current bookId when opened from /book/:bookId/translate', async () => {
		renderScreen('/book/book-456/translate');

		const storyTabBtn = await screen.findByRole('button', { name: /Toàn bộ truyện/i });
		fireEvent.click(storyTabBtn);

		await screen.findByText('Mục Thần Ký');

		const selectAllBtn = screen.getByRole('button', { name: 'Tất cả' });
		fireEvent.click(selectAllBtn);

		await waitFor(() => {
			expect(screen.getByText(/Đã chọn: 1\/2 truyện/i)).toBeDefined();
			expect(screen.getByRole('button', { name: /Dịch \(1\)/i })).toBeDefined();
		});
	});

	it('selects all books when opened at /translate without bookId', async () => {
		renderScreen('/translate');

		await screen.findByText('Mục Thần Ký');

		const selectAllBtn = screen.getByRole('button', { name: 'Tất cả' });
		fireEvent.click(selectAllBtn);

		await waitFor(() => {
			expect(screen.getByText(/Đã chọn: 2\/2 truyện/i)).toBeDefined();
			expect(screen.getByRole('button', { name: /Dịch \(2\)/i })).toBeDefined();
		});
	});

	it('renders "Dịch POV" quick tool and triggers AIRepository.detectTagsAndPov', async () => {
		renderScreen('/book/book-456/translate');

		const povBtn = await screen.findByRole('button', { name: /Dịch POV/i });
		fireEvent.click(povBtn);

		expect(AIRepository.detectTagsAndPov).toHaveBeenCalledWith({
			bookId: 'book-456',
			model: 'gemini-2.5-flash',
			platform: 'AI_STUDIO',
		});
	});
});
