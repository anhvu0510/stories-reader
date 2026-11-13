import { ChapterRepository } from '@/repositories/ChapterRepository';

export type Tab = 'current' | 'batch_chapter' | 'story';

export interface TranslationOptions {
	model: string;
	platform?: string;
	minWords: number;
	maxWords: number;
	temperature: number;
	forceRetranslate: boolean;
	batchingGroup?: boolean;
	availableModels?: string[];
}

export interface PoolStatus {
	model?: string;
	remain: number;
	total: number;
	[key: string]: unknown;
}

export interface TranslationSyncResponse {
	totalTokens?: number;
	resultTrans?: Record<string, { chapter?: { totalTokens?: number } }>;
}

export interface QuotasPayload {
	availableModels?: (string | { model?: string })[];
	quotas?: (string | { model?: string })[];
	currentConfig?: { platform?: string; [key: string]: unknown };
	config?: { platform?: string; [key: string]: unknown };
}

export const DEFAULT_VERTEX_MODELS: string[] = [];

export interface ModelPlatformOption {
	model: string;
	platform: string;
	rpdLimit?: number;
	rpmLimit?: number;
}

export const DEFAULT_PLATFORM_MODELS: ModelPlatformOption[] = [];

function parseQuotaItem(raw: unknown): ModelPlatformOption | null {
	if (!raw || typeof raw !== 'object') return null;
	const item = raw as { model?: string; platform?: string; rpdLimit?: number; rpmLimit?: number; isActive?: boolean };
	if (item.isActive === false || !item.model) return null;
	const cleanModel = item.model.replace(/\s*\([VA]\)$/i, '').trim();
	const platform = item.platform || (cleanModel.toLowerCase().includes('deepseek') ? 'DEPLOYAI' : 'AI_STUDIO');
	return { model: cleanModel, platform, rpdLimit: item.rpdLimit, rpmLimit: item.rpmLimit };
}

function parseAvailableModelItem(raw: unknown): ModelPlatformOption | null {
	if (!raw) return null;
	const cleanModel = String(raw)
		.replace(/\s*\([VA]\)$/i, '')
		.trim();
	const platform = cleanModel.toLowerCase().includes('deepseek') ? 'DEPLOYAI' : 'AI_STUDIO';
	return { model: cleanModel, platform };
}

export function buildModelPlatformList(quotas?: unknown[], availableModels?: string[]): ModelPlatformOption[] {
	const items: ModelPlatformOption[] = [];
	const seen = new Set<string>();

	const appendIfNew = (item: ModelPlatformOption | null) => {
		if (!item) return;
		const key = `${item.platform}:::${item.model}`;
		if (seen.has(key)) return;
		seen.add(key);
		items.push(item);
	};

	if (Array.isArray(quotas)) {
		quotas.forEach((q) => appendIfNew(parseQuotaItem(q)));
	}
	if (items.length === 0 && Array.isArray(availableModels)) {
		availableModels.forEach((m) => appendIfNew(parseAvailableModelItem(m)));
	}

	return items;
}

export const defaultOptions: TranslationOptions = {
	model: '',
	platform: '',
	minWords: 100,
	maxWords: 500,
	temperature: 0.7,
	forceRetranslate: false,
	batchingGroup: true,
	availableModels: [],
};

export interface TranslationSheetProps {
	onClose: () => void;
	currentBookName?: string;
	currentChapterName?: string;
	currentBookId?: string;
	currentChapterId?: string;
	currentChapterNumber?: number;
	initialTab?: Tab;
	initialSelectedChapters?: string[];
	onSuccess?: () => void;
	disableCurrent?: boolean;
}

export function resolveTranslationSheetProps(props: TranslationSheetProps) {
	return {
		onClose: props.onClose,
		currentBookName: props.currentBookName,
		currentChapterName: props.currentChapterName,
		currentBookId: props.currentBookId,
		currentChapterId: props.currentChapterId,
		currentChapterNumber: props.currentChapterNumber,
		initialTab: props.initialTab || 'batch_chapter',
		initialSelectedChapters: props.initialSelectedChapters || [],
		onSuccess: props.onSuccess,
		disableCurrent: Boolean(props.disableCurrent),
	};
}

export function extractRawQuotas(res: unknown): (string | { model?: string })[] {
	if (!res || typeof res !== 'object') return [];
	const p = res as QuotasPayload;
	if (Array.isArray(p.availableModels)) return p.availableModels;
	if (Array.isArray(p.quotas)) return p.quotas;
	if (Array.isArray(res)) return res;
	return [];
}

export function extractUniqueModels(rawQuotas: (string | { model?: string })[]): string[] {
	const modelsList = rawQuotas
		.map((m) => (typeof m === 'string' ? m : m.model || ''))
		.map((m) => m.replace(/\s*\([VA]\)$/i, '').trim())
		.filter(Boolean);
	return [...new Set(modelsList)];
}

