import { Loader, Send, Zap } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

interface TranslationActionDockProps {
	isSubmitting: boolean;
	submittingType: 'sync' | 'async' | null;
	syncButtonLabel: string;
	asyncButtonLabel: string;
	selectedCount: number;
	onSubmit: (sync: boolean) => void;
	hasModel?: boolean;
}

export function TranslationActionDock({
	isSubmitting,
	submittingType,
	syncButtonLabel,
	asyncButtonLabel,
	selectedCount,
	onSubmit,
	hasModel = true,
}: TranslationActionDockProps) {
	const isSyncSubmitting = isSubmitting && submittingType === 'sync';
	const isAsyncSubmitting = isSubmitting && submittingType === 'async';
	const isDisabled = isSubmitting || selectedCount === 0 || !hasModel;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto p-3 sm:p-4 border-t border-white/10 bg-surface/90 dark:bg-surface/90 backdrop-blur-xl pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.3)]">
			<div className="flex items-center gap-2.5 sm:gap-3">
				{/* Sync Translate: Dịch ngay */}
				<button
					type="button"
					onClick={() => {
						triggerHaptic('medium');
						onSubmit(true);
					}}
					disabled={isDisabled}
					className="flex-1 h-12 bg-primary/25 hover:bg-primary/35 backdrop-blur-md border-2 border-primary/70 text-primary rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
				>
					{isSyncSubmitting ? (
						<Loader size={17} className="animate-spin text-primary" />
					) : (
						<Zap size={17} className="fill-primary text-primary" />
					)}
					<span className="truncate">{syncButtonLabel}</span>
				</button>

				{/* Async Translate: Chạy nền / Hàng đợi */}
				<button
					type="button"
					onClick={() => {
						triggerHaptic('light');
						onSubmit(false);
					}}
					disabled={isDisabled}
					className="flex-1 h-12 bg-white/10 hover:bg-white/15 backdrop-blur-md border-2 border-outline-variant/50 text-on-surface rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.35)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
				>
					{isAsyncSubmitting ? (
						<Loader size={17} className="animate-spin text-on-surface" />
					) : (
						<Send size={16} className="text-on-surface-variant" />
					)}
					<span className="truncate">{asyncButtonLabel}</span>
				</button>
			</div>
		</div>
	);
}
