import { memo } from 'react';

export interface ReaderChapterSkeletonProps {
	/** Class name tùy chỉnh cho container */
	className?: string;
	/** Gợi ý tiêu đề chương kế tiếp/trước đó nếu đã biết trước từ navigation */
	titleHint?: string;
	/** Giữ tương thích props cũ */
	showBottomHint?: boolean;
}

/**
 * Skeleton Screen mô phỏng chính xác layout trang đọc truyện
 * Khớp hoàn toàn cấu trúc, tỷ lệ và nhịp điệu typography của ChapterContentSection
 */
export const ReaderChapterSkeleton = memo(function ReaderChapterSkeleton({
	className = '',
	titleHint
}: ReaderChapterSkeletonProps) {
	return (
		<div
			data-testid="reader-chapter-skeleton"
			aria-hidden="true"
			className={`w-full min-h-[85vh] pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.25rem)] sm:pt-24 pb-24 select-none relative overflow-hidden pointer-events-none ${className}`}
		>
			{/* Tiêu đề chương khớp 100% với ChapterContentSection */}
			<div className="px-4 mb-5 pt-0.5">
				<h2 className="text-base sm:text-lg font-bold tracking-tight leading-snug flex items-center gap-2">
					<span className="w-1 h-4 rounded-full bg-primary/70 inline-block shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.35)]" />
					{titleHint ? (
						<p className="line-clamp-1 text-on-surface/70 text-sm sm:text-base font-semibold">{titleHint}</p>
					) : (
						<div className="h-5 w-44 sm:w-56 rounded-md skeleton-shimmer opacity-85" />
					)}
				</h2>
			</div>

			{/* Các đoạn văn với nhịp điệu tự nhiên của trang sách */}
			<article className="px-4 space-y-6 opacity-85">
				{/* Đoạn 1: Mở đầu (4 dòng) */}
				<div className="space-y-3">
					<div className="h-4 w-full rounded-md skeleton-shimmer" />
					<div className="h-4 w-[97%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[93%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[62%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 2: Đoạn ngắn (3 dòng) */}
				<div className="space-y-3">
					<div className="h-4 w-[98%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[94%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[46%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 3: Thân bài (5 dòng) */}
				<div className="space-y-3">
					<div className="h-4 w-full rounded-md skeleton-shimmer" />
					<div className="h-4 w-[96%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[98%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[89%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[54%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 4: Đoạn chuyển ý (4 dòng) */}
				<div className="space-y-3">
					<div className="h-4 w-[95%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[97%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[91%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[68%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 5: Đoạn kết (3 dòng) */}
				<div className="space-y-3">
					<div className="h-4 w-[94%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[88%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[40%] rounded-md skeleton-shimmer" />
				</div>
			</article>
		</div>
	);
});