export function extractConfig(res: unknown) {
	if (!res || typeof res !== 'object') return null;
	const p = res as QuotasPayload;
	const cfg = p.currentConfig || p.config;
	if (!cfg || typeof cfg !== 'object') return null;
	let loadedPlatform = cfg.platform;
	if (loadedPlatform === 'VERTEX_API' || !loadedPlatform) loadedPlatform = 'AI_STUDIO';
	if (typeof cfg.model === 'string' && cfg.model.includes('deepseek')) {
		loadedPlatform = 'DEPLOYAI';
	}
	return { ...cfg, platform: loadedPlatform };
}

export function validateSubmitParams(
	activeTab: Tab,
	chapterIdToUse: string | undefined,
	selectedChaptersCount: number,
	selectedBooksCount: number,
	model?: string
): string | null {
	if (!model) {
		return 'Chưa có mô hình AI khả dụng từ máy chủ';
	}
	if (activeTab === 'current' && !chapterIdToUse) {
		return 'Không xác định được chương hiện tại';
	}
	if (activeTab === 'batch_chapter' && selectedChaptersCount === 0) {
		return 'Vui lòng chọn ít nhất 1 chương';
	}
	if (activeTab === 'story' && selectedBooksCount === 0) {
		return 'Vui lòng chọn ít nhất 1 truyện';
	}
	return null;
}

export function resolveChapterIds(activeTab: Tab, selectedChapters: Set<string>, chapterIdToUse?: string): string[] {
	if (activeTab === 'batch_chapter') {
		return Array.from(selectedChapters);
	}
	if (chapterIdToUse) {
		return [chapterIdToUse];
	}
	return [];
}

export function extractSyncTokensMessage(res: unknown, chapterId?: string): string {
	const transResult = res as TranslationSyncResponse;
	const chapterResult = chapterId ? transResult?.resultTrans?.[chapterId] : undefined;
	const totalTokens = transResult?.totalTokens || chapterResult?.chapter?.totalTokens || 0;
	if (totalTokens > 0) {
		return `🎉 Dịch thành công! Tokens: ${totalTokens.toLocaleString('vi-VN')} tokens`;
	}
	return '🎉 Dịch thành công!';
}

export function buildAsyncTranslatePayload(
	activeTab: Tab,
	options: TranslationOptions,
	platform: string,
	currentBookId?: string,
	chapterIdToUse?: string,
	selectedChapters?: Set<string>,
	selectedBooks?: Set<string>,
	initialSelectedChapters?: string[]
) {
	const base = {
		model: options.model,
		platform,
		minWords: options.minWords,
		maxWords: options.maxWords,
		temperature: options.temperature,
		retryTranslate: options.forceRetranslate,
		batchingGroup: options.batchingGroup,
		currentChapterId: initialSelectedChapters?.[0],
	};

	if (activeTab === 'current') {
		return {
			...base,
			mode: 'batch_chapter',
			bookId: currentBookId,
			chapterId: [chapterIdToUse],
		};
	}
	if (activeTab === 'batch_chapter') {
		return {
			...base,
			mode: 'batch_chapter',
			bookId: currentBookId,
			chapterId: Array.from(selectedChapters || []),
		};
	}
	return {
		...base,
		mode: 'story',
		bookId: Array.from(selectedBooks || []),
	};
}

export async function executeSyncTranslate(
	activeTab: Tab,
	options: TranslationOptions,
	platform: string,
	currentBookId?: string,
	chapterIdToUse?: string,
	selectedChapters?: Set<string>,
	selectedBooks?: Set<string>,
	showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void,
	onClose?: () => void,
	onSuccess?: () => void
) {
	showToast?.('Đang dịch AI trực tiếp (vui lòng chờ)...', 'info');
	const chapterIds = resolveChapterIds(activeTab, selectedChapters || new Set(), chapterIdToUse);
	const res = await ChapterRepository.translate({
		mode: 'current',
		model: options.model,
		platform,
		minWords: options.minWords,
		maxWords: options.maxWords,
		temperature: options.temperature,
		retryTranslate: options.forceRetranslate,
		batchingGroup: options.batchingGroup,
		bookId: activeTab === 'story' ? Array.from(selectedBooks || []) : currentBookId,
		chapterId: chapterIds.length > 0 ? chapterIds : undefined,
		currentChapterId: chapterIdToUse,
	});

	showToast?.(extractSyncTokensMessage(res, chapterIds[0]), 'success');
	onClose?.();
	onSuccess?.();
}

export async function executeAsyncTranslate(
	activeTab: Tab,
	payload: Record<string, unknown>,
	showToast: (msg: string, type?: 'success' | 'error' | 'info') => void,
	onClose: () => void,
	selectedChaptersSize: number,
	selectedBooksSize: number
) {
	await ChapterRepository.translate(payload);
	if (activeTab === 'current') {
		showToast('Đã gửi yêu cầu dịch vào hàng đợi', 'success');
	} else if (activeTab === 'batch_chapter') {
		showToast(`Đã gửi yêu cầu dịch ${selectedChaptersSize} chương`, 'success');
	} else {
		showToast(`Đã gửi yêu cầu dịch ${selectedBooksSize} truyện`, 'success');
	}
	setTimeout(() => onClose(), 1500);
}

export * from './translationChapterPagination';
