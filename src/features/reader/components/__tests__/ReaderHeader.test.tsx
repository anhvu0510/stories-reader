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

	it('triggers onTitleClick immediately on first tap without delay', () => {
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
		expect(handleTitleClick).toHaveBeenCalledTimes(1);
		expect(handleTitleDoubleClick).not.toHaveBeenCalled();
	});

	it('triggers onTitleDoubleClick when tapped a 2nd time within 700ms window', () => {
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

		// First tap
		fireEvent.click(titleBtn);
		expect(handleTitleClick).toHaveBeenCalledTimes(1);

		// Second tap
		fireEvent.click(titleBtn);
		expect(handleTitleDoubleClick).toHaveBeenCalledTimes(1);
	});

	it('resets tap count back to 1 when second tap occurs after 700ms', () => {
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

		// First tap
		fireEvent.click(titleBtn);
		expect(handleTitleClick).toHaveBeenCalledTimes(1);

		// Wait 700ms window expires
		vi.advanceTimersByTime(700);

		// Another tap after window expired (should be treated as 1st tap again)
		fireEvent.click(titleBtn);
		expect(handleTitleClick).toHaveBeenCalledTimes(2);
		expect(handleTitleDoubleClick).not.toHaveBeenCalled();

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
