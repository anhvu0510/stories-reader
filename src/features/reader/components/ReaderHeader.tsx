import { Home, Clock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHaptic } from '@/hooks/useHaptic';

interface ReaderHeaderProps {
	bookId: string;
	bookName?: string;
	chapterNumber?: number;
	chapterTitle?: string;
	progress?: number;
	isVisible?: boolean;
	isTTSActive?: boolean;
	isRefreshingLatest?: boolean;
	onToggleTTS?: () => void;
	onOpenHistory: () => void;
	onTitleClick?: () => void;
	onTitleDoubleClick?: () => void;
}

function clearTapTimer(timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
	if (timerRef.current) {
		clearTimeout(timerRef.current);
		timerRef.current = null;
	}
}

function ReaderHeaderCenterTitle({
	isRefreshingLatest,
	bookName,
	chapterTitle,
	onTitleClick,
	onTitleDoubleClick,
}: {
	isRefreshingLatest: boolean;
	bookName?: string;
	chapterTitle?: string;
	onTitleClick?: () => void;
	onTitleDoubleClick?: () => void;
}) {
	const tapCountRef = React.useRef<number>(0);
	const resetTapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	React.useEffect(() => {
		return () => {
			clearTapTimer(resetTapTimerRef);
		};
	}, []);

	const handleCenterClick = (_e?: React.SyntheticEvent) => {
		if (isRefreshingLatest) return;

		tapCountRef.current += 1;

		if (tapCountRef.current === 1) {
			triggerHaptic('light');
			onTitleClick?.();
			clearTapTimer(resetTapTimerRef);
			resetTapTimerRef.current = setTimeout(() => {
				tapCountRef.current = 0;
				resetTapTimerRef.current = null;
			}, 700);
			return;
		}

		if (tapCountRef.current >= 2) {
			tapCountRef.current = 0;
			clearTapTimer(resetTapTimerRef);
			triggerHaptic('medium');
			onTitleDoubleClick?.();
		}
	};

	const titleLabel = chapterTitle || bookName || 'Tiêu đề';
	const displayTitle = chapterTitle || bookName || undefined;

	return (
		<button
			onClick={handleCenterClick}
			disabled={isRefreshingLatest}
			className="min-w-0 flex-1 text-center px-1.5 py-0.5 rounded-lg hover:bg-white/5 active:scale-[0.98] transition-transform transition-colors cursor-pointer disabled:cursor-wait touch-manipulation select-none"
			title={displayTitle}
			aria-label={titleLabel}
		>
			<div className="flex items-center justify-center gap-1.5 pointer-events-none select-none">
				{isRefreshingLatest && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
				<p className="text-[11px] sm:text-xs font-bold text-on-surface-variant/75 truncate tracking-tight text-center">
					{bookName || 'Đang tải...'}
				</p>
			</div>
			<div className="mt-0.5 overflow-hidden w-full mx-auto max-w-[200px] sm:max-w-md md:max-w-xl pointer-events-none select-none">
				<h2 className="text-xs sm:text-sm font-extrabold text-on-surface truncate tracking-tight text-center" title={chapterTitle}>
					{chapterTitle || ''}
				</h2>
			</div>
		</button>
	);
}

export const ReaderHeader = memo(function ReaderHeader({
	bookId: _bookId,
	bookName,
	chapterNumber: _chapterNumber,
	chapterTitle,
	progress = 0,
	isVisible: _isVisible = true,
	isTTSActive: _isTTSActive = false,
	isRefreshingLatest = false,
	onToggleTTS: _onToggleTTS,
	onOpenHistory,
	onTitleClick,
	onTitleDoubleClick,
}: ReaderHeaderProps) {
	const navigate = useNavigate();
	const progressPercent = Math.min(100, Math.max(0, progress));

	return (
		<header className="fixed top-0 left-0 right-0 z-40 bg-black/5 dark:bg-black/10 backdrop-blur-[1.5px] border-b border-white/25 dark:border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1px_0_rgba(255,255,255,0.4)] px-3.5 sm:px-6 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 w-full overflow-x-hidden box-border transition-all duration-300">
			<div className="w-full max-w-4xl lg:max-w-5xl mx-auto flex items-center justify-between gap-2">
				{/* Left: Home Button (Mobile-Optimized 3D Glass Sphere) */}
				<motion.button
					whileTap={{ scale: 0.88 }}
					onClick={() => {
						triggerHaptic('light');
						navigate('/');
					}}
					className="w-9 h-9 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-white/5 dark:from-white/15 dark:via-white/5 dark:to-black/25 border border-white/35 dark:border-white/25 text-on-surface hover:text-primary hover:from-white/25 hover:to-white/10 shadow-[0_3px_8px_rgba(0,0,0,0.35),_inset_0_1px_1px_0_rgba(255,255,255,0.45),_inset_0_-1px_1px_0_rgba(0,0,0,0.35)] transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
					title="Về Thư viện"
					aria-label="Về Thư viện"
				>
					<Home size={16} strokeWidth={2.3} />
				</motion.button>

				{/* Center: Interactive Tap-to-read-aloud (single click) / Force Reload Current Chapter (double click) Title Bar */}
				<ReaderHeaderCenterTitle
					bookName={bookName}
					chapterTitle={chapterTitle}
					isRefreshingLatest={isRefreshingLatest}
					onTitleClick={onTitleClick}
					onTitleDoubleClick={onTitleDoubleClick}
				/>

				{/* Right: Actions (Mobile-Optimized 3D Glass Sphere) */}
				<div className="flex items-center gap-1.5 flex-shrink-0">
					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('selection');
							onOpenHistory();
						}}
						className="w-9 h-9 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-white/5 dark:from-white/15 dark:via-white/5 dark:to-black/25 border border-white/35 dark:border-white/25 text-primary hover:from-white/25 hover:to-white/10 shadow-[0_3px_8px_rgba(0,0,0,0.35),_inset_0_1px_1px_0_rgba(255,255,255,0.45),_inset_0_-1px_1px_0_rgba(0,0,0,0.35)] transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
						title="Lịch sử đọc gần đây"
						aria-label="Lịch sử đọc gần đây"
					>
						<Clock size={16} strokeWidth={2.3} />
					</motion.button>
				</div>
			</div>

			{/* Thin Reading Progress Indicator Bar with Glowing Tip */}
			<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-outline-variant/15 overflow-hidden">
				<div
					className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] transition-all duration-150 ease-out"
					style={{ width: `${progressPercent}%` }}
				/>
			</div>
		</header>
	);
});
