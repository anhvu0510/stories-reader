// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { continuationService } from '@/services/continuationService';

import { ContinuationStudioScreen } from '../ContinuationStudioScreen';

import type { StudioHubResponse } from '../types';

vi.mock('@/services/continuationService', () => ({
	continuationService: {
		getStudioHub: vi.fn(),
		startAutopilot: vi.fn(),
		pauseAutopilot: vi.fn(),
		stopAutopilot: vi.fn(),
		getAutopilotStatus: vi.fn(),
		createBranch: vi.fn(),
	},
}));

const mockHubData: StudioHubResponse = {
	book: {
		bookId: 'book-test-1',
		bookName: 'Đô Thị Tu Tiên',
		author: 'Tiêu Diêu',
		chapterCount: 100,
	},
	storyState: {
		bookId: 'book-test-1',
		bookName: 'Đô Thị Tu Tiên',
		lastIngestedChapter: 100,
		entities: [{ name: 'Trần Phàm', status: 'ALIVE', powerLevel: 'Kim Đan' }],
		worldRules: ['Tu vi vi tôn'],
		plotThreads: [{ threadId: 't1', title: 'Tuyến bí ẩn', category: 'MAIN', status: 'ACTIVE', openQuestion: 'Ai là hung thủ?' }],
		arcCheckpoints: [],
		styleFingerprint: {
			voice: 'Bá đạo, quyết đoán',
			pacing: 'Nhanh, gãy gọn',
			antiSlopRules: ['hít một hơi khí lạnh'],
			styleExemplars: ['Hắn đưa tay bấm quyết.'],
		},
		verbatimTail: 'Trần Phàm quay đầu rời đi.',
	},
	branches: [
		{
			branchId: 'branch-1',
			sourceBookId: 'book-test-1',
			title: 'Mạch Chính',
			mode: 'MAIN',
			forkAtChapter: 100,
			lastWrittenChapter: 100,
			status: 'ACTIVE',
			arcPlan: {
				branchTitle: 'Mạch Chính',
				endgameGoal: 'Đạt tới Hóa Thần',
				arcSummary: 'Hành trình đột phá',
				chapters: [{ chapterNumber: 101, title: 'Chương 101: Khởi Hành', summary: 'Bắt đầu' }],
			},
			autopilot: {
				status: 'IDLE',
				targetCount: 5,
				completedCount: 0,
				currentChapterNumber: 101,
				currentStep: 'IDLE',
			},
		},
	],
	currentBranch: {
		branchId: 'branch-1',
		sourceBookId: 'book-test-1',
		title: 'Mạch Chính',
		mode: 'MAIN',
		forkAtChapter: 100,
		lastWrittenChapter: 100,
		status: 'ACTIVE',
		arcPlan: {
			branchTitle: 'Mạch Chính',
			endgameGoal: 'Đạt tới Hóa Thần',
			arcSummary: 'Hành trình đột phá',
			chapters: [{ chapterNumber: 101, title: 'Chương 101: Khởi Hành', summary: 'Bắt đầu' }],
		},
		autopilot: {
			status: 'IDLE',
			targetCount: 5,
			completedCount: 0,
			currentChapterNumber: 101,
			currentStep: 'IDLE',
		},
	},
};

describe('ContinuationStudioScreen', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(continuationService.getStudioHub).mockResolvedValue(mockHubData);
		vi.mocked(continuationService.startAutopilot).mockResolvedValue({
			ok: true,
			autopilot: {
				status: 'RUNNING',
				targetCount: 5,
				completedCount: 0,
				currentChapterNumber: 101,
				currentStep: 'PLANNING',
			},
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders Studio Header with book name and branches', async () => {
		render(
			<MemoryRouter initialEntries={['/book/book-test-1/continuation']}>
				<Routes>
					<Route path="/book/:bookId/continuation" element={<ContinuationStudioScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByText('Studio Viết Tiếp')).toBeDefined();
			expect(screen.getByText(/Đô Thị Tu Tiên/)).toBeDefined();
		});

		expect(screen.getByText('Mạch Chính')).toBeDefined();
		expect(screen.getByText('Tạo Nhánh')).toBeDefined();
	});

	it('switches between Studio Tabs (Autopilot, Mô Hình, Văn Phong)', async () => {
		render(
			<MemoryRouter initialEntries={['/book/book-test-1/continuation']}>
				<Routes>
					<Route path="/book/:bookId/continuation" element={<ContinuationStudioScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /^Autopilot$/i })).toBeDefined();
		});

		// Switch to Mô Hình tab
		fireEvent.click(screen.getByRole('button', { name: /^Mô Hình$/i }));
		expect(screen.getByText(/Hồ Sơ Nhân Vật/)).toBeDefined();
		expect(screen.getByText('Trần Phàm')).toBeDefined();

		// Switch to Văn Phong tab
		fireEvent.click(screen.getByRole('button', { name: /^Văn Phong$/i }));
		expect(screen.getByText(/Vân Tay Văn Phong Nguyên Tác/)).toBeDefined();
		expect(screen.getByText('Bá đạo, quyết đoán')).toBeDefined();
	});

	it('triggers Autopilot start on button click', async () => {
		render(
			<MemoryRouter initialEntries={['/book/book-test-1/continuation']}>
				<Routes>
					<Route path="/book/:bookId/continuation" element={<ContinuationStudioScreen />} />
				</Routes>
			</MemoryRouter>
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Bắt Đầu Autopilot/i })).toBeDefined();
		});

		fireEvent.click(screen.getByRole('button', { name: /Bắt Đầu Autopilot/i }));

		await waitFor(() => {
			expect(continuationService.startAutopilot).toHaveBeenCalledWith('branch-1', {
				targetCount: 5,
				autoPublish: true,
				model: 'deepseek-ai/deepseek-v4.1-flash-1017',
				platform: 'DEPLOYAI',
			});
		});
	});
});
