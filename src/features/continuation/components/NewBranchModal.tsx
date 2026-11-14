import { X, GitBranch, Sparkles, Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import type { BranchMode } from '../types';
import type { CreateBranchPayload } from '@/services/continuationService';

interface NewBranchModalProps {
	isOpen: boolean;
	isPending: boolean;
	lastIngestedChapter: number;
	onClose: () => void;
	onSubmit: (payload: CreateBranchPayload) => void;
}

function BranchModeButton({
	selected,
	title,
	desc,
	activeClass,
	onClick,
}: {
	selected: boolean;
	title: string;
	desc: string;
	activeClass: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
				selected ? activeClass : 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
			}`}
		>
			<div className="text-xs">{title}</div>
			<div className="text-[10px] opacity-70">{desc}</div>
		</button>
	);
}

function BranchInputs({
	mode,
	forkChapter,
	premise,
	direction,
	chapterCount,
	lastIngestedChapter,
	onSetForkChapter,
	onSetPremise,
	onSetDirection,
	onSetChapterCount,
}: {
	mode: BranchMode;
	forkChapter: number;
	premise: string;
	direction: string;
	chapterCount: number;
	lastIngestedChapter: number;
	onSetForkChapter: (val: number) => void;
	onSetPremise: (val: string) => void;
	onSetDirection: (val: string) => void;
	onSetChapterCount: (val: number) => void;
}) {
	return (
		<>
			<div className="space-y-1">
				<label className="text-xs font-semibold text-on-surface-variant">Tách nhánh từ chương:</label>
				<input
					type="number"
					value={forkChapter}
					min={1}
					max={lastIngestedChapter}
					onChange={(e) => onSetForkChapter(Number(e.target.value))}
					className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
				/>
			</div>

			<div className="space-y-1">
				<label className="text-xs font-semibold text-on-surface-variant">
					{mode === 'WHAT_IF' ? 'Biến cố giả định (Nếu như...):' : 'Tiền đề / Tiêu điểm ngoại truyện:'}
				</label>
				<textarea
					rows={2}
					value={premise}
					onChange={(e) => onSetPremise(e.target.value)}
					placeholder={
						mode === 'WHAT_IF'
							? 'Ví dụ: Nếu như tại chương 60 nhân vật bị bắt quả tang tại trận...'
							: 'Ví dụ: Đào sâu góc nhìn tâm lý kín đáo của hai mẹ con...'
					}
					className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40"
				/>
			</div>

			<div className="space-y-1">
				<label className="text-xs font-semibold text-on-surface-variant">Hướng diễn biến mong muốn (tùy chọn):</label>
				<input
					type="text"
					value={direction}
					onChange={(e) => onSetDirection(e.target.value)}
					placeholder="Ví dụ: Giữ giọng văn hồi hộp, đẩy mâu thuẫn lên cao trào"
					className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40"
				/>
			</div>

			<div className="space-y-1">
				<label className="text-xs font-semibold text-on-surface-variant">Số chương lên kế hoạch:</label>
				<input
					type="number"
					value={chapterCount}
					min={1}
					max={15}
					onChange={(e) => onSetChapterCount(Number(e.target.value))}
					className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
				/>
			</div>
		</>
	);
}

export function NewBranchModal({ isOpen, isPending, lastIngestedChapter, onClose, onSubmit }: NewBranchModalProps) {
	const [mode, setMode] = useState<BranchMode>('SPINOFF');
	const [forkChapter, setForkChapter] = useState<number>(lastIngestedChapter);
	const [premise, setPremise] = useState<string>('');
	const [direction, setDirection] = useState<string>('');
	const [chapterCount, setChapterCount] = useState<number>(5);

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		triggerHaptic('medium');
		onSubmit({
			mode,
			forkAtChapter: Number(forkChapter),
			counterfactualPremise: premise.trim(),
			userDirection: direction.trim(),
			chapterCount: Number(chapterCount),
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
			<div className="w-full max-w-md bg-surface border border-outline-variant/30 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
							<GitBranch size={16} />
						</div>
						<h3 className="text-sm font-bold text-on-surface">Khởi Tạo Nhánh Truyện Mới</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
					>
						<X size={16} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-3.5">
					<div className="space-y-1.5">
						<label className="text-xs font-semibold text-on-surface-variant">Loại nhánh truyện:</label>
						<div className="grid grid-cols-2 gap-2">
							<BranchModeButton
								selected={mode === 'SPINOFF'}
								title="Ngoại Truyện (Spinoff)"
								desc="Phát triển sâu góc nhìn nhân vật phụ"
								activeClass="bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold"
								onClick={() => setMode('SPINOFF')}
							/>
							<BranchModeButton
								selected={mode === 'WHAT_IF'}
								title="Giả Định (What-If)"
								desc="Rẽ hướng biến cố từ một chương cũ"
								activeClass="bg-violet-500/15 border-violet-500/50 text-violet-300 font-bold"
								onClick={() => setMode('WHAT_IF')}
							/>
						</div>
					</div>

					<BranchInputs
						mode={mode}
						forkChapter={forkChapter}
						premise={premise}
						direction={direction}
						chapterCount={chapterCount}
						lastIngestedChapter={lastIngestedChapter}
						onSetForkChapter={setForkChapter}
						onSetPremise={setPremise}
						onSetDirection={setDirection}
						onSetChapterCount={setChapterCount}
					/>

					<div className="flex items-center gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-semibold text-on-surface-variant cursor-pointer hover:bg-surface-container-high transition-all"
						>
							Hủy
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
						>
							{isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
							<span>Lập Kế Hoạch Nhánh</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
