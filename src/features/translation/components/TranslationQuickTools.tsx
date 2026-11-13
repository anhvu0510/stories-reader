import { Heading, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

interface TranslationQuickToolsProps {
	onDetectProperNouns: () => void;
	onTranslateChineseTitles: () => void;
	disabled?: boolean;
}

export function TranslationQuickTools({ onDetectProperNouns, onTranslateChineseTitles, disabled = false }: TranslationQuickToolsProps) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<motion.button
				type="button"
				whileTap={disabled ? undefined : { scale: 0.96 }}
				onClick={() => {
					if (!disabled) {
						triggerHaptic('light');
						onDetectProperNouns();
					}
				}}
				disabled={disabled}
				className="h-10 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs group select-none"
				title="Phát hiện xưng hô / danh từ riêng qua AI"
				aria-label="Phát hiện xưng hô / danh từ riêng"
			>
				<UserCheck size={15} className="text-primary group-hover:scale-110 transition-transform shrink-0" />
				<span className="text-xs font-bold truncate">Quét xưng hô</span>
			</motion.button>

			<motion.button
				type="button"
				whileTap={disabled ? undefined : { scale: 0.96 }}
				onClick={() => {
					if (!disabled) {
						triggerHaptic('light');
						onTranslateChineseTitles();
					}
				}}
				disabled={disabled}
				className="h-10 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs group select-none"
				title="Dịch tiêu đề chương tiếng Trung"
				aria-label="Dịch tiêu đề tiếng Trung"
			>
				<Heading size={15} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
				<span className="text-xs font-bold truncate">Dịch tiêu đề</span>
			</motion.button>
		</div>
	);
}
