import { BookOpen, Clock, Sparkles, Library, X, RotateCcw, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { BookCard } from './BookCard';
import { LibraryHeader } from './LibraryHeader';

import type { LibraryTab } from '../hooks/useLibraryScrollAndSwipe';
import type { Book } from '@/shared/types';
import type { LucideIcon } from 'lucide-react';

interface TabItemConfig {
	id: LibraryTab;
	label: string;
	title: string;
	Icon: LucideIcon;
	activeText: string;
	activePill: string;
}

const TAB_ITEMS: TabItemConfig[] = [
	{
		id: 'ALL',
		label: 'Tất cả',
		title: 'Tất cả truyện',
		Icon: Library,
		activeText: 'text-primary font-bold',
		activePill: 'bg-gradient-to-b from-primary/30 to-primary/10 border-primary/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	{
		id: 'HISTORY',
		label: 'Lịch sử',
		title: 'Lịch sử đọc',
		Icon: Clock,
		activeText: 'text-primary font-bold',
		activePill: 'bg-gradient-to-b from-primary/30 to-primary/10 border-primary/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	{
		id: 'FAVORITE',
		label: 'Yêu thích',
		title: 'Truyện yêu thích',
		Icon: Heart,
		activeText: 'text-rose-400 font-bold',
		activePill: 'bg-gradient-to-b from-rose-500/30 to-rose-500/10 border-rose-500/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	{
		id: 'AI',
		label: 'Dịch AI',
		title: 'Truyện dịch AI',
		Icon: Sparkles,
		activeText: 'text-emerald-400 font-bold',
		activePill:
			'bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-400/50 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
];

function getTabIconClass(tId: LibraryTab, isActive: boolean, activeText: string): string {
	if (tId === 'FAVORITE' && isActive) return 'fill-rose-500 text-rose-500';
	if (isActive) return activeText;
	return 'text-on-surface-variant/60';
}

export function LibraryTabsNav({
	currentTab,
	total,
	onTabChange,
}: {
	currentTab: LibraryTab;
	total: number;
	onTabChange: (tab: LibraryTab) => void;
}) {
	return (
		<div className="px-3.5 py-2 border-t border-white/10 dark:border-white/5 bg-transparent">
			<div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.04] dark:bg-white/[0.04] border border-white/10 dark:border-white/10 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] box-border">
				{TAB_ITEMS.map((t) => {
					const isActive = currentTab === t.id;
					return (
						<motion.button
							key={t.id}
							whileTap={{ scale: 0.95 }}
							onClick={() => onTabChange(t.id)}
							title={t.title}
							className={`relative h-9 flex items-center justify-center gap-1.5 rounded-full transition-colors duration-200 cursor-pointer ${
								isActive ? `${t.activeText} font-bold` : 'text-on-surface-variant/75 hover:text-on-surface'
							}`}
						>
							{isActive && (
								<motion.div
									layoutId="active-tab-glass-pill"
									transition={{
										type: 'spring',
										stiffness: 340,
										damping: 30,
									}}
									className={`absolute inset-0 rounded-full border ${t.activePill}`}
								/>
							)}
							<t.Icon size={13.5} className={`shrink-0 relative z-10 ${getTabIconClass(t.id, isActive, t.activeText)}`} />
							<span className="text-xs tracking-tight font-bold relative z-10 whitespace-nowrap flex items-center">
								{t.label}
								{isActive && total > 0 && (
									<sup className="text-[9px] font-mono font-semibold ml-0.5 -top-1 opacity-80 leading-none">{total}</sup>
								)}
							</span>
						</motion.button>
					);
				})}
			</div>
		</div>
	);
}

function getEmptyMessage(selectedTags: string[], tab: LibraryTab): string {
	if (selectedTags.length > 0) return 'Không tìm thấy truyện nào phù hợp với bộ lọc tags';
	if (tab === 'HISTORY') return 'Chưa có lịch sử đọc truyện nào';
	if (tab === 'FAVORITE') return 'Chưa có truyện nào trong danh sách yêu thích';
	if (tab === 'AI') return 'Không có truyện nào đang chờ dịch AI';
	return 'Không tìm thấy truyện nào trong thư viện';
}

function LibraryBookListSkeleton() {
	return (
		<div className="space-y-3 relative">
			{[1, 2, 3, 4].map((idx) => (
				<div
					key={idx}
					className="h-28 rounded-2xl bg-white/[0.03] border border-outline-variant/30 animate-pulse p-3 flex gap-3 opacity-60"
				>
					<div className="w-16 h-20 bg-on-surface-variant/20 rounded-xl shrink-0" />
					<div className="flex-1 space-y-2 py-1">
						<div className="h-4 w-3/4 bg-on-surface-variant/20 rounded" />
						<div className="h-3 w-1/2 bg-on-surface-variant/20 rounded" />
						<div className="h-3 w-1/4 bg-primary/20 rounded pt-2" />
					</div>
				</div>
			))}
		</div>
	);
}

