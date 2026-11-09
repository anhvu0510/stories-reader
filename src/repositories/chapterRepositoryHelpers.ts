import { offlineDb } from '@/lib/offlineDb';
import { apiClient, type RequestOptions } from '@/services/apiClient';
import { INVISIBLE_SENTENCE_DELIMITER } from '@/shared/constants/textBoundaries';

import type { Chapter, ChapterContent, ChapterDetailItem, Replacement } from '@/shared/types';

export interface RawPaginationMeta {
	totalPages?: number;
	total_pages?: number;
	total?: number;
	totalItems?: number;
	total_count?: number;
	currentPage?: number;
	page?: number;
}

export interface RawChapterItem {
	chapterId?: string;
	_id?: string;
	id?: string;
	chapterNumber?: number | string;
	title?: string;
	state?: Chapter['state'];
	updatedAt?: string;
	bookId?: string;
	[key: string]: unknown;
}

export interface ApiChapterListResponse {
	chapters?: RawChapterItem[];
	data?: RawChapterItem[];
	items?: RawChapterItem[];
	pagination?: RawPaginationMeta;
	meta?: RawPaginationMeta;
}

function extractPaginationMeta(p: RawPaginationMeta, fallbackPage: number) {
	return {
		currentPage: p.currentPage ?? p.page ?? fallbackPage,
		explicitPages: p.totalPages ?? p.total_pages,
		explicitTotal: p.total ?? p.totalItems ?? p.total_count,
	};
}

function normalizePagination(
	pag: RawPaginationMeta | undefined,
	limit: number,
	page: number,
	rawCount: number
): { totalPages: number; total: number; currentPage: number } {
	const { currentPage, explicitPages, explicitTotal } = extractPaginationMeta(pag || {}, page);

	if (explicitPages !== undefined) {
		return { totalPages: explicitPages, total: explicitTotal ?? explicitPages * limit, currentPage };
	}

	if (explicitTotal !== undefined) {
		return { totalPages: Math.max(1, Math.ceil(explicitTotal / limit)), total: explicitTotal, currentPage };
	}

	return { totalPages: rawCount >= limit ? page + 1 : page, total: rawCount, currentPage };
}

function mapRawChapter(c: RawChapterItem, bookId: string, idx: number): Chapter {
	const chapterNumber = typeof c.chapterNumber === 'number' ? c.chapterNumber : parseInt(String(c.chapterNumber), 10) || idx + 1;
	const chapterId = String(c.chapterId || c._id || c.id || `chap-${chapterNumber}`);
	const title = c.title || `Chương ${chapterNumber}`;
	const state = c.state || 'SUCCEEDED';
	const updatedAt = c.updatedAt || new Date().toISOString();
	return {
		chapterId,
		chapterNumber,
		title,
		state,
		updatedAt,
		bookId: c.bookId || bookId,
	};
}

function buildChaptersQuery(
	page: number,
	limit: number,
	sortBy: string,
	sortOrder: string,
	state?: string,
	search?: string,
	fromChapterNumber?: number,
	toChapterNumber?: number,
	forceFresh?: boolean
): string {
	const query = new URLSearchParams({
		page: page.toString(),
		limit: limit.toString(),
		sortBy,
		sortOrder,
	});
	if (state && state !== 'all') query.append('state', state);
	if (search) query.append('search', search);
	if (fromChapterNumber !== undefined) query.append('fromChapterNumber', fromChapterNumber.toString());
	if (toChapterNumber !== undefined) query.append('toChapterNumber', toChapterNumber.toString());
	if (forceFresh) {
		query.append('_t', Date.now().toString());
	}
	return query.toString();
}

export function filterAndSortOfflineChapters(
	chapters: Chapter[],
	state?: string,
	search?: string,
	sortBy?: string,
	sortOrder?: string
): Chapter[] {
	let list = chapters;
	if (state && state !== 'all') {
		list = list.filter((c) => c.state === state);
	}
	if (search) {
		const queryStr = search.toLowerCase();
		list = list.filter((c) => c.title.toLowerCase().includes(queryStr) || c.chapterNumber.toString().includes(queryStr));
	}
	if (sortBy === 'chapterNumber') {
		list.sort((a, b) => (sortOrder === 'ASC' ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber));
	}
	return list;
}

