import { ArrowLeft, Layers, Library, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import type { Tab } from '@/components/translation-sheet/translationHelpers';
import type { Book } from '@/shared/types';

interface TranslationHeaderProps {
	book: Book | null;
	activeTab: Tab;
	setActiveTab: (tab: Tab) => void;
	onBack: () => void;
	onRefresh: () => void;
	loading: boolean;
}

function computeBookStats(book: Book) {
	const totalChapters = book.chapterCount || 0;
	const totalTranslated = book.totalTranslated || 0;
	const pendingCount = book.totalPending || Math.max(0, totalChapters - totalTranslated);
	const percent = totalChapters > 0 ? Math.round((totalTranslated / totalChapters) * 100) : 0;
	return { totalChapters, totalTranslated, pendingCount, percent };
}

function HeaderTitleInfo({ book }: { book: Book | null }) {
	if (!book || !book.chapterCount) {
		return (
			<div className="min-w-0 flex-1 text-center px-1">
				<h1 className="text-sm font-extrabold text-on-surface truncate tracking-tight">{book?.bookName || 'Dịch AI'}</h1>
				<p className="text-[10px] text-on-surface-variant font-medium">Trung tâm dịch thuật tự động</p>
			</div>
		);
	}

	const { totalChapters, totalTranslated, pendingCount, percent } = computeBookStats(book);

	return (
		<div className="min-w-0 flex-1 text-center px-1">
			<h1 className="text-sm font-extrabold text-on-surface truncate tracking-tight">{book.bookName}</h1>
			<div className="flex items-center justify-center gap-1.5 text-[10px] text-on-surface-variant font-mono mt-0.5 truncate">
				<span className="text-primary font-bold">
					{totalTranslated}/{totalChapters} ({percent}%)
				</span>
				<span className="opacity-40">•</span>
				<span className="text-amber-400/90 font-medium">{pendingCount} chờ dịch</span>
			</div>
		</div>
	);
}

export function TranslationHeader({ book, activeTab, setActiveTab, onBack, onRefresh, loading }: TranslationHeaderProps) {
	return (
		<header className="sticky top-0 z-30 flex-shrink-0 bg-surface/85 backdrop-blur-xl border-b border-white/10 px-3.5 pt-3 pb-2.5 transition-colors">
			{/* Top Bar: Back button, Book Title/Progress, Refresh */}
			<div className="flex items-center justify-between gap-2.5 mb-2.5">
				<motion.button
					type="button"
					whileTap={{ scale: 0.9 }}
					onClick={onBack}
					className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-on-surface flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-xs"
					title="Quay lại"
					aria-label="Quay lại"
				>
					<ArrowLeft size={18} />
				</motion.button>

				<HeaderTitleInfo book={book} />

				<motion.button
					type="button"
					whileTap={{ scale: 0.9 }}
					onClick={onRefresh}
					disabled={loading}
					className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors shrink-0 disabled:opacity-40 shadow-xs"
					title="Làm mới danh sách"
					aria-label="Làm mới"
				>
					<RefreshCw size={15} className={loading ? 'animate-spin text-primary' : ''} />
				</motion.button>
			</div>

			{/* Tab Switcher: Nhiều chương / Toàn bộ truyện */}
			<div className="flex bg-white/5 dark:bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
				<button
					type="button"
					onClick={() => {
						triggerHaptic('selection');
						setActiveTab('batch_chapter');
					}}
					className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
						activeTab === 'batch_chapter'
							? 'bg-primary/20 text-primary border border-primary/50 shadow-xs'
							: 'text-on-surface-variant/70 hover:text-on-surface'
					}`}
				>
					<Layers size={13} />
					<span>Nhiều chương</span>
				</button>

				<button
					type="button"
					onClick={() => {
						triggerHaptic('selection');
						setActiveTab('story');
					}}
					className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
						activeTab === 'story'
							? 'bg-primary/20 text-primary border border-primary/50 shadow-xs'
							: 'text-on-surface-variant/70 hover:text-on-surface'
					}`}
				>
					<Library size={13} />
					<span>Toàn bộ truyện</span>
				</button>
			</div>
		</header>
	);
}
