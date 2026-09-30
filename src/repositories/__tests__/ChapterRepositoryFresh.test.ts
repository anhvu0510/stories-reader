// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { apiClient } from '@/services/apiClient';
import { offlineDb } from '@/lib/offlineDb';
import { useAppStore } from '@/stores/useAppStore';

vi.mock('../../services/apiClient', () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn()
	}
}));

vi.mock('../../lib/offlineDb', () => ({
	offlineDb: {
		getChapterContent: vi.fn(),
		getChapterMeta: vi.fn(),
		getChapters: vi.fn(),
		saveChapter: vi.fn().mockResolvedValue(undefined),
		saveChapterContent: vi.fn().mockResolvedValue(undefined),
		getReplacements: vi.fn().mockResolvedValue([])
	}
}));

describe('ChapterRepository - Fresh API Fetching & No-Cache (TDD)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAppStore.setState({ isOfflineMode: false });
	});

	describe('getLatestChapter', () => {
		it('fetches latest chapter from API with sortOrder DESC and no-cache headers when forceFresh is true', async () => {
			vi.mocked(apiClient.get).mockResolvedValueOnce({
				chapters: [
					{
						chapterId: 'chap-150',
						chapterNumber: 150,
						title: 'Chương 150: Phi Thăng',
						state: 'SUCCEEDED',
						bookId: 'book-1'
					}
				]
			});

			const result = await ChapterRepository.getLatestChapter('book-1', { forceFresh: true });

			expect(result).not.toBeNull();
			expect(result?.chapterId).toBe('chap-150');
			expect(result?.chapterNumber).toBe(150);

			expect(apiClient.get).toHaveBeenCalledTimes(1);
			const [calledUrl, calledOptions] = vi.mocked(apiClient.get).mock.calls[0];

			expect(calledUrl).toContain('/api/books/book-1/chapters?');
			expect(calledUrl).toContain('sortBy=chapterNumber');
			expect(calledUrl).toContain('sortOrder=DESC');
			expect(calledUrl).toContain('_t=');

			expect(calledOptions).toMatchObject({
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache'
				},
				cache: 'no-store'
			});
		});

		it('throws error when forceFresh is true and API request fails (zero silent cache fallback)', async () => {
			vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network disconnected'));

			await expect(ChapterRepository.getLatestChapter('book-1', { forceFresh: true })).rejects.toThrow('Network disconnected');

			// Does not fall back to offlineDb when user explicitly demanded fresh API
			expect(offlineDb.getChapters).not.toHaveBeenCalled();
		});
	});

	describe('getChapterContent with forceFresh', () => {
		it('bypasses offline content check and adds no-cache headers to API call', async () => {
			const mockApiContent = {
				chapter: {
					chapterId: 'chap-10',
					chapterNumber: 10,
					title: 'Chương 10',
					bookId: 'book-1',
					content: ['Nội dung mới nhất từ máy chủ']
				},
				chapters: [
					{
						chapterId: 'chap-10',
						chapterNumber: 10,
						title: 'Chương 10',
						content: ['Nội dung mới nhất từ máy chủ']
					}
				]
			};

			vi.mocked(apiClient.get).mockResolvedValueOnce(mockApiContent);

			const result = await ChapterRepository.getChapterContent('chap-10', 1, false, '', 1, {
				forceFresh: true
			});

			expect(result).toEqual(mockApiContent);
			expect(offlineDb.getChapterContent).not.toHaveBeenCalled();

			const [calledUrl, calledOptions] = vi.mocked(apiClient.get).mock.calls[0];
			expect(calledUrl).toContain('/api/chapters/chap-10?');
			expect(calledUrl).toContain('_t=');
			expect(calledOptions).toMatchObject({
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache'
				},
				cache: 'no-store'
			});

			// Synchronizes fresh content back to offlineDb
			expect(offlineDb.saveChapter).toHaveBeenCalled();
			expect(offlineDb.saveChapterContent).toHaveBeenCalledWith(mockApiContent);
		});

		it('throws error and does not return stale offline batch when forceFresh API call fails', async () => {
			vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Server 500 error'));

			await expect(
				ChapterRepository.getChapterContent('chap-10', 1, false, '', 1, {
					forceFresh: true
				})
			).rejects.toThrow('Server 500 error');
		});
	});
});