export async function fetchOnlineChapters(
	bookId: string,
	page: number,
	limit: number,
	sortBy: string,
	sortOrder: string,
	state?: string,
	search?: string,
	fromChapterNumber?: number,
	toChapterNumber?: number,
	options?: { forceFresh?: boolean }
) {
	const queryString = buildChaptersQuery(
		page,
		limit,
		sortBy,
		sortOrder,
		state,
		search,
		fromChapterNumber,
		toChapterNumber,
		options?.forceFresh
	);

	const requestOptions: RequestOptions = { timeout: 2500, retries: 0, silent: true };
	if (options?.forceFresh) {
		requestOptions.headers = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
		requestOptions.cache = 'no-store';
	}

	const res = await apiClient.get<ApiChapterListResponse>(`/api/books/${bookId}/chapters?${queryString}`, requestOptions);
	if (!res) return null;

	const rawItems = res.chapters || res.data || res.items || (Array.isArray(res) ? (res as unknown as RawChapterItem[]) : []);
	const rawChapters: Chapter[] = rawItems.map((c, idx) => mapRawChapter(c, bookId, idx));
	const pag = res.pagination || res.meta;
	const pagination = normalizePagination(pag, limit, page, rawChapters.length);

	return {
		chapters: rawChapters,
		pagination,
	};
}

function extractRawChapters(res: ApiChapterListResponse | unknown): RawChapterItem[] {
	if (!res || typeof res !== 'object') return [];
	const obj = res as ApiChapterListResponse;
	if (obj.chapters && obj.chapters.length > 0) return obj.chapters;
	if (obj.data && obj.data.length > 0) return obj.data;
	if (obj.items && obj.items.length > 0) return obj.items;
	if (Array.isArray(res)) return res as RawChapterItem[];
	return [];
}

