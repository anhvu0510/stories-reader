import { ArrowRight, Sparkles, Clock, AlertCircle, Calendar } from 'lucide-react';
import React, { forwardRef } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';
import { openChapter } from '@/shared/utils/openChapter';

import type { Chapter } from '@/shared/types';

export interface ChapterItemProps {
	chapter: Chapter;
	bookId?: string;
	isActive?: boolean;
	onClick?: () => void;
	showStatus?: boolean;
}

const formatDate = (dateStr?: string) => {
	if (!dateStr) return '';
	try {
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return dateStr;
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}-${month}-${year}`;
	} catch {
		return dateStr;
	}
};

const pick = (active: boolean, activeValue: string, inactiveValue: string) => (active ? activeValue : inactiveValue);

const STATUS_BADGES: Record<string, { title: string; icon: React.ReactNode; base: string; active: string; inactive: string }> = {
	SUCCEEDED: {
		title: 'Đã dịch AI',
		icon: <Sparkles size={12} />,
		base: 'w-6 h-6 rounded-full flex items-center justify-center shadow-2xs',
		active: 'bg-emerald-400/25 border border-emerald-400/50 text-emerald-300 font-bold',
		inactive: 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	PENDING: {
		title: 'Chờ dịch',
		icon: <Clock size={12} />,
		base: 'w-6 h-6 rounded-full flex items-center justify-center',
		active: 'bg-primary/25 border border-primary/50 text-primary font-bold',
		inactive: 'bg-primary/15 border border-primary/30 text-primary shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
	FAILED: {
		title: 'Lỗi dịch',
		icon: <AlertCircle size={12} />,
		base: 'w-6 h-6 rounded-full flex items-center justify-center',
		active: 'bg-rose-400/25 border border-rose-400/50 text-rose-300 font-bold',
		inactive: 'bg-rose-500/15 border border-rose-400/30 text-rose-400 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3)]',
	},
};

const StatusBadge = ({ state, isActive }: { state?: string; isActive: boolean }) => {
	const badge = state ? STATUS_BADGES[state] : undefined;
	if (!badge) return <div />;
	return (
		<div>
			<span className={`${badge.base} ${pick(isActive, badge.active, badge.inactive)}`} title={badge.title}>
				{badge.icon}
			</span>
		</div>
	);
};

export const ChapterItem = forwardRef<HTMLDivElement, ChapterItemProps>(
	({ chapter, bookId, isActive = false, onClick, showStatus = true }, ref) => {
		const formattedDate = formatDate(chapter.updatedAt);

		const handleClick = () => {
			triggerHaptic('light');
			if (onClick) {
				onClick();
			} else if (bookId && chapter.chapterId) {
				openChapter(bookId, chapter.chapterId);
			}
		};

		return (
			<div
				ref={ref}
				onClick={handleClick}
				className={`group relative rounded-2xl transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 p-3 active:scale-[0.985] ${pick(
					isActive,
					'bg-primary/20 hover:bg-primary/25 border border-primary/50 text-primary shadow-xs',
					'bg-white/[0.04] dark:bg-white/[0.04] hover:bg-white/[0.08] dark:hover:bg-white/[0.08] border border-white/10 dark:border-white/10 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.15)] hover:border-primary/50 text-on-surface'
				)}`}
			>
				{/* Left Side: Flex Pill CH Badge (Never overflows for 4-6 digit numbers) */}
				<div
					className={`px-2.5 py-1 min-w-[40px] h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-mono text-[11px] whitespace-nowrap transition-colors ${pick(
						isActive,
						'bg-primary/30 border border-primary/70 text-primary font-extrabold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.5)]',
						'bg-primary/10 border border-primary/30 text-primary/90 font-bold'
					)}`}
				>
					<span>Ch.{chapter.chapterNumber}</span>
				</div>

				{/* Middle Content */}
				<div className="flex-1 min-w-0 space-y-0.5">
					<div className="flex items-center gap-2">
						<h4
							className={`text-xs leading-snug transition-colors break-words whitespace-normal ${pick(isActive, 'text-primary font-black tracking-tight drop-shadow-xs', 'font-bold text-on-surface group-hover:text-primary')}`}
						>
							{chapter.title || `Chương ${chapter.chapterNumber}`}
						</h4>
					</div>

					{formattedDate && (
						<div
							className={`flex items-center gap-1 text-[10px] font-mono ${pick(isActive, 'text-primary/80 font-medium', 'text-on-surface-variant/60')}`}
						>
							<Calendar size={10} className={pick(isActive, 'text-primary/70', 'text-on-surface-variant/50')} />
							<span>{formattedDate}</span>
						</div>
					)}
				</div>

				{/* Right Side: Sleek Modern Status Badge & Navigation Arrow */}
				<div className="flex items-center gap-2 flex-shrink-0">
					{showStatus && <StatusBadge state={chapter.state} isActive={isActive} />}

					<ArrowRight
						size={14}
						className={`transition-all ${pick(isActive, 'text-primary translate-x-0.5', 'text-primary/70 group-hover:text-primary group-hover:translate-x-0.5')}`}
					/>
				</div>
			</div>
		);
	}
);

ChapterItem.displayName = 'ChapterItem';
