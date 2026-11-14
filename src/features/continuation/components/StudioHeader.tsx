import { ArrowLeft, GitBranch, Plus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import type { StoryBranchRecord, BranchMode } from '../types';

interface StudioHeaderProps {
	bookName: string;
	author?: string;
	branches: StoryBranchRecord[];
	selectedBranchId: string;
	onBack: () => void;
	onSelectBranch: (branchId: string) => void;
	onOpenNewBranch: () => void;
}

function getBranchModeLabel(mode: BranchMode): string {
	if (mode === 'MAIN') return 'Chính';
	if (mode === 'SPINOFF') return 'Ngoại';
	return 'Giả định';
}

function getBranchBadgeClass(mode: BranchMode): string {
	if (mode === 'MAIN') return 'bg-emerald-500/20 text-emerald-300';
	if (mode === 'SPINOFF') return 'bg-amber-500/20 text-amber-300';
	return 'bg-violet-500/20 text-violet-300';
}

export function StudioHeader({ bookName, author, branches, selectedBranchId, onBack, onSelectBranch, onOpenNewBranch }: StudioHeaderProps) {
	return (
		<header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-3.5 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 space-y-2.5 w-full max-w-md mx-auto">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<motion.button
						whileTap={{ scale: 0.88 }}
						onClick={() => {
							triggerHaptic('light');
							onBack();
						}}
						className="w-9 h-9 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer"
						title="Quay lại"
					>
						<ArrowLeft size={16} />
					</motion.button>
					<div className="min-w-0">
						<div className="flex items-center gap-1.5">
							<Sparkles size={14} className="text-amber-400 flex-shrink-0" />
							<h1 className="text-sm font-extrabold text-on-surface truncate">Studio Viết Tiếp</h1>
						</div>
						<p className="text-[10px] font-mono text-on-surface-variant/70 truncate">
							{bookName} {author ? `• ${author}` : ''}
						</p>
					</div>
				</div>

				<motion.button
					whileTap={{ scale: 0.92 }}
					onClick={() => {
						triggerHaptic('selection');
						onOpenNewBranch();
					}}
					className="px-2.5 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs flex-shrink-0"
				>
					<Plus size={13} strokeWidth={2.5} />
					<span>Tạo Nhánh</span>
				</motion.button>
			</div>

			{/* Branch Switcher Horizontal Pills */}
			<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
				{branches.map((b) => {
					const isSelected = b.branchId === selectedBranchId;
					const badgeText = getBranchModeLabel(b.mode);
					const badgeClass = getBranchBadgeClass(b.mode);
					return (
						<motion.button
							key={b.branchId}
							whileTap={{ scale: 0.94 }}
							onClick={() => {
								triggerHaptic('selection');
								onSelectBranch(b.branchId);
							}}
							className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer border ${
								isSelected
									? 'bg-primary/25 border-primary/60 text-primary font-bold shadow-xs'
									: 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
							}`}
						>
							<GitBranch size={12} className={isSelected ? 'text-primary' : 'opacity-60'} />
							<span className="truncate max-w-[120px]">{b.title || `Nhánh ${b.mode}`}</span>
							<span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${badgeClass}`}>{badgeText}</span>
						</motion.button>
					);
				})}
			</div>
		</header>
	);
}
