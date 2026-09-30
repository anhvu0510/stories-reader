// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { ReaderQuickControl } from '@/features/reader/components/ReaderQuickControl';

describe('ReaderQuickControl - Horizontal Chapter Circles above Range Button', () => {
	const mockChapters = [
		{ chapterId: 'c551', chapterNumber: 551, title: 'Chương 551', content: [] },
		{ chapterId: 'c552', chapterNumber: 552, title: 'Chương 552', content: [] },
		{ chapterId: 'c553', chapterNumber: 553, title: 'Chương 553', content: [] }
	];

	beforeEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('renders horizontal circular buttons for batch chapters 551, 552, 553 above range button', () => {
		render(
			<MemoryRouter>
				<ReaderQuickControl bookId="b1" chapterDisplayLabel="551 - 553" chapters={mockChapters} activeChapterId="c551" onOpenChapterSelect={vi.fn()} onOpenTranslation={vi.fn()} />
			</MemoryRouter>
		);

		// List menu button to open full chapter list sheet
		expect(screen.getByTitle('Mở danh sách tất cả các chương')).toBeDefined();

		// Horizontal circular buttons for loaded chapters
		expect(screen.getByTitle('Chương 551')).toBeDefined();
		expect(screen.getByText('551')).toBeDefined();
		expect(screen.getByText('552')).toBeDefined();
		expect(screen.getByText('553')).toBeDefined();
	});

	it('scrolls smooth to target chapter when clicking circular chapter button', () => {
		const mockScrollIntoView = vi.fn();
		const sectionEl = document.createElement('div');
		sectionEl.id = 'chapter-section-c552';
		sectionEl.scrollIntoView = mockScrollIntoView;
		document.body.appendChild(sectionEl);

		render(
			<MemoryRouter>
				<ReaderQuickControl bookId="b1" chapterDisplayLabel="551 - 553" chapters={mockChapters} activeChapterId="c551" onOpenChapterSelect={vi.fn()} onOpenTranslation={vi.fn()} />
			</MemoryRouter>
		);

		const circleBtn552 = screen.getByText('552');
		fireEvent.click(circleBtn552);

		expect(mockScrollIntoView).toHaveBeenCalledWith({
			behavior: 'smooth',
			block: 'start'
		});

		document.body.removeChild(sectionEl);
	});

	it('calls onOpenChapterSelect when clicking the menu list button inside dock', () => {
		const mockOnOpenChapterSelect = vi.fn();
		render(
			<MemoryRouter>
				<ReaderQuickControl
					bookId="b1"
					chapterDisplayLabel="551 - 553"
					chapters={mockChapters}
					activeChapterId="c551"
					onOpenChapterSelect={mockOnOpenChapterSelect}
					onOpenTranslation={vi.fn()}
				/>
			</MemoryRouter>
		);

		const listMenuBtn = screen.getByTitle('Mở danh sách tất cả các chương');
		fireEvent.click(listMenuBtn);

		expect(mockOnOpenChapterSelect).toHaveBeenCalledTimes(1);
	});

	it('does not render the quick TTS button on bottom dock anymore as it moved to vertical menu dock', () => {
		render(
			<MemoryRouter>
				<ReaderQuickControl bookId="b1" chapterDisplayLabel="551 - 553" chapters={mockChapters} activeChapterId="c551" onOpenChapterSelect={vi.fn()} onOpenTranslation={vi.fn()} />
			</MemoryRouter>
		);
		expect(screen.queryByTitle('Bật đọc thành tiếng (VieNeu AI TTS)')).toBeNull();
	});

	it('navigates to next chapter using openNextChapter with scroll reset when clicking next button', () => {
		window.scrollTo = vi.fn();
		localStorage.setItem('reading_progress_b1_c551', JSON.stringify({ chapterId: 'c551', scrollY: 3000 }));
		localStorage.setItem('reading_progress_b1_c552', JSON.stringify({ chapterId: 'c552', scrollY: 1000 }));

		render(
			<MemoryRouter>
				<ReaderQuickControl bookId="b1" currentChapterId="c551" nextChapterId="c552" activeChapterId="c551" onOpenChapterSelect={vi.fn()} onOpenTranslation={vi.fn()} />
			</MemoryRouter>
		);

		const nextBtn = screen.getByTitle('Chương sau');
		fireEvent.click(nextBtn);

		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
		expect(localStorage.getItem('reading_progress_b1_c551')).toBeNull();
		expect(localStorage.getItem('reading_progress_b1_c552')).toBeNull();
	});
});
