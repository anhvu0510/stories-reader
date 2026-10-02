import React, { memo } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

export interface AppUpdateOverlayProps {
	isUpdating: boolean;
	progress?: number;
	statusMessage?: string;
}

export const AppUpdateOverlay = memo(function AppUpdateOverlay({
	isUpdating,
	progress = 0,
	statusMessage
}: AppUpdateOverlayProps) {
	if (!isUpdating) {
		return null;
	}

	const displayProgress = Math.min(100, Math.max(0, Math.round(progress)));

	return (
		<aside
			role="status"
			aria-live="polite"
			className="fixed inset-0 z-[999999] flex flex-col items-center justify-center p-6 bg-black/60 dark:bg-black/75 backdrop-blur-md select-none touch-none animate-fadeIn"
		>
			<div className="w-full max-w-sm rounded-3xl bg-surface/90 dark:bg-surface-container-high/90 border border-white/20 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.25)] p-6 text-center flex flex-col items-center">
				{/* Glowing Pulsing Icon Ring */}
				<div className="relative mb-5 flex items-center justify-center">
					<div className="absolute w-20 h-20 rounded-full bg-primary/25 blur-xl animate-pulse" />
					<div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/40 flex items-center justify-center shadow-lg">
						<RefreshCw size={28} className="text-primary animate-spin" />
					</div>
					<div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
						<Sparkles size={12} className="text-on-primary animate-bounce" />
					</div>
				</div>

				{/* Title */}
				<h3 className="text-base font-extrabold text-on-surface tracking-tight">
					Đang cập nhật phiên bản mới...
				</h3>

				{/* Description */}
				<p className="mt-2 text-xs text-on-surface-variant/80 leading-relaxed px-2">
					Hệ thống đang tải và giải nén bản cập nhật. Ứng dụng sẽ tự động tải lại trong giây lát.
				</p>

				{/* Progress Section */}
				<div className="mt-5 w-full">
					<div
						role="progressbar"
						aria-valuenow={displayProgress}
						aria-valuemin={0}
						aria-valuemax={100}
						className="w-full h-2 rounded-full bg-surface-container-highest/60 overflow-hidden relative"
					>
						<div
							className="h-full bg-gradient-to-r from-primary/70 via-primary to-primary shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-200 ease-out"
							style={{ width: `${displayProgress}%` }}
						/>
					</div>

					<div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
						<span>{statusMessage || 'Đang xử lý...'}</span>
						<span className="text-primary font-bold">{displayProgress}%</span>
					</div>
				</div>
			</div>
		</aside>
	);
});
