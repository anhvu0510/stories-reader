// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { ReaderHeader } from '@/features/reader/components/ReaderHeader';

describe('ReaderHeader Component', () => {
	beforeEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('renders book name and chapter title', () => {
		render(
			<MemoryRouter>
				<ReaderHeader bookId="b1" bookName="Tu Chân Giới" chapterNumber={10} chapterTitle="Chương 10: Trúc Cơ Kỳ" onOpenHistory={vi.fn()} />
			</MemoryRouter>
		);

		expect(screen.getByText('Tu Chân Giới')).toBeDefined();
		expect(screen.getByText('Chương 10: Trúc Cơ Kỳ')).toBeDefined();
	});

	it('renders history button and triggers onOpenHistory when clicked', () => {
		const handleOpenHistory = vi.fn();

		render(
			<MemoryRouter>
				<ReaderHeader bookId="b1" bookName="Tu Chân Giới" chapterTitle="Chương 1" onOpenHistory={handleOpenHistory} />
			</MemoryRouter>
		);

		const historyBtn = screen.getByTitle('Lịch sử đọc gần đây');
		expect(historyBtn).toBeDefined();

		fireEvent.click(historyBtn);
		expect(handleOpenHistory).toHaveBeenCalledTimes(1);
	});

	it('triggers onTitleClick after 250ms when center title bar is clicked once', () => {
		vi.useFakeTimers();
		const handleTitleClick = vi.fn();
		const handleTitleDoubleClick = vi.fn();

		render(
			<MemoryRouter>
				<ReaderHeader
					bookId="b1"
					bookName="Tu Chân Giới"
					chapterTitle="Chương 1"
					onOpenHistory={vi.fn()}
					onTitleClick={handleTitleClick}
					onTitleDoubleClick={handleTitleDoubleClick}
				/>
			</MemoryRouter>
		);

		const titleBtn = screen.getByText('Chương 1').closest('button')!;
		expect(titleBtn).toBeDefined();

		fireEvent.click(titleBtn);
		expect(handleTitleClick).not.toHaveBeenCalled();

		vi.advanceTimersByTime(250);
		expect(handleTitleClick).toHaveBeenCalledTimes(1);
		expect(handleTitleDoubleClick).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('triggers onTitleDoubleClick immediately and skips onTitleClick when double clicked within 250ms', () => {
		vi.useFakeTimers();
		const handleTitleClick = vi.fn();
		const handleTitleDoubleClick = vi.fn();

		render(
			<MemoryRouter>
				<ReaderHeader
					bookId="b1"
					bookName="Tu Chân Giới"
					chapterTitle="Chương 1"
					onOpenHistory={vi.fn()}
					onTitleClick={handleTitleClick}
					onTitleDoubleClick={handleTitleDoubleClick}
				/>
			</MemoryRouter>
		);

		const titleBtn = screen.getByText('Chương 1').closest('button')!;

		// First click
		fireEvent.click(titleBtn);
		// Second click within 100ms
		vi.advanceTimersByTime(100);
		fireEvent.click(titleBtn);

		expect(handleTitleDoubleClick).toHaveBeenCalledTimes(1);
		expect(handleTitleClick).not.toHaveBeenCalled();

		// Even after full debounce elapsed, single click shouldn't fire
		vi.advanceTimersByTime(300);
		expect(handleTitleClick).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('renders loading state and prevents click when isRefreshingLatest is true', () => {
		const handleTitleClick = vi.fn();
		const handleTitleDoubleClick = vi.fn();

		render(
			<MemoryRouter>
				<ReaderHeader
					bookId="b1"
					bookName="Tu Chân Giới"
					chapterTitle="Chương 1"
					isRefreshingLatest={true}
					onOpenHistory={vi.fn()}
					onTitleClick={handleTitleClick}
					onTitleDoubleClick={handleTitleDoubleClick}
				/>
			</MemoryRouter>
		);

		const titleBtn = screen.getByText('Chương 1').closest('button')!;
		expect(titleBtn).toBeDefined();
		expect((titleBtn as HTMLButtonElement).disabled).toBe(true);

		fireEvent.click(titleBtn);
		expect(handleTitleClick).not.toHaveBeenCalled();
		expect(handleTitleDoubleClick).not.toHaveBeenCalled();
	});
});