function LibraryEmptyState({
	tab,
	selectedTags,
	onClearTags,
	onOpenServerSettings,
}: {
	tab: LibraryTab;
	selectedTags: string[];
	onClearTags: () => void;
	onOpenServerSettings: () => void;
}) {
	const emptyMessage = getEmptyMessage(selectedTags, tab);
	return (
		<div className="text-center py-16 space-y-3">
			<div className="w-12 h-12 rounded-full bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
				{tab === 'FAVORITE' ? <Heart size={20} className="text-rose-500" /> : <BookOpen size={20} />}
			</div>
			<p className="text-xs font-medium text-on-surface-variant/60">{emptyMessage}</p>
			{selectedTags.length > 0 ? (
				<button onClick={onClearTags} className="text-xs font-bold text-primary hover:underline">
					Xóa bộ lọc tags
				</button>
			) : (
				<button
					onClick={onOpenServerSettings}
					className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all active:scale-95 cursor-pointer mt-1"
				>
					<span>Cấu hình Máy chủ</span>
				</button>
			)}
		</div>
	);
}

export function LibraryBookList({
	loading,
	books,
	tab,
	selectedTags,
	onClearTags,
	onOpenServerSettings,
}: {
	loading: boolean;
	books: Book[];
	tab: LibraryTab;
	selectedTags: string[];
	onClearTags: () => void;
	onOpenServerSettings: () => void;
}) {
	if (loading && books.length === 0) {
		return <LibraryBookListSkeleton />;
	}
	if (books.length === 0 && !loading) {
		return (
			<LibraryEmptyState tab={tab} selectedTags={selectedTags} onClearTags={onClearTags} onOpenServerSettings={onOpenServerSettings} />
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{books.map((book) => (
				<BookCard key={book.bookId} book={book} activeTab={tab} />
			))}
		</div>
	);
}

export function LibraryTagBadges({
	selectedTags,
	onClearAll,
	onRemoveTag,
}: {
	selectedTags: string[];
	onClearAll: () => void;
	onRemoveTag: (tag: string) => void;
}) {
	if (selectedTags.length === 0) return null;
	return (
		<div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border-b border-primary/20 overflow-x-auto hide-scrollbar">
			<button
				onClick={onClearAll}
				className="text-[10.5px] font-bold text-error hover:underline shrink-0 flex items-center gap-1 mr-0.5 px-1.5 py-0.5 rounded-md hover:bg-error/10 active:scale-95 transition-all"
				title="Xóa tất cả tags đang lọc"
			>
				<RotateCcw size={11} />
				<span>Xóa lọc</span>
			</button>
			{selectedTags.map((tag) => (
				<span
					key={tag}
					className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-on-primary shrink-0 shadow-xs"
				>
					<span>#{tag}</span>
					<button onClick={() => onRemoveTag(tag)} className="hover:opacity-80 active:scale-90" title={`Bỏ tag ${tag}`}>
						<X size={11} />
					</button>
				</span>
			))}
		</div>
	);
}

export function LibraryStickyHeaderSection({
	isHeaderCollapsed,
	headerCollapseOffset,
	headerContentRef,
	search,
	onSearchChange,
	onSubmitSearch,
	onOpenSettings,
	onOpenTagFilter,
	selectedTags,
	onOpenSort,
	isCustomSortActive,
	onClearAllTags,
	onRemoveTag,
	tab,
	total,
	onTabChange,
}: {
	isHeaderCollapsed: boolean;
	headerCollapseOffset: number;
	headerContentRef: React.RefObject<HTMLDivElement | null>;
	search: string;
	onSearchChange: (val: string) => void;
	onSubmitSearch: () => void;
	onOpenSettings: () => void;
	onOpenTagFilter: () => void;
	selectedTags: string[];
	onOpenSort?: () => void;
	isCustomSortActive: boolean;
	onClearAllTags: () => void;
	onRemoveTag: (tag: string) => void;
	tab: LibraryTab;
	total: number;
	onTabChange: (tab: LibraryTab) => void;
}) {
	const collapsedState = isHeaderCollapsed ? 'true' : 'false';
	const stickyTop = isHeaderCollapsed ? -headerCollapseOffset : 0;
	const headerOpacityClass = isHeaderCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100';

	return (
		<div
			data-header-collapsed={collapsedState}
			style={{ top: stickyTop }}
			className="sticky top-0 z-30 bg-background/95 dark:bg-background/95 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_4px_20px_rgba(0,0,0,0.22)] transition-[top,box-shadow] duration-250 ease-out"
		>
			<div ref={headerContentRef} className={`transition-opacity duration-200 ${headerOpacityClass}`}>
				<LibraryHeader
					searchQuery={search}
					onSearchChange={onSearchChange}
					onSubmitSearch={onSubmitSearch}
					onOpenSettings={onOpenSettings}
					onOpenTagFilter={onOpenTagFilter}
					activeTagsCount={selectedTags.length}
					onOpenSort={onOpenSort}
					isCustomSortActive={isCustomSortActive}
				/>
			</div>

			<LibraryTagBadges selectedTags={selectedTags} onClearAll={onClearAllTags} onRemoveTag={onRemoveTag} />

			<LibraryTabsNav currentTab={tab} total={total} onTabChange={onTabChange} />
		</div>
	);
}
