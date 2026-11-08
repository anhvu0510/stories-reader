// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { VerticalBatchChapterNav } from '@/features/reader/components/VerticalBatchChapterNav';

describe('VerticalBatchChapterNav Component', () => {
	const mockChapters = [
		{ chapterId: 'c1', chapterNumber: 1, title: 'Chương 1: Khởi đầu', content: [] },
		{ chapterId: 'c2', chapterNumber: 2, title: 'Chương 2: Đột phá', content: [] },
		{ chapterId: 'c3', chapterNumber: 3, title: 'Chương 3: Ngoại truyện', content: [] },
	];

	beforeEach(() => {
		cleanup();
		vi.restoreAllMocks();
		document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
		document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
	});

	it('QC-1 [Inactive State]: Displays Speaker icon when TTS is not active', () => {
		render(<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={false} />);

		const speakerBtn = screen.getByLabelText('Bật đọc thành tiếng');
		expect(speakerBtn).toBeDefined();
	});

	it('QC-2 [Active State Menu Dọc]: Transforms into vertical audio control menu bar without paragraph index badge', () => {
		render(
			<VerticalBatchChapterNav
				chapters={mockChapters}
				activeChapterId="c1"
				isVisible={true}
				isTTSActive={true}
				isTTSPlaying={true}
				currentParagraphIndex={2}
			/>
		);

		expect(screen.getByLabelText('Tạm dừng đọc')).toBeDefined();
		expect(screen.queryByLabelText('Đoạn trước')).toBeNull();
		expect(screen.getByLabelText('Đoạn sau')).toBeDefined();
		expect(screen.getByLabelText('Dừng đọc')).toBeDefined();
		// Verify paragraph index badge 'Đ3' is removed
		expect(screen.queryByText('Đ3')).toBeNull();
	});

	it('QC-3 [Toggle / Start Reading]: Triggers onToggleTTS when clicking speaker icon in inactive state', () => {
		const mockOnToggleTTS = vi.fn();
		render(
			<VerticalBatchChapterNav
				chapters={mockChapters}
				activeChapterId="c1"
				isVisible={true}
				isTTSActive={false}
				onToggleTTS={mockOnToggleTTS}
			/>
		);

		const speakerBtn = screen.getByLabelText('Bật đọc thành tiếng');
		fireEvent.click(speakerBtn);

		expect(mockOnToggleTTS).toHaveBeenCalledTimes(1);
	});

	it('QC-4 [Stop Reading]: Triggers onTTSStop when clicking Stop button in active state', () => {
		const mockOnTTSStop = vi.fn();
		render(
			<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={true} onTTSStop={mockOnTTSStop} />
		);

		const stopBtn = screen.getByLabelText('Dừng đọc');
		fireEvent.click(stopBtn);

		expect(mockOnTTSStop).toHaveBeenCalledTimes(1);
	});

	it('QC-5 [Next Section]: Triggers onTTSNext when clicking Next button and does not render Prev button', () => {
		const mockOnTTSNext = vi.fn();
		render(
			<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={true} onTTSNext={mockOnTTSNext} />
		);

		expect(screen.queryByLabelText('Đoạn trước')).toBeNull();

		fireEvent.click(screen.getByLabelText('Đoạn sau'));
		expect(mockOnTTSNext).toHaveBeenCalledTimes(1);
	});

	it('QC-6 [Highlight Line Jump]: Shows locate button and scrolls to highlight when locate button is clicked', () => {
		const mockScrollIntoView = vi.fn();
		const highlightEl = document.createElement('span');
		highlightEl.className = 'msreadout-line-highlight';
		highlightEl.scrollIntoView = mockScrollIntoView;
		document.body.appendChild(highlightEl);

		render(<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={true} />);

		const locateBtn = screen.getByLabelText('Nhảy tới dòng đang đọc');
		expect(locateBtn).toBeDefined();

		fireEvent.click(locateBtn);

		expect(mockScrollIntoView).toHaveBeenCalledWith({
			behavior: 'smooth',
			block: 'center',
		});

		document.body.removeChild(highlightEl);
	});

	it('does not show the locate button for the app-owned TTS line wash', () => {
		const appLineWash = document.createElement('span');
		appLineWash.className = 'stories-tts-line-wash';
		document.body.appendChild(appLineWash);

		render(<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={true} />);

		expect(screen.queryByLabelText('Nhảy tới dòng đang đọc')).toBeNull();

		document.body.removeChild(appLineWash);
	});

	it('QC-7 [Sync Dock Hide/Show]: Applies translate class when isVisible is false', () => {
		const { container } = render(
			<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={false} isTTSActive={false} />
		);

		const nav = container.firstChild as HTMLElement;
		expect(nav.className).toContain('-translate-x-14');
		expect(nav.className).toContain('opacity-0');
	});

	it('QC-8 [Loading State]: Displays loading spinner on single circle speaker button and no control bar when isTTSLoading is true', () => {
		render(
			<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={false} isTTSLoading={true} />
		);

		const loadingBtn = screen.getByLabelText('Đang chuẩn bị âm thanh');
		expect(loadingBtn).toBeDefined();

		// Verify control bar buttons are NOT rendered during loading
		expect(screen.queryByLabelText('Tạm dừng đọc')).toBeNull();
		expect(screen.queryByLabelText('Dừng đọc')).toBeNull();
	});

	it('QC-9 [Cancel Loading]: Calls onToggleTTS when clicking loading speaker button', () => {
		const mockOnToggleTTS = vi.fn();
		render(
			<VerticalBatchChapterNav
				chapters={mockChapters}
				activeChapterId="c1"
				isVisible={true}
				isTTSActive={false}
				isTTSLoading={true}
				onToggleTTS={mockOnToggleTTS}
			/>
		);

		const loadingBtn = screen.getByLabelText('Đang chuẩn bị âm thanh');
		fireEvent.click(loadingBtn);

		expect(mockOnToggleTTS).toHaveBeenCalledTimes(1);
	});

	it('QC-11 [showTTSControl=false]: Hides speaker button when showTTSControl prop is set to false', () => {
		render(
			<VerticalBatchChapterNav chapters={mockChapters} activeChapterId="c1" isVisible={true} isTTSActive={false} showTTSControl={false} />
		);

		expect(screen.queryByLabelText('Bật đọc thành tiếng')).toBeNull();
	});

	it('encloses active controls in a transparent frame without changing button styles', () => {
		render(<VerticalBatchChapterNav isTTSActive isTTSPlaying />);
		const frame = screen.getByRole('group', { name: 'Điều khiển đọc thành tiếng' });
		expect(frame.className).toContain('bg-transparent');
		expect(screen.getByRole('button', { name: 'Kéo thanh điều khiển lên hoặc xuống' })).toBeDefined();
		const pause = screen.getByRole('button', { name: 'Tạm dừng đọc' });
		expect(frame.contains(pause)).toBe(true);
		expect(pause.className).toContain('w-9.5 h-9.5 rounded-full');
		expect(pause.className).toContain('bg-primary/25');
		expect(screen.getByRole('button', { name: 'Dừng đọc' }).className).toContain('bg-rose-500/10');
	});

	it('keeps the idle speaker unchanged without a frame or drag handle', () => {
		render(<VerticalBatchChapterNav />);
		expect(screen.queryByRole('group', { name: 'Điều khiển đọc thành tiếng' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Kéo thanh điều khiển lên hoặc xuống' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Bật đọc thành tiếng' }).className).toContain('w-9 h-9 rounded-full');
	});
});
