import {
	X,
	Languages,
	Settings2,
	Square,
	Search,
	ChevronDown,
	ChevronUp,
	Loader,
	Check,
	Zap,
	Send,
	UserCheck,
	Heading,
	Eye,
	EyeOff,
	RotateCcw,
	CheckCircle2,
	Clock,
	AlertCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import React, { useState, useEffect, useRef } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { AIRepository } from '@/repositories/AIRepository';
import { BookRepository } from '@/repositories/BookRepository';
import { ChapterRepository } from '@/repositories/ChapterRepository';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';
import { useToastStore } from '@/stores/useToastStore';

import { BottomSheet } from './BottomSheet';

import type { Book, Chapter, AIQuota } from '@/shared/types';

type Tab = 'current' | 'batch_chapter' | 'story';

interface TranslationOptions {
	model: string;
	platform?: string;
	minWords: number;
	maxWords: number;
	temperature: number;
	forceRetranslate: boolean;
	batchingGroup?: boolean;
	availableModels?: string[];
}

interface PoolStatus {
	model?: string;
	remain: number;
	total: number;
	[key: string]: unknown;
}

interface TranslationSyncResponse {
	totalTokens?: number;
	resultTrans?: Record<string, { chapter?: { totalTokens?: number } }>;
}

interface QuotasPayload {
	availableModels?: (string | { model?: string })[];
	quotas?: (string | { model?: string })[];
	currentConfig?: { platform?: string; [key: string]: unknown };
	config?: { platform?: string; [key: string]: unknown };
}

const DEFAULT_VERTEX_MODELS = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const defaultOptions: TranslationOptions = {
	model: 'gemini-2.5-flash-lite',
	platform: 'AI_STUDIO',
	minWords: 100,
	maxWords: 500,
	temperature: 0.7,
	forceRetranslate: false,
	batchingGroup: true,
	availableModels: DEFAULT_VERTEX_MODELS,
};

interface TranslationSheetProps {
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

function resolveTranslationSheetProps(props: TranslationSheetProps) {
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

function extractRawQuotas(res: unknown): (string | { model?: string })[] {
	if (!res || typeof res !== 'object') return [];
	const p = res as QuotasPayload;
	if (Array.isArray(p.availableModels)) return p.availableModels;
	if (Array.isArray(p.quotas)) return p.quotas;
	if (Array.isArray(res)) return res;
	return [];
}

function extractUniqueModels(rawQuotas: (string | { model?: string })[]): string[] {
	const modelsList = rawQuotas
		.map((m) => (typeof m === 'string' ? m : m.model || ''))
		.map((m) => m.replace(/\s*\([VA]\)$/i, '').trim())
		.filter(Boolean);
	return [...new Set(modelsList)];
}

function extractConfig(res: unknown) {
	if (!res || typeof res !== 'object') return null;
	const p = res as QuotasPayload;
	const cfg = p.currentConfig || p.config;
	if (!cfg || typeof cfg !== 'object') return null;
	let loadedPlatform = cfg.platform;
	if (loadedPlatform === 'VERTEX_API' || !loadedPlatform) loadedPlatform = 'AI_STUDIO';
	return { ...cfg, platform: loadedPlatform };
}

function validateSubmitParams(
	activeTab: Tab,
	chapterIdToUse: string | undefined,
	selectedChaptersCount: number,
	selectedBooksCount: number
): string | null {
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

function resolveChapterIds(activeTab: Tab, selectedChapters: Set<string>, chapterIdToUse?: string): string[] {
	if (activeTab === 'batch_chapter') {
		return Array.from(selectedChapters);
	}
	if (chapterIdToUse) {
		return [chapterIdToUse];
	}
	return [];
}

function extractSyncTokensMessage(res: unknown, chapterId?: string): string {
	const transResult = res as TranslationSyncResponse;
	const chapterResult = chapterId ? transResult?.resultTrans?.[chapterId] : undefined;
	const totalTokens = transResult?.totalTokens || chapterResult?.chapter?.totalTokens || 0;
	if (totalTokens > 0) {
		return `🎉 Dịch thành công! Tokens: ${totalTokens.toLocaleString('vi-VN')} tokens`;
	}
	return '🎉 Dịch thành công!';
}

function buildAsyncTranslatePayload(
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

async function executeSyncTranslate(
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

async function executeAsyncTranslate(
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

function parseRangeInputs(rangeStart: string, rangeEnd: string): { start: number; end: number } | null {
	const start = parseInt(rangeStart, 10);
	const end = parseInt(rangeEnd, 10);
	if (isNaN(start) || isNaN(end) || start > end || start < 1) {
		return null;
	}
	return { start, end };
}

function scrollToChapterElement(container: HTMLDivElement | null, chapterNumber: number) {
	if (!container) return;
	const firstEl = container.querySelector(`#chapter-item-${chapterNumber}`);
	if (!firstEl) return;
	const containerRect = container.getBoundingClientRect();
	const activeRect = firstEl.getBoundingClientRect();
	const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top);
	container.scrollTop = Math.max(0, targetScrollTop);
}

function shouldSkipFetchPrevTop(
	loadingTop: boolean,
	hasMoreTop: boolean,
	minChapterNum: number,
	currentBookId?: string,
	isInitialScrollDone?: boolean
): boolean {
	if (loadingTop || !hasMoreTop || minChapterNum <= 1) return true;
	if (!currentBookId || !isInitialScrollDone) return true;
	return false;
}

function mergePrependedChapters(prev: Chapter[], newChapters: Chapter[]) {
	const existingIds = new Set(prev.map((c) => c.chapterId));
	const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
	return [...uniqueNew, ...prev];
}

function getSyncButtonLabel(
	isSubmitting: boolean,
	submittingType: 'sync' | 'async' | null,
	activeTab: Tab,
	selectedChaptersCount: number,
	selectedBooksCount: number
): string {
	if (isSubmitting && submittingType === 'sync') return 'Đang Dịch...';
	if (activeTab === 'current') return 'Dịch';
	if (activeTab === 'batch_chapter') return `Dịch (${selectedChaptersCount})`;
	return `Dịch (${selectedBooksCount})`;
}

function getAsyncButtonLabel(
	isSubmitting: boolean,
	submittingType: 'sync' | 'async' | null,
	activeTab: Tab,
	selectedChaptersCount: number,
	selectedBooksCount: number
): string {
	if (isSubmitting && submittingType === 'async') return 'Đang Đẩy Queue...';
	if (activeTab === 'current') return 'Dịch Queue';
	if (activeTab === 'batch_chapter') return `Dịch Batch (${selectedChaptersCount})`;
	return `Dịch Batch (${selectedBooksCount})`;
}

function getTabButtonClass(active: boolean, disabled?: boolean): string {
	if (disabled) return 'opacity-30 cursor-not-allowed bg-transparent text-on-surface-variant';
	if (active) return 'bg-primary/20 text-primary font-black border border-primary/50 shadow-xs';
	return 'text-on-surface-variant/80 hover:text-on-surface border border-transparent cursor-pointer';
}

function TabButton({
	active,
	children,
	onClick,
	disabled,
}: {
	active: boolean;
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	const btnClass = getTabButtonClass(active, disabled);
	return (
		<motion.button
			whileTap={disabled ? undefined : { scale: 0.94 }}
			onClick={() => {
				if (!disabled) {
					triggerHaptic('selection');
					onClick();
				}
			}}
			disabled={disabled}
			className={`flex-1 py-1.5 min-h-[32px] text-xs font-bold rounded-md transition-all duration-200 flex items-center justify-center ${btnClass}`}
		>
			{children}
		</motion.button>
	);
}

function getChapterBadgeClass(isSelected: boolean, state?: string): string {
	if (isSelected) {
		return 'bg-primary/30 border-primary/70 text-primary font-extrabold';
	}
	if (state === 'SUCCEEDED') {
		return 'bg-primary/15 text-primary border-primary/30';
	}
	return 'bg-white/10 text-on-surface-variant border-white/20';
}

function ChapterStateIcon({ state }: { state?: string }) {
	if (state === 'SUCCEEDED') {
		return <CheckCircle2 size={13} className="text-primary shrink-0" title="Đã dịch" />;
	}
	if (state === 'FAILED') {
		return <AlertCircle size={13} className="text-rose-400 shrink-0" title="Lỗi dịch" />;
	}
	return <Clock size={13} className="text-amber-400/80 shrink-0" title="Chưa dịch" />;
}

interface AIConfigDropdownProps {
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
}

function AIConfigDropdown({ options, setOptions, setPoolStatus }: AIConfigDropdownProps) {
	const rawModels = options.availableModels || DEFAULT_VERTEX_MODELS;
	const cleanModels = [...new Set(rawModels.map((m) => (typeof m === 'string' ? m.replace(/\s*\([VA]\)$/i, '').trim() : m)))] as string[];

	return (
		<div className="px-3 p-3 flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto hide-scrollbar">
			<div className="grid grid-cols-2 gap-2">
				<div className="flex flex-col gap-1">
					<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-0.5">GIỚI HẠN TỪ</label>
					<div className="flex items-center bg-surface-container-highest rounded-lg p-0.5">
						<input
							type="number"
							value={options.minWords}
							onChange={(e) =>
								setOptions({
									...options,
									minWords: Number(e.target.value),
								})
							}
							className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
						/>
						<span className="text-on-surface-variant/30 text-[10px]">-</span>
						<input
							type="number"
							value={options.maxWords}
							onChange={(e) =>
								setOptions({
									...options,
									maxWords: Number(e.target.value),
								})
							}
							className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<div className="flex justify-between items-center px-0.5">
						<label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">SÁNG TẠO</label>
						<span className="text-[10px] font-bold text-primary">{Number(options.temperature).toFixed(1)}</span>
					</div>
					<div className="bg-surface-container-highest rounded-lg p-1 px-2 h-full flex items-center">
						<input
							type="range"
							min="0"
							max="1"
							step="0.1"
							value={options.temperature}
							onChange={(e) =>
								setOptions({
									...options,
									temperature: Number(e.target.value),
								})
							}
							className="w-full accent-primary h-1 bg-outline-variant/20 rounded-full appearance-none cursor-pointer"
						/>
					</div>
				</div>
			</div>
			<div className="space-y-2 pt-1">
				<div className="flex items-center justify-between">
					<span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Mô hình AI:</span>
				</div>

				<div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto hide-scrollbar p-0.5">
					{cleanModels.map((m) => {
						const isSelected = options.model === m;
						const formattedName = String(m)
							.replace(/^gemini-/, '')
							.replace(/-/g, ' ')
							.toUpperCase();

						return (
							<button
								key={m}
								onClick={() => {
									setOptions({
										...options,
										model: m,
										platform: 'AI_STUDIO',
									});
									setPoolStatus(null);
								}}
								className={cn(
									'px-3 py-2 rounded-xl text-left border transition-all flex items-center justify-between active:scale-95',
									isSelected
										? 'bg-primary/20 hover:bg-primary/25 border-2 border-primary text-primary font-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]'
										: 'bg-white/5 hover:bg-white/10 border border-white/10 text-on-surface font-medium'
								)}
							>
								<div className="min-w-0 pr-1 flex-1">
									<div className={`font-mono font-bold text-[11px] truncate ${isSelected ? 'text-primary font-black' : 'text-on-surface'}`}>
										{formattedName || m}
									</div>
								</div>
								{isSelected && <Check size={13} className="text-primary shrink-0 font-bold ml-1" />}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

interface ChapterBatchControlsProps {
	selectedCount: number;
	chaptersCount: number;
	onClearSelection: () => void;
	showOnlyPending: boolean;
	onTogglePending: (val: boolean) => void;
	rangeStart: string;
	setRangeStart: (val: string) => void;
	rangeEnd: string;
	setRangeEnd: (val: string) => void;
	onSelectRange: () => void;
	onSelectAll: () => void;
	onSelectPending: () => void;
}

function ChapterBatchControls({
	selectedCount,
	chaptersCount,
	onClearSelection,
	showOnlyPending,
	onTogglePending,
	rangeStart,
	setRangeStart,
	rangeEnd,
	setRangeEnd,
	onSelectRange,
	onSelectAll,
	onSelectPending,
}: ChapterBatchControlsProps) {
	return (
		<div className="flex flex-col gap-2.5 mb-3 bg-white/[0.02] p-2.5 rounded-2xl border border-white/10">
			{/* Row 1: Title + Counter Badge & Icon Buttons (Bỏ chọn & Ẩn đã dịch) */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Chọn chương</span>
					<span
						className={cn(
							'text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md border transition-all',
							selectedCount > 0
								? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
								: 'bg-white/5 text-on-surface-variant/70 border-white/10'
						)}
					>
						{selectedCount}/{chaptersCount}
					</span>
				</div>

				{/* Icon Buttons Group: Bỏ chọn & Ẩn đã dịch */}
				<div className="flex items-center gap-1.5">
					{selectedCount > 0 && (
						<button
							onClick={onClearSelection}
							className="p-1.5 rounded-lg border bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 active:scale-95 transition-all flex items-center justify-center"
							title="Bỏ chọn tất cả"
							aria-label="Bỏ chọn"
						>
							<RotateCcw size={13} />
						</button>
					)}

					<label
						className={cn(
							'p-1.5 rounded-lg border transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center',
							showOnlyPending
								? 'bg-primary/20 text-primary border-primary/60 shadow-xs'
								: 'bg-white/5 text-on-surface-variant/70 border-white/10 hover:bg-white/10'
						)}
						title="Ẩn chương đã dịch"
					>
						<input
							type="checkbox"
							checked={showOnlyPending}
							onChange={(e) => onTogglePending(e.target.checked)}
							className="sr-only"
							aria-label="Ẩn đã dịch"
						/>
						{showOnlyPending ? <EyeOff size={13} /> : <Eye size={13} />}
					</label>
				</div>
			</div>

			{/* Row 2: Quick Action Chips & Range Selector */}
			<div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
				<div className="flex items-center gap-1">
					<button
						onClick={onSelectAll}
						className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-primary active:scale-95 transition-all"
					>
						Tất cả
					</button>
					<button
						onClick={onSelectPending}
						className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-[10px] font-bold text-primary active:scale-95 transition-all"
					>
						Chưa dịch
					</button>
				</div>

				<div className="flex items-center gap-1.5 ml-auto">
					<span className="text-[10px] text-on-surface-variant/70 font-medium">Từ</span>
					<input
						type="number"
						placeholder="..."
						value={rangeStart}
						onChange={(e) => setRangeStart(e.target.value)}
						className="w-11 bg-black/30 border border-white/15 px-1 py-0.5 rounded-md text-[11px] font-mono text-primary text-center outline-none focus:border-primary/70 transition-all"
					/>
					<span className="text-[10px] text-on-surface-variant/50">-</span>
					<input
						type="number"
						placeholder="..."
						value={rangeEnd}
						onChange={(e) => setRangeEnd(e.target.value)}
						className="w-11 bg-black/30 border border-white/15 px-1 py-0.5 rounded-md text-[11px] font-mono text-primary text-center outline-none focus:border-primary/70 transition-all"
					/>
					<button
						onClick={onSelectRange}
						className="text-[10px] bg-primary text-on-primary border border-primary/70 shadow-xs px-2.5 py-1 rounded-md font-extrabold hover:brightness-110 active:scale-95 transition-all"
					>
						Chọn
					</button>
				</div>
			</div>
		</div>
	);
}

interface BatchChapterListProps {
	chapters: Chapter[];
	showOnlyPending: boolean;
	selectedChapters: Set<string>;
	currentChapterId?: string;
	currentChapterNumber?: number;
	initialSelectedChapters: string[];
	chapterListRef: React.RefObject<HTMLDivElement | null>;
	activeItemRef: React.RefObject<HTMLDivElement | null>;
	onScroll: () => void;
	onToggleChapter: (id: string) => void;
}

function BatchChapterList({
	chapters,
	showOnlyPending,
	selectedChapters,
	currentChapterId,
	currentChapterNumber,
	initialSelectedChapters,
	chapterListRef,
	activeItemRef,
	onScroll,
	onToggleChapter,
}: BatchChapterListProps) {
	const activeChapterId = initialSelectedChapters[0] || currentChapterId;
	const filtered = [...chapters]
		.sort((a, b) => a.chapterNumber - b.chapterNumber)
		.filter((chap) => !showOnlyPending || chap.state === 'PENDING' || chap.state === 'FAILED');

	return (
		<div ref={chapterListRef} onScroll={onScroll} className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 min-h-[30vh]">
			{filtered.map((chap) => {
				const isCurrentChapter = chap.chapterId === activeChapterId || chap.chapterNumber === currentChapterNumber;
				const isSelected = selectedChapters.has(chap.chapterId);
				const badgeClass = getChapterBadgeClass(isSelected, chap.state);
				return (
					<div
						key={chap.chapterId}
						id={`chapter-item-${chap.chapterNumber}`}
						ref={isCurrentChapter ? activeItemRef : undefined}
						onClick={() => onToggleChapter(chap.chapterId)}
						className={cn(
							'group flex justify-between items-center px-2.5 py-1.5 cursor-pointer transition-all rounded-lg border relative shadow-xs gap-2',
							isSelected
								? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary'
								: 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface'
						)}
					>
						<div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
							<div
								className={cn(
									'shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight border transition-colors shadow-2xs',
									badgeClass
								)}
							>
								CH {chap.chapterNumber}
							</div>

							<span
								className={cn(
									'text-[12px] truncate font-medium transition-colors flex-1 min-w-0',
									isSelected ? 'text-primary font-bold drop-shadow-xs' : 'text-on-surface'
								)}
							>
								{chap.title || `Chương ${chap.chapterNumber}`}
							</span>
						</div>

						{/* State Icon Indicator & Selection Check */}
						<div className="flex items-center gap-1.5 shrink-0">
							<ChapterStateIcon state={chap.state} />

							{isSelected ? (
								<Check size={14} className="text-primary flex-shrink-0 font-bold" />
							) : (
								<Square size={14} className="text-on-surface-variant/30 flex-shrink-0" />
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

interface StoryTabContentProps {
	books: Book[];
	searchBook: string;
	onSearchChange: (val: string) => void;
	selectedBooks: Set<string>;
	onToggleBook: (id: string) => void;
}

function StoryTabContent({ books, searchBook, onSearchChange, selectedBooks, onToggleBook }: StoryTabContentProps) {
	const query = searchBook.toLowerCase();
	const filteredBooks = books.filter((b) => b?.bookName && b.bookName.toLowerCase().includes(query));

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<div className="relative mb-3">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant sm:left-3.5" size={12} />
				<input
					type="text"
					placeholder="Tìm truyện..."
					value={searchBook}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full bg-white/5 dark:bg-white/5 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)] rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary/60 transition-all placeholder:text-on-surface-variant/70"
				/>
			</div>
			<div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 p-1 min-h-[30vh]">
				{filteredBooks.length === 0 ? (
					<div className="py-12 text-center text-xs text-on-surface-variant/60 font-medium">Không tìm thấy truyện nào trong thư viện</div>
				) : (
					filteredBooks.map((book) => {
						const isSelected = selectedBooks.has(book.bookId);
						return (
							<div
								key={book.bookId}
								onClick={() => onToggleBook(book.bookId)}
								className={cn(
									'group flex justify-between items-center px-2.5 py-1.5 cursor-pointer transition-all rounded-lg border relative shadow-xs gap-2',
									isSelected
										? 'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary'
										: 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface'
								)}
							>
								<div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
									<div
										className={cn(
											'flex items-center justify-center p-1 rounded-md shrink-0 border transition-colors shadow-2xs',
											isSelected
												? 'bg-primary/30 border-primary/70 text-primary font-extrabold'
												: 'bg-primary/10 border-primary/30 text-primary'
										)}
									>
										<Languages size={12} />
									</div>
									<span
										className={cn(
											'text-[12px] truncate font-medium transition-colors flex-1 min-w-0',
											isSelected ? 'text-primary font-bold drop-shadow-xs' : 'text-on-surface'
										)}
									>
										{book.bookName}
									</span>
								</div>
								{isSelected ? (
									<Check size={14} className="text-primary flex-shrink-0 font-bold" />
								) : (
									<Square size={14} className="text-on-surface-variant/30 flex-shrink-0" />
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

function PoolStatusBadge({ poolStatus }: { poolStatus: PoolStatus }) {
	const isRemainPositive = poolStatus.remain > 0;
	const dotClass = isRemainPositive ? 'bg-primary animate-pulse' : 'bg-rose-500';
	const textClass = isRemainPositive ? 'text-primary' : 'text-rose-400';
	const totalLabel = poolStatus.total > 0 ? poolStatus.total.toLocaleString() : '∞';

	return (
		<span className="ml-2 text-[9px] font-bold text-on-surface-variant bg-white/10 px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
			<div className={`w-1 h-1 rounded-full ${dotClass}`} />
			RPD: <span className={textClass}>{poolStatus.remain.toLocaleString()}</span>/{totalLabel}
		</span>
	);
}

interface TranslationConfigBarProps {
	showConfig: boolean;
	onToggleConfig: () => void;
	poolStatus: PoolStatus | null;
	currentModel?: string;
	onDetectProperNouns: () => void;
	onTranslateChineseTitles: () => void;
	options: TranslationOptions;
	setOptions: React.Dispatch<React.SetStateAction<TranslationOptions>>;
	setPoolStatus: React.Dispatch<React.SetStateAction<PoolStatus | null>>;
}

function TranslationSheetConfigBar({
	showConfig,
	onToggleConfig,
	poolStatus,
	currentModel,
	onDetectProperNouns,
	onTranslateChineseTitles,
	options,
	setOptions,
	setPoolStatus,
}: TranslationConfigBarProps) {
	const showPoolStatus = Boolean(poolStatus && poolStatus.model === currentModel);

	return (
		<div className="flex-shrink-0 bg-white/[0.03] border-b border-white/10">
			<div
				className="w-full flex items-center justify-between py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:bg-white/5 transition-colors cursor-pointer select-none"
				onClick={onToggleConfig}
			>
				<div className="flex items-center gap-2">
					<Settings2 size={13} />
					<span>Cấu hình AI</span>
					{showPoolStatus && poolStatus && <PoolStatusBadge poolStatus={poolStatus} />}
				</div>
				<div className="flex items-center gap-2">
					<motion.button
						whileTap={{ scale: 0.9 }}
						onClick={(e) => {
							e.stopPropagation();
							triggerHaptic('light');
							onDetectProperNouns();
						}}
						className="w-7.5 h-7.5 rounded-lg transition-colors border bg-white/5 border-blue-500/20 text-on-surface-variant hover:text-on-surface hover:bg-white/10 flex items-center justify-center cursor-pointer"
						title="Phát hiện xưng hô / danh từ riêng"
						aria-label="Phát hiện xưng hô / danh từ riêng"
					>
						<UserCheck size={14} />
					</motion.button>

					<motion.button
						whileTap={{ scale: 0.9 }}
						onClick={(e) => {
							e.stopPropagation();
							triggerHaptic('light');
							onTranslateChineseTitles();
						}}
						className="w-7.5 h-7.5 rounded-lg transition-colors border bg-white/5 border-blue-500/20 text-on-surface-variant hover:text-on-surface hover:bg-white/10 flex items-center justify-center cursor-pointer"
						title="Dịch tiêu đề tiếng Trung"
						aria-label="Dịch tiêu đề tiếng Trung"
					>
						<Heading size={14} />
					</motion.button>
					{showConfig ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
				</div>
			</div>

			{showConfig && <AIConfigDropdown options={options} setOptions={setOptions} setPoolStatus={setPoolStatus} />}
		</div>
	);
}

function CurrentTabContent({ currentChapterName, currentBookName }: { currentChapterName?: string; currentBookName?: string }) {
	const title = currentChapterName ? currentChapterName : 'Chưa chọn chương';
	return (
		<div className="flex-1 flex flex-col items-center justify-center text-center py-6 h-full my-auto">
			<p className="text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Chương đang mở</p>
			<h3 className="font-serif text-lg sm:text-xl font-bold text-primary leading-snug">{title}</h3>
			<p className="text-xs sm:text-sm text-on-surface-variant mt-2 font-medium">{currentBookName}</p>
		</div>
	);
}

interface TranslationSheetActionButtonsProps {
	isSubmitting: boolean;
	submittingType: 'sync' | 'async' | null;
	syncButtonLabel: string;
	asyncButtonLabel: string;
	onSubmit: (sync: boolean) => void;
}

function TranslationSheetActionButtons({
	isSubmitting,
	submittingType,
	syncButtonLabel,
	asyncButtonLabel,
	onSubmit,
}: TranslationSheetActionButtonsProps) {
	const isSyncSubmitting = isSubmitting && submittingType === 'sync';
	const isAsyncSubmitting = isSubmitting && submittingType === 'async';

	return (
		<div className="flex-shrink-0 p-3 sm:p-4 border-t border-outline-variant/20 bg-white/[0.03] dark:bg-white/[0.03] backdrop-blur-md pb-safe">
			<div className="flex items-center gap-2 sm:gap-3">
				<button
					onClick={() => onSubmit(true)}
					disabled={isSubmitting}
					className="flex-1 py-3 sm:py-3.5 bg-primary/25 hover:bg-primary/35 backdrop-blur-md border-2 border-primary/70 text-primary rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold font-sans flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{isSyncSubmitting ? (
						<Loader size={16} className="animate-spin sm:w-4 sm:h-4 text-primary" />
					) : (
						<Zap size={16} className="fill-primary text-primary sm:w-4 sm:h-4" />
					)}
					<span>{syncButtonLabel}</span>
				</button>

				<button
					onClick={() => onSubmit(false)}
					disabled={isSubmitting}
					className="flex-1 py-3 sm:py-3.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border-2 border-outline-variant/60 text-on-surface rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold font-sans flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{isAsyncSubmitting ? (
						<Loader size={16} className="animate-spin sm:w-4 sm:h-4 text-on-surface" />
					) : (
						<Send size={16} className="sm:w-4 sm:h-4 text-on-surface-variant" />
					)}
					<span>{asyncButtonLabel}</span>
				</button>
			</div>
		</div>
	);
}

function getContainerScroll(container: HTMLDivElement | null) {
	if (!container) return { prevHeight: 0, prevTop: 0 };
	return { prevHeight: container.scrollHeight, prevTop: container.scrollTop };
}

function updatePrependState(
	newChapters: Chapter[],
	container: HTMLDivElement | null,
	scroll: { prevHeight: number; prevTop: number },
	pendingPrependScrollRef: React.MutableRefObject<{ prevHeight: number; prevTop: number } | null>,
	setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>,
	setMinChapterNum: React.Dispatch<React.SetStateAction<number>>,
	setHasMoreTop: React.Dispatch<React.SetStateAction<boolean>>
) {
	if (newChapters.length === 0) {
		setHasMoreTop(false);
		return;
	}
	if (container) {
		pendingPrependScrollRef.current = scroll;
	}
	setChapters((prev) => mergePrependedChapters(prev, newChapters));
	const newMin = Math.min(...newChapters.map((c) => c.chapterNumber));
	setMinChapterNum(newMin);
	setHasMoreTop(newMin > 1);
}

export function TranslationSheet(props: TranslationSheetProps) {
	const {
		onClose,
		currentBookName,
		currentChapterName,
		currentBookId,
		currentChapterId,
		currentChapterNumber,
		initialTab,
		initialSelectedChapters,
		onSuccess,
		disableCurrent,
	} = resolveTranslationSheetProps(props);

	const showToast = useToastStore((state) => state.showToast);
	const [activeTab, setActiveTab] = useState<Tab>(initialTab);
	const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
	const [isOptionsLoaded, setIsOptionsLoaded] = useState(false);
	const [showConfig, setShowConfig] = useState(false);
	const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
	const [showOnlyPending, setShowOnlyPending] = useState(false);

	const [chapters, setChapters] = useState<Chapter[]>([]);
	const [books, setBooks] = useState<Book[]>([]);
	const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set(initialSelectedChapters));
	const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
	const [searchBook, setSearchBook] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submittingType, setSubmittingType] = useState<'sync' | 'async' | null>(null);
	const isSubmittingRef = useRef(false);

	const getTargetBookId = (): string | undefined => {
		if (activeTab === 'story' && selectedBooks.size > 0) {
			const firstBook = Array.from(selectedBooks)[0];
			return typeof firstBook === 'string' ? firstBook : undefined;
		}
		return currentBookId;
	};

	const handleDetectProperNouns = () => {
		const targetBookId = getTargetBookId();
		if (!targetBookId) {
			showToast('Vui lòng chọn truyện trước khi thực hiện', 'error');
			return;
		}
		showToast('Đã gửi yêu cầu xử lý', 'success');
		AIRepository.detectProperNouns({
			bookId: targetBookId,
			model: options.model,
		}).catch((e: unknown) => {
			console.warn('detectProperNouns bg error:', e);
		});
	};

	const handleTranslateChineseTitles = () => {
		const targetBookId = getTargetBookId();
		if (!targetBookId) {
			showToast('Vui lòng chọn truyện trước khi thực hiện', 'error');
			return;
		}
		showToast('Đã gửi yêu cầu xử lý', 'success');
		AIRepository.translateChineseTitles({
			bookId: targetBookId,
			model: options.model,
			platform: options.platform,
		}).catch((e: unknown) => {
			console.warn('translateChineseTitles bg error:', e);
		});
	};

	const [rangeStart, setRangeStart] = useState('');
	const [rangeEnd, setRangeEnd] = useState('');
	const chapterListRef = useRef<HTMLDivElement>(null);
	const activeItemRef = useRef<HTMLDivElement>(null);
	const isInitialScrollDoneRef = useRef(false);

	const configChapterLimit = useReaderConfigStore((state) => state.chapterLimit || 50);
	const [loading, setLoading] = useState(false);
	const [loadingTop, setLoadingTop] = useState(false);
	const [loadingBottom, setLoadingBottom] = useState(false);
	const [hasMoreTop, setHasMoreTop] = useState(false);
	const [hasMoreBottom, setHasMoreBottom] = useState(true);
	const [minChapterNum, setMinChapterNum] = useState<number>(1);
	const [maxChapterNum, setMaxChapterNum] = useState<number>(1);

	// Load configs from API
	const [quotas, setQuotas] = useState<AIQuota[]>([]);

	useEffect(() => {
		let active = true;
		if (options.model && isOptionsLoaded) {
			const platform = options.platform || 'AI_STUDIO';
			ChapterRepository.getPoolStatus(options.model, platform)
				.then((res) => {
					if (active && res) {
						setPoolStatus(res as PoolStatus);
					}
				})
				.catch((err) => {
					console.warn('Failed to fetch pool status:', err);
				});
		}
		return () => {
			active = false;
		};
	}, [options.model, options.platform, activeTab, isOptionsLoaded, quotas]);

	useEffect(() => {
		let active = true;

		// Load saved translate options from settings (force fresh fetch)
		SettingsRepository.getSettings<{ value?: unknown }>('stories.ui.translate', true)
			.then((savedSettings) => {
				if (!active || !savedSettings?.value) return;
				try {
					const settingVal = savedSettings.value;
					const parsed = typeof settingVal === 'string' ? JSON.parse(settingVal) : settingVal;
					if (parsed && typeof parsed === 'object') {
						const opts = parsed as Record<string, unknown>;
						if (opts.platform === 'VERTEX_API') opts.platform = 'AI_STUDIO';
						setOptions((prev) => ({ ...prev, ...opts }));
					}
				} catch (err) {
					console.warn('[TranslationSheet] Parse saved settings error:', err);
				}
			})
			.catch(() => {});

		AIRepository.getQuotas()
			.then((res) => {
				if (!active) return;
				const rawQuotas = extractRawQuotas(res);
				setQuotas(rawQuotas as AIQuota[]);

				const cfg = extractConfig(res);
				if (cfg) {
					setOptions((prev) => {
						const newOptions = { ...prev, ...cfg };
						const uniqueModels = extractUniqueModels(rawQuotas);
						if (uniqueModels.length > 0) {
							newOptions.availableModels = uniqueModels;
						}
						return newOptions;
					});
				}
				setIsOptionsLoaded(true);
			})
			.catch((err) => {
				console.warn('AIRepository.getQuotas error, repairing database setting:', err);
				SettingsRepository.updateSettings('stories.ui.translate', defaultOptions)
					.then(() => AIRepository.getQuotas())
					.then((res) => {
						if (active && res) {
							const rawQuotas = extractRawQuotas(res);
							setQuotas(rawQuotas as AIQuota[]);
						}
					})
					.catch(() => {})
					.finally(() => {
						if (active) setIsOptionsLoaded(true);
					});
			});

		return () => {
			active = false;
		};
	}, []);

	// Save configs to API
	const initialMount = useRef(true);
	useEffect(() => {
		if (isOptionsLoaded) {
			if (initialMount.current) {
				initialMount.current = false;
				return;
			}
			const t = setTimeout(() => {
				const payload = {
					model: options.model,
					platform: options.platform || 'AI_STUDIO',
					minWords: options.minWords,
					maxWords: options.maxWords,
					temperature: options.temperature,
					forceRetranslate: options.forceRetranslate,
					batchingGroup: options.batchingGroup,
					availableModels: options.availableModels,
				};
				SettingsRepository.updateSettings('stories.ui.translate', payload).catch(() => {});
			}, 500);
			return () => clearTimeout(t);
		}
	}, [options, isOptionsLoaded, quotas]);

	const loadInitialChapters = React.useCallback(async () => {
		if (activeTab !== 'batch_chapter' || !currentBookId) return;
		setLoading(true);
		isInitialScrollDoneRef.current = false;

		const startChapterNumber = currentChapterNumber ? Math.max(1, currentChapterNumber - 5) : 1;
		const endChapterNumber = currentChapterNumber ? currentChapterNumber + configChapterLimit : undefined;

		try {
			const res = await ChapterRepository.getChapters(
				currentBookId,
				1,
				configChapterLimit,
				'chapterNumber',
				'ASC',
				'all',
				'',
				startChapterNumber,
				endChapterNumber
			);

			const newChapters = res?.chapters || [];
			setChapters(newChapters);

			if (newChapters.length > 0) {
				const minNum = Math.min(...newChapters.map((c) => c.chapterNumber));
				const maxNum = Math.max(...newChapters.map((c) => c.chapterNumber));
				setMinChapterNum(minNum);
				setMaxChapterNum(maxNum);
				setHasMoreTop(minNum > 1);
				setHasMoreBottom(newChapters.length >= configChapterLimit);
			} else {
				setHasMoreTop(false);
				setHasMoreBottom(false);
			}
		} catch {
			setChapters([]);
		} finally {
			setLoading(false);
		}
	}, [activeTab, currentBookId, currentChapterNumber, configChapterLimit]);

	useEffect(() => {
		let t: NodeJS.Timeout;
		if (activeTab === 'batch_chapter' && currentBookId) {
			loadInitialChapters();
		} else if (activeTab === 'story') {
			const fetchStoryBooks = () => {
				BookRepository.getBooks(1, 9999, searchBook)
					.then((res) => {
						const list = res?.books ?? [];
						setBooks(list);
					})
					.catch((err) => {
						console.warn('Failed to fetch books for translation:', err);
						setBooks([]);
					});
			};

			if (searchBook) {
				t = setTimeout(fetchStoryBooks, 300);
			} else {
				fetchStoryBooks();
			}
		}
		return () => clearTimeout(t);
	}, [activeTab, currentBookId, searchBook, loadInitialChapters]);

	const pendingPrependScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);

	const scrollToActive = React.useCallback(() => {
		if (activeItemRef.current && chapterListRef.current) {
			const container = chapterListRef.current;
			const activeEl = activeItemRef.current;
			const containerRect = container.getBoundingClientRect();
			const activeRect = activeEl.getBoundingClientRect();
			const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top);
			container.scrollTop = Math.max(0, targetScrollTop);
		}
	}, []);

	// Synchronous scroll compensation after prepending items to top (Runs BEFORE browser paint)
	React.useLayoutEffect(() => {
		if (pendingPrependScrollRef.current && chapterListRef.current) {
			const { prevHeight, prevTop } = pendingPrependScrollRef.current;
			pendingPrependScrollRef.current = null;
			const newHeight = chapterListRef.current.scrollHeight;
			chapterListRef.current.scrollTop = prevTop + (newHeight - prevHeight);
		}
	}, [chapters]);

	React.useLayoutEffect(() => {
		if (activeTab === 'batch_chapter' && !loading && chapters.length > 0 && !isInitialScrollDoneRef.current) {
			isInitialScrollDoneRef.current = true;
			scrollToActive();
			requestAnimationFrame(() => {
				scrollToActive();
				setTimeout(scrollToActive, 50);
				setTimeout(scrollToActive, 150);
			});
		}
	}, [activeTab, loading, chapters, scrollToActive]);

	const fetchPrevTopPage = async () => {
		if (shouldSkipFetchPrevTop(loadingTop, hasMoreTop, minChapterNum, currentBookId, isInitialScrollDoneRef.current)) {
			return;
		}
		setLoadingTop(true);

		const container = chapterListRef.current;
		const scroll = getContainerScroll(container);
		const targetToChapter = minChapterNum - 1;
		const targetFromChapter = Math.max(1, minChapterNum - configChapterLimit);

		try {
			const res = await ChapterRepository.getChapters(
				currentBookId,
				1,
				configChapterLimit,
				'chapterNumber',
				'ASC',
				'all',
				'',
				targetFromChapter,
				targetToChapter
			);

			const newChapters = res?.chapters ?? [];
			updatePrependState(newChapters, container, scroll, pendingPrependScrollRef, setChapters, setMinChapterNum, setHasMoreTop);
		} catch {
			// Ignore
		} finally {
			setLoadingTop(false);
		}
	};

	const fetchPrevTopPageRef = useRef<() => void>(() => {});
	fetchPrevTopPageRef.current = fetchPrevTopPage;

	// Auto-backfill previous chapters if initial viewport has extra space and hasMoreTop is true
	useEffect(() => {
		if (
			activeTab === 'batch_chapter' &&
			!loading &&
			!loadingTop &&
			hasMoreTop &&
			isInitialScrollDoneRef.current &&
			chapterListRef.current
		) {
			const { scrollHeight, clientHeight } = chapterListRef.current;
			if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
				fetchPrevTopPageRef.current();
			}
		}
	}, [activeTab, loading, loadingTop, hasMoreTop, chapters.length]);

	const fetchNextBottomPage = async () => {
		if (loadingBottom || !hasMoreBottom || !currentBookId || !isInitialScrollDoneRef.current) return;
		setLoadingBottom(true);
		const targetFromChapter = maxChapterNum + 1;

		try {
			const res = await ChapterRepository.getChapters(
				currentBookId,
				1,
				configChapterLimit,
				'chapterNumber',
				'ASC',
				'all',
				'',
				targetFromChapter
			);

			const newChapters = res?.chapters || [];
			if (newChapters.length > 0) {
				setChapters((prev) => {
					const existingIds = new Set(prev.map((c) => c.chapterId));
					const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
					return [...prev, ...uniqueNew];
				});
				const newMax = Math.max(...newChapters.map((c) => c.chapterNumber));
				setMaxChapterNum(newMax);
				setHasMoreBottom(newChapters.length >= configChapterLimit);
			} else {
				setHasMoreBottom(false);
			}
		} catch {
			// Ignore
		} finally {
			setLoadingBottom(false);
		}
	};

	const handleScroll = () => {
		if (!chapterListRef.current || loading || activeTab !== 'batch_chapter' || !isInitialScrollDoneRef.current) return;
		const { scrollTop, clientHeight, scrollHeight } = chapterListRef.current;

		if (scrollTop + clientHeight >= scrollHeight - 300) {
			fetchNextBottomPage();
		}
		if (scrollTop <= 80) {
			fetchPrevTopPage();
		}
	};

	const handleSubmit = async (isSync = false) => {
		if (isSubmittingRef.current) return;
		isSubmittingRef.current = true;
		setIsSubmitting(true);
		setSubmittingType(isSync ? 'sync' : 'async');

		const chapterIdToUse = initialSelectedChapters[0] || currentChapterId;
		const validationError = validateSubmitParams(activeTab, chapterIdToUse, selectedChapters.size, selectedBooks.size);
		if (validationError) {
			showToast(validationError, 'error');
			setIsSubmitting(false);
			isSubmittingRef.current = false;
			setSubmittingType(null);
			return;
		}

		const platform = options.platform || 'VERTEX_API';

		try {
			if (isSync) {
				await executeSyncTranslate(
					activeTab,
					options,
					platform,
					currentBookId,
					chapterIdToUse,
					selectedChapters,
					selectedBooks,
					showToast,
					onClose,
					onSuccess
				);
			} else {
				const payload = buildAsyncTranslatePayload(
					activeTab,
					options,
					platform,
					currentBookId,
					chapterIdToUse,
					selectedChapters,
					selectedBooks,
					initialSelectedChapters
				);
				await executeAsyncTranslate(activeTab, payload, showToast, onClose, selectedChapters.size, selectedBooks.size);
			}
		} catch (e: unknown) {
			console.error(e);
			const msg = e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại';
			showToast(msg, 'error');
		} finally {
			setIsSubmitting(false);
			isSubmittingRef.current = false;
			setSubmittingType(null);
		}
	};

	const toggleChapter = (id: string) => {
		const next = new Set(selectedChapters);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedChapters(next);
	};

	const handleSelectRange = async () => {
		const range = parseRangeInputs(rangeStart, rangeEnd);
		if (!range) {
			showToast('Phạm vi không hợp lệ', 'error');
			return;
		}
		const { start, end } = range;
		if (!currentBookId) return;

		try {
			const limit = Math.max(50, end - start + 1);
			const res = await ChapterRepository.getChapters(currentBookId, 1, limit, 'chapterNumber', 'ASC', 'all', '', start, end);
			const fetchedChapters = res?.chapters || [];

			let allChapters: Chapter[] = [];
			setChapters((prev) => {
				const existingIds = new Set(prev.map((c) => c.chapterId));
				const uniqueNew = fetchedChapters.filter((c) => !existingIds.has(c.chapterId));
				const combined = [...prev, ...uniqueNew].sort((a, b) => a.chapterNumber - b.chapterNumber);
				allChapters = combined;

				if (combined.length > 0) {
					const minNum = Math.min(...combined.map((c) => c.chapterNumber));
					const maxNum = Math.max(...combined.map((c) => c.chapterNumber));
					setMinChapterNum(minNum);
					setMaxChapterNum(maxNum);
				}
				return combined;
			});

			const pool = fetchedChapters.length > 0 ? fetchedChapters : allChapters;
			const chaptersInRange = pool.filter((c) => c.chapterNumber >= start && c.chapterNumber <= end);

			if (chaptersInRange.length === 0) {
				showToast('Không tìm thấy chương nào trong phạm vi này', 'error');
				return;
			}

			setSelectedChapters((prev) => {
				const newSet = new Set(prev);
				chaptersInRange.forEach((c) => newSet.add(c.chapterId));
				return newSet;
			});

			showToast(`Đã chọn ${chaptersInRange.length} chương (Chương ${start} - ${end})`, 'success');
			setTimeout(() => scrollToChapterElement(chapterListRef.current, start), 100);
		} catch {
			showToast('Có lỗi xảy ra khi tải dải chương', 'error');
		}
	};

	const handleSelectAll = async () => {
		if (!currentBookId) return;
		setShowOnlyPending(false);
		if (!hasMoreTop && !hasMoreBottom && chapters.length > 0) {
			setSelectedChapters(new Set(chapters.map((c) => c.chapterId)));
			showToast(`Đã chọn tất cả ${chapters.length} chương`, 'success');
			return;
		}

		setIsSubmitting(true);
		showToast('Đang tải tất cả chương...', 'info');
		try {
			const res = await ChapterRepository.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC', 'all');
			const allList = res?.chapters || [];
			if (allList.length > 0) {
				setChapters(allList);
				setSelectedChapters(new Set(allList.map((c) => c.chapterId)));
				const minNum = Math.min(...allList.map((c) => c.chapterNumber));
				const maxNum = Math.max(...allList.map((c) => c.chapterNumber));
				setMinChapterNum(minNum);
				setMaxChapterNum(maxNum);
				setHasMoreTop(false);
				setHasMoreBottom(false);
				showToast(`Đã chọn tất cả ${allList.length} chương`, 'success');
			}
		} catch {
			showToast('Có lỗi xảy ra khi tải danh sách chương', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSelectPending = async () => {
		if (!currentBookId) return;
		setShowOnlyPending(true);
		if (!hasMoreTop && !hasMoreBottom && chapters.length > 0) {
			const pendingList = chapters.filter((c) => c.state === 'PENDING' || c.state === 'FAILED');
			setSelectedChapters(new Set(pendingList.map((c) => c.chapterId)));
			showToast(`Đã chọn ${pendingList.length} chương chưa dịch`, 'success');
			return;
		}

		setIsSubmitting(true);
		showToast('Đang tải chương chưa dịch...', 'info');
		try {
			const res = await ChapterRepository.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC', 'all');
			const allList = res?.chapters || [];
			if (allList.length > 0) {
				setChapters(allList);
				const pendingList = allList.filter((c) => c.state === 'PENDING' || c.state === 'FAILED');
				setSelectedChapters(new Set(pendingList.map((c) => c.chapterId)));
				const minNum = Math.min(...allList.map((c) => c.chapterNumber));
				const maxNum = Math.max(...allList.map((c) => c.chapterNumber));
				setMinChapterNum(minNum);
				setMaxChapterNum(maxNum);
				setHasMoreTop(false);
				setHasMoreBottom(false);
				showToast(`Đã chọn ${pendingList.length} chương chưa dịch`, 'success');
			}
		} catch {
			showToast('Có lỗi xảy ra khi tải danh sách chương', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const toggleBook = (id: string) => {
		const next = new Set(selectedBooks);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedBooks(next);
	};

	const syncButtonLabel = getSyncButtonLabel(isSubmitting, submittingType, activeTab, selectedChapters.size, selectedBooks.size);
	const asyncButtonLabel = getAsyncButtonLabel(isSubmitting, submittingType, activeTab, selectedChapters.size, selectedBooks.size);

	return (
		<BottomSheet
			isOpen={true}
			onClose={onClose}
			ariaLabel="Mở Dịch AI"
			maxHeight="h-[78vh] min-h-[520px] max-h-[85dvh]"
			showDragHandle={false}
		>
			{/* Drag Handle & Header */}
			<div className="flex-shrink-0 pt-2 px-3 pb-2 border-b border-white/10 bg-transparent relative z-20">
				<div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />
				<div className="flex items-center justify-between gap-2">
					<div className="flex bg-white/10 p-0.5 rounded-lg border border-white/15 flex-1 gap-0.5">
						<TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')} disabled={disableCurrent}>
							Hiện tại
						</TabButton>
						<TabButton active={activeTab === 'batch_chapter'} onClick={() => setActiveTab('batch_chapter')}>
							Nhiều chương
						</TabButton>
						<TabButton active={activeTab === 'story'} onClick={() => setActiveTab('story')}>
							Truyện
						</TabButton>
					</div>
					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onClose();
						}}
						className="w-8.5 h-8.5 bg-white/10 border border-white/20 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer shrink-0"
						title="Đóng"
						aria-label="Đóng"
					>
						<X size={16} />
					</motion.button>
				</div>
			</div>

			{/* Global Config (Stuck below header) */}
			<TranslationSheetConfigBar
				showConfig={showConfig}
				onToggleConfig={() => setShowConfig(!showConfig)}
				poolStatus={poolStatus}
				currentModel={options.model}
				onDetectProperNouns={handleDetectProperNouns}
				onTranslateChineseTitles={handleTranslateChineseTitles}
				options={options}
				setOptions={setOptions}
				setPoolStatus={setPoolStatus}
			/>

			{/* Scrollable Dynamic Content */}
			<div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-5 flex flex-col min-h-0">
				{activeTab === 'current' && <CurrentTabContent currentChapterName={currentChapterName} currentBookName={currentBookName} />}

				{activeTab === 'batch_chapter' && (
					<div className="flex-1 flex flex-col min-h-0">
						<ChapterBatchControls
							selectedCount={selectedChapters.size}
							chaptersCount={chapters.length}
							onClearSelection={() => setSelectedChapters(new Set())}
							showOnlyPending={showOnlyPending}
							onTogglePending={setShowOnlyPending}
							rangeStart={rangeStart}
							setRangeStart={setRangeStart}
							rangeEnd={rangeEnd}
							setRangeEnd={setRangeEnd}
							onSelectRange={handleSelectRange}
							onSelectAll={handleSelectAll}
							onSelectPending={handleSelectPending}
						/>
						<BatchChapterList
							chapters={chapters}
							showOnlyPending={showOnlyPending}
							selectedChapters={selectedChapters}
							currentChapterId={currentChapterId}
							currentChapterNumber={currentChapterNumber}
							initialSelectedChapters={initialSelectedChapters}
							chapterListRef={chapterListRef}
							activeItemRef={activeItemRef}
							onScroll={handleScroll}
							onToggleChapter={toggleChapter}
						/>
					</div>
				)}

				{activeTab === 'story' && (
					<StoryTabContent
						books={books}
						searchBook={searchBook}
						onSearchChange={setSearchBook}
						selectedBooks={selectedBooks}
						onToggleBook={toggleBook}
					/>
				)}
			</div>

			{/* Action Buttons: Sync & Async */}
			<TranslationSheetActionButtons
				isSubmitting={isSubmitting}
				submittingType={submittingType}
				syncButtonLabel={syncButtonLabel}
				asyncButtonLabel={asyncButtonLabel}
				onSubmit={handleSubmit}
			/>
		</BottomSheet>
	);
}
