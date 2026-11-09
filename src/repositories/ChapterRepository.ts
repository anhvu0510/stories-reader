import { offlineDb } from '@/lib/offlineDb';
import { apiClient, type RequestOptions } from '@/services/apiClient';
import { useAppStore } from '@/stores/useAppStore';

import {
	fetchOnlineChapters,
	fetchOnlineLatestChapter,
	filterAndSortOfflineChapters,
	processOfflineBatch,
} from './chapterRepositoryHelpers';

import type { Chapter, ChapterContent } from '@/shared/types';

async function syncDownloadedChapterContent(res: ChapterContent) {
	if (!res?.chapter) return;
	await offlineDb
		.saveChapter({
			chapterId: res.chapter.chapterId,
			chapterNumber: res.chapter.chapterNumber,
			title: res.chapter.title,
			state: (res.chapter.state as Chapter['state']) || 'SUCCEEDED',
			updatedAt: res.chapter.updatedAt || new Date().toISOString(),
			bookId: res.chapter.bookId || '',
		})
		.catch(() => {});
	await offlineDb.saveChapterContent(res).catch(() => {});
}

async function fetchOnlineChapterContent(
	chapterId: string,
	groupLines: number,
	isEnabledReplace: boolean,
	rootTab: string,
	batchSize: number,
	forceFresh?: boolean
): Promise<ChapterContent> {
	const hasOffline = !forceFresh && (await offlineDb.getChapterContent(chapterId));
	const timeout = hasOffline ? 1200 : 6000;
	let url = `/api/chapters/${chapterId}?groupLines=${groupLines}&isEnabledReplace=${isEnabledReplace}&rootTab=${rootTab}&batchSize=${batchSize}`;
	const requestOptions: RequestOptions = { timeout, retries: 0, silent: true };

	if (forceFresh) {
		url += `&_t=${Date.now()}`;
		requestOptions.headers = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
		requestOptions.cache = 'no-store';
	}

	const res = await apiClient.get<ChapterContent>(url, requestOptions);
	void syncDownloadedChapterContent(res);
	return res;
}

function resolveChapterContentParams(rawGroupLines?: number, rawIsEnabledReplace?: boolean, rawRootTab?: string, rawBatchSize?: number) {
	return {
		groupLines: typeof rawGroupLines === 'number' ? rawGroupLines : 1,
		isEnabledReplace: rawIsEnabledReplace ?? true,
		rootTab: rawRootTab || '',
		batchSize: typeof rawBatchSize === 'number' ? rawBatchSize : 1,
	};
}

function handleChapterContentError(e: unknown): never {
	const msg = e instanceof Error ? e.message : 'Không thể tải nội dung chương mới nhất từ máy chủ';
	throw new Error(msg, { cause: e });
}

export const ChapterRepository = {
	async getChapters(
		bookId: string,
		page = 1,
		limit = 50,
		sortBy = 'chapterNumber',
		sortOrder = 'ASC',
		state?: string,
		search?: string,
		fromChapterNumber?: number,
		toChapterNumber?: number,
		options?: { forceFresh?: boolean }
	): Promise<{ chapters: Chapter[]; pagination: { totalPages: number; total: number; currentPage: number } }> {
		const isOffline = useAppStore.getState().isOfflineMode;

		if (!isOffline) {
			try {
				const onlineResult = await fetchOnlineChapters(
					bookId,
					page,
					limit,
					sortBy,
					sortOrder,
					state,
					search,
					fromChapterNumber,
					toChapterNumber,
					options
				);
				if (onlineResult) {
					return onlineResult;
				}
			} catch (e) {
				console.warn('Failed to fetch chapters online, falling back to offlineDb:', e);
			}
		}

		let chapters: Chapter[] = await offlineDb.getChapters(bookId);
		chapters = filterAndSortOfflineChapters(chapters, state, search, sortBy, sortOrder);

		const total = chapters.length;
		const totalPages = Math.ceil(total / limit) || 1;
		const paginated = chapters.slice((page - 1) * limit, page * limit);

		return {
			chapters: paginated,
			pagination: { currentPage: page, totalPages, total },
		};
	},

	async getLatestChapter(bookId: string, options?: { forceFresh?: boolean }): Promise<Chapter | null> {
		const isOffline = useAppStore.getState().isOfflineMode;

		if (options?.forceFresh && isOffline) {
			throw new Error('Đang ở chế độ offline, không thể tải từ máy chủ');
		}

		if (!isOffline) {
			const latest = await fetchOnlineLatestChapter(bookId, options);
			if (latest) {
				return latest;
			}
		}

		const chapters: Chapter[] = await offlineDb.getChapters(bookId);
		if (!chapters || chapters.length === 0) return null;
		return chapters.reduce((max, c) => (c.chapterNumber > max.chapterNumber ? c : max), chapters[0]);
	},

	async getChapterContent(
		chapterId: string,
		rawGroupLines?: number,
		rawIsEnabledReplace?: boolean,
		rawRootTab?: string,
		rawBatchSize?: number,
		options?: { forceFresh?: boolean }
	): Promise<ChapterContent> {
		const { groupLines, isEnabledReplace, rootTab, batchSize } = resolveChapterContentParams(
			rawGroupLines,
			rawIsEnabledReplace,
			rawRootTab,
			rawBatchSize
		);
		const isOffline = useAppStore.getState().isOfflineMode;

		if (isOffline) {
			if (options?.forceFresh) {
				throw new Error('Đang ở chế độ offline, không thể tải từ máy chủ');
			}
			return await processOfflineBatch(chapterId, batchSize, groupLines, isEnabledReplace);
		}

		try {
			return await fetchOnlineChapterContent(chapterId, groupLines, isEnabledReplace, rootTab, batchSize, options?.forceFresh);
		} catch (e: unknown) {
			if (options?.forceFresh) {
				handleChapterContentError(e);
			}
			return await processOfflineBatch(chapterId, batchSize, groupLines, isEnabledReplace);
		}
	},

	async saveChapterOffline(chapter: Chapter & { bookId: string }, content: ChapterContent): Promise<void> {
		await offlineDb.saveChapter(chapter);
		await offlineDb.saveChapterContent(content);
	},

	async translate(data: unknown): Promise<unknown> {
		const timeout = 10 * 60 * 1000; // 10 minutes timeout for AI translation
		return apiClient.post('/stories/gemini-ai/translate', data, { timeout, retries: 0 });
	},

	async getPoolStatus(model: string, platform?: string): Promise<unknown> {
		const platformQuery = platform ? `&platform=${encodeURIComponent(platform)}` : '';
		return apiClient.get(`/api/ai-token/pool-status?model=${encodeURIComponent(model)}${platformQuery}`);
	},
};