function buildLatestChapterRequestOptions(forceFresh?: boolean): { query: string; requestOptions: RequestOptions } {
	const query = new URLSearchParams({
		page: '1',
		limit: '1',
		sortBy: 'chapterNumber',
		sortOrder: 'DESC',
	});
	if (forceFresh) {
		query.append('_t', Date.now().toString());
	}

	const requestOptions: RequestOptions = {
		timeout: 5000,
		retries: 0,
		silent: true,
	};
	if (forceFresh) {
		requestOptions.headers = {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
		requestOptions.cache = 'no-store';
	}
	return { query: query.toString(), requestOptions };
}

export async function fetchOnlineLatestChapter(bookId: string, options?: { forceFresh?: boolean }): Promise<Chapter | null> {
	try {
		const { query, requestOptions } = buildLatestChapterRequestOptions(options?.forceFresh);
		const res = await apiClient.get<ApiChapterListResponse>(`/api/books/${bookId}/chapters?${query}`, requestOptions);
		const rawItems = extractRawChapters(res);
		if (rawItems.length > 0) {
			return mapRawChapter(rawItems[0], bookId, 0);
		}
		return null;
	} catch (e: unknown) {
		console.warn('Failed to fetch latest chapter online:', e);
		if (options?.forceFresh) {
			const msg = e instanceof Error ? e.message : 'Không thể lấy thông tin chương mới nhất từ máy chủ';
			throw new Error(msg, { cause: e });
		}
		return null;
	}
}

function applyReplacements(lines: string[], replacements: Replacement[]): string[] {
	if (replacements.length === 0 || lines.length === 0) return lines;
	return lines.map((line) => {
		let res = line;
		for (const r of replacements) {
			if (r.match) res = res.split(r.match).join(r.replacement);
		}
		return res;
	});
}

function groupChapterLines(lines: string[], groupLines: number): string[] {
	if (groupLines <= 1 || lines.length === 0) return lines;
	const grouped: string[] = [];
	let currentGroup: string[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		currentGroup.push(line);
		if (currentGroup.length >= groupLines) {
			grouped.push(currentGroup.join(` ${INVISIBLE_SENTENCE_DELIMITER} `));
			currentGroup = [];
		}
	}
	if (currentGroup.length > 0) {
		grouped.push(currentGroup.join(` ${INVISIBLE_SENTENCE_DELIMITER} `));
	}
	return grouped;
}

function getChapterDetailTitle(rawChap?: { title?: string; titleVN?: string; titleRaw?: string }): string {
	if (!rawChap) return '';
	if (rawChap.title) return rawChap.title;
	if (rawChap.titleVN) return rawChap.titleVN;
	return rawChap.titleRaw || '';
}

function formatOfflineChapterItem(item: ChapterContent, replacements: Replacement[], isEnabledReplace: boolean, groupLines: number) {
	const chap = item.chapter;
	if (!chap) {
		return { chapterId: '', chapterNumber: 0, title: '', content: [] } as unknown as ChapterDetailItem;
	}

	const contentList = Array.isArray(chap.content) ? [...chap.content] : [];
	const replacedLines = isEnabledReplace ? applyReplacements(contentList, replacements) : contentList;
	const lines = groupChapterLines(replacedLines, groupLines);
	const title = getChapterDetailTitle(chap as ChapterDetailItem & { titleVN?: string; titleRaw?: string });

	return {
		chapterId: chap.chapterId,
		bookId: chap.bookId,
		bookName: chap.bookName,
		chapterNumber: chap.chapterNumber,
		title,
		createdAt: chap.createdAt,
		updatedAt: chap.updatedAt,
		content: lines,
		state: chap.state,
		chapterPlan: chap.chapterPlan,
		qaReports: chap.qaReports,
		continuitySnapshot: chap.continuitySnapshot,
	};
}

async function loadOfflineReplacements(bookId?: string, rawChapterItems: ChapterContent[] = []): Promise<Replacement[]> {
	try {
		let reps = await offlineDb.getReplacements();
		if (bookId) {
			const chapterIds = new Set(rawChapterItems.map((c) => c.chapter?.chapterId));
			reps = reps.filter((r) => r.scope === 'global' || r.bookId === bookId || (r.chapterId && chapterIds.has(r.chapterId)));
		} else {
			reps = reps.filter((r) => r.scope === 'global');
		}
		reps.sort((a, b) => (b.match?.length || 0) - (a.match?.length || 0));
		return reps;
	} catch {
		return [];
	}
}

function getNavTarget(chap?: Chapter & { titleVN?: string }) {
	if (!chap) return null;
	return {
		chapterId: chap.chapterId,
		chapterNumber: chap.chapterNumber,
		title: chap.title || chap.titleVN || '',
	};
}

function calculateBatchNavigation(
	allBookChapters: (Chapter & { bookId: string })[],
	currentIdx: number,
	batchCount: number,
	targetBatchSize: number
) {
	if (currentIdx === -1 || allBookChapters.length === 0) {
		return { prev: null, next: null };
	}

	const targetPrevIdx = Math.max(0, currentIdx - targetBatchSize);
	const prev = currentIdx > 0 ? getNavTarget(allBookChapters[targetPrevIdx] as Chapter & { titleVN?: string }) : null;

	const nextIdx = currentIdx + batchCount;
	const next = nextIdx < allBookChapters.length ? getNavTarget(allBookChapters[nextIdx] as Chapter & { titleVN?: string }) : null;

	return { prev, next };
}

async function collectLookaheadChapters(
	allBookChapters: (Chapter & { bookId: string })[],
	currentIdx: number,
	targetBatchSize: number,
	rawChapterItems: ChapterContent[]
) {
	const maxLookahead = Math.min(allBookChapters.length, currentIdx + targetBatchSize);
	for (let i = currentIdx + 1; i < maxLookahead; i++) {
		const nextChap = allBookChapters[i];
		const nextContent = await offlineDb.getChapterContent(nextChap.chapterId);
		if (!nextContent) break;
		rawChapterItems.push(nextContent);
	}
}

export async function processOfflineBatch(
	startChapterId: string,
	targetBatchSize: number,
	groupLines: number,
	isEnabledReplace: boolean
): Promise<ChapterContent> {
	const chapMeta = await offlineDb.getChapterMeta(startChapterId);
	const startContent = await offlineDb.getChapterContent(startChapterId);
	if (!startContent) {
		throw new Error('Chương này chưa được tải xuống để đọc offline');
	}

	const bookId = chapMeta?.bookId || startContent.chapter?.bookId;
	const rawChapterItems: ChapterContent[] = [startContent];
	let allBookChapters: (Chapter & { bookId: string })[] = [];
	let currentIdx = -1;

	if (bookId) {
		allBookChapters = await offlineDb.getChapters(bookId);
		allBookChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
		currentIdx = allBookChapters.findIndex((c) => c.chapterId === startChapterId);
	}

	if (bookId && targetBatchSize > 1 && currentIdx !== -1) {
		await collectLookaheadChapters(allBookChapters, currentIdx, targetBatchSize, rawChapterItems);
	}

	const reps = isEnabledReplace ? await loadOfflineReplacements(bookId, rawChapterItems) : [];
	const formattedChapters = rawChapterItems.map((item) => formatOfflineChapterItem(item, reps, isEnabledReplace, groupLines));
	const navigation = calculateBatchNavigation(allBookChapters, currentIdx, rawChapterItems.length, targetBatchSize);

	return {
		chapter: formattedChapters[0],
		chapters: formattedChapters,
		navigation,
	};
}
