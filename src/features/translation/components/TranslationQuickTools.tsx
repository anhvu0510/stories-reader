import { Heading, Tags, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

interface TranslationQuickToolsProps {
	onDetectProperNouns: () => void;
	onTranslateChineseTitles: () => void;
	onDetectTagsAndPov: () => void;
	disabled?: boolean;
}

export function TranslationQuickTools({
	onDetectProperNouns,
	onTranslateChineseTitles,
	onDetectTagsAndPov,
	disabled = false,
}: TranslationQuickToolsProps) {
	const tools = [
		{
			key: 'proper-nouns',
			label: 'Quét xưng hô',
			title: 'Phát hiện xưng hô / danh từ riêng qua AI',
			ariaLabel: 'Phát hiện xưng hô / danh từ riêng',
			iconClass: 'text-primary',
			Icon: UserCheck,
			onClick: onDetectProperNouns,
		},
		{
			key: 'titles',
			label: 'Dịch tiêu đề',
			title: 'Dịch tiêu đề chương tiếng Trung',
			ariaLabel: 'Dịch tiêu đề tiếng Trung',
			iconClass: 'text-amber-400',
			Icon: Heading,
			onClick: onTranslateChineseTitles,
		},
		{
			key: 'pov',
			label: 'Dịch POV',
			title: 'Phân loại & nhận diện POV qua AI',
			ariaLabel: 'Dịch POV',
			iconClass: 'text-violet-400',
			Icon: Tags,
			onClick: onDetectTagsAndPov,
		},
	];

	return (
		<div className="grid grid-cols-3 gap-2">
			{tools.map(({ key, label, title, ariaLabel, iconClass, Icon, onClick }) => (
				<motion.button
					key={key}
					type="button"
					whileTap={disabled ? undefined : { scale: 0.96 }}
					onClick={() => {
						if (!disabled) {
							triggerHaptic('light');
							onClick();
						}
					}}
					disabled={disabled}
					className="h-10 px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-on-surface active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs group select-none"
					title={title}
					aria-label={ariaLabel}
				>
					<Icon size={15} className={`${iconClass} group-hover:scale-110 transition-transform shrink-0`} />
					<span className="text-[11px] font-bold truncate">{label}</span>
				</motion.button>
			))}
		</div>
	);
}
