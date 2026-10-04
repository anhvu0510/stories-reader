import { memo } from 'react';

export interface ReaderChapterSkeletonProps {
	/** Class name tùy chỉnh cho container */
	className?: string;
	/** Gợi ý tiêu đề chương kế tiếp/trước đó nếu đã biết trước từ navigation */
	titleHint?: string;
	/** Hiển thị hay ẩn thanh điều khiển capsule giả lập ở đáy */
	showBottomHint?: boolean;
}

/**
 * Skeleton Screen đa tầng (Rich Multi-Layer Reader Skeleton)
 * Mô phỏng chân thực bố cục một chương truyện với tiêu đề, metadata,
 * các đoạn văn tự nhiên (mở đầu, đối thoại, thân bài) và hiệu ứng AMOLED 120Hz shimmer.
 */
export const ReaderChapterSkeleton = memo(function ReaderChapterSkeleton({
	className = '',
	titleHint,
	showBottomHint = true
}: ReaderChapterSkeletonProps) {
	return (
		<div
			data-testid="reader-chapter-skeleton"
			aria-hidden="true"
			className={`w-full min-h-[85vh] pt-[calc(max(env(safe-area-inset-top),0.75rem)+4.25rem)] sm:pt-24 pb-28 px-4 select-none relative overflow-hidden pointer-events-none ${className}`}
		>
			{/* Tầng 1: Subtle Top Ambient Glow tạo chiều sâu ánh sáng dịu nhẹ */}
			<div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-72 bg-gradient-to-b from-primary/12 via-primary/[0.03] to-transparent blur-3xl opacity-60" />

			{/* Tầng 2: Tiêu đề chương & Thẻ Badge Metadata */}
			<div className="mb-8 pt-0.5 space-y-2.5">
				{/* Badge số chương / Indicator thanh dọc phát sáng */}
				<div className="flex items-center gap-2">
					<span className="w-1 h-4.5 rounded-full bg-primary inline-block shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
					{titleHint ? (
						<h2 className="text-base sm:text-lg font-bold text-on-surface/60 tracking-tight leading-snug line-clamp-1">
							{titleHint}
						</h2>
					) : (
						<div className="h-5 w-48 rounded-md skeleton-shimmer" />
					)}
					<div className="h-4.5 w-14 rounded-full skeleton-shimmer ml-auto opacity-70" />
				</div>

				{/* Metadata phụ: Thời gian đọc ước tính / Độ dài chữ */}
				<div className="flex items-center gap-2.5 pl-3 opacity-60">
					<div className="h-3 w-16 rounded skeleton-shimmer" />
					<div className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
					<div className="h-3 w-24 rounded skeleton-shimmer" />
					<div className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
					<div className="h-3 w-20 rounded skeleton-shimmer" />
				</div>
			</div>

			{/* Tầng 3: Các đoạn văn nhiều lớp (Multi-layer Paragraphs) bố cục tự nhiên như trang sách thật */}
			<div className="space-y-6 opacity-90">
				{/* Đoạn 1: Đoạn văn mở đầu (4 dòng, dòng cuối kết câu tự nhiên) */}
				<div className="space-y-2.5">
					<div className="h-4 w-full rounded-md skeleton-shimmer" />
					<div className="h-4 w-[96%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[93%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[68%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 2: Lời thoại nhân vật (Thụt lề sang phải với viền accent mờ) */}
				<div className="space-y-2.5 pl-3.5 border-l-2 border-primary/25 my-5">
					<div className="h-4 w-[85%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[52%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 3: Đoạn văn thân bài cao trào (5 dòng với các độ dài so le) */}
				<div className="space-y-2.5">
					<div className="h-4 w-[98%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[95%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-full rounded-md skeleton-shimmer" />
					<div className="h-4 w-[89%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[58%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 4: Đoạn dẫn giải tiếp theo (4 dòng) */}
				<div className="space-y-2.5">
					<div className="h-4 w-[96%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[92%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[97%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[73%] rounded-md skeleton-shimmer" />
				</div>

				{/* Đoạn 5: Đoạn kết thúc ngắn */}
				<div className="space-y-2.5">
					<div className="h-4 w-[88%] rounded-md skeleton-shimmer" />
					<div className="h-4 w-[64%] rounded-md skeleton-shimmer" />
				</div>
			</div>

			{/* Tầng 4: Capsule Dock Skeleton ở đáy tạo cảm giác bố cục cân bằng, không trống trải */}
			{showBottomHint && (
				<div className="mt-12 flex justify-center opacity-40">
					<div className="h-10 w-48 rounded-full skeleton-shimmer border border-outline-variant/20 shadow-sm" />
				</div>
			)}
		</div>
	);
});
