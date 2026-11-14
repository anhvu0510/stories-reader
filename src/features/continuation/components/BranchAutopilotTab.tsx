import { Compass, CheckCircle, Clock } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHaptic } from '@/hooks/useHaptic';

import { AutopilotConsole } from './AutopilotConsole';

import type { StoryBranchRecord, AutopilotStatusRecord } from '../types';

interface BranchAutopilotTabProps {
	bookId: string;
	branch: StoryBranchRecord | null;
	batchTarget: number;
	isRunning: boolean;
	isPending: boolean;
	onSetBatchTarget: (count: number) => void;
	onStartAutopilot: () => void;
	onPauseAutopilot: () => void;
	onStopAutopilot: () => void;
}

export function BranchAutopilotTab({
	bookId,
	branch,
	batchTarget,
	isRunning,
	isPending,
	onSetBatchTarget,
	onStartAutopilot,
	onPauseAutopilot,
	onStopAutopilot,
}: BranchAutopilotTabProps) {
	const navigate = useNavigate();

	if (!branch) {
		return <div className="p-8 text-center text-xs text-on-surface-variant">Chưa chọn nhánh truyện nào.</div>;
	}

	const arc = branch.arcPlan;
	const chapters = arc?.chapters || [];

	return (
		<div className="space-y-4 pb-12">
			{/* Autopilot Batch Console */}
			<AutopilotConsole
				branchTitle={branch.title}
				lastWrittenChapter={branch.lastWrittenChapter || 0}
				autopilot={branch.autopilot as AutopilotStatusRecord}
				batchTarget={batchTarget}
				isRunning={isRunning}
				isPending={isPending}
				onSetBatchTarget={onSetBatchTarget}
				onStart={onStartAutopilot}
				onPause={onPauseAutopilot}
				onStop={onStopAutopilot}
			/>

			{/* Arc Plan Info Card */}
			{arc && (
				<div className="rounded-2xl bg-surface-container/50 border border-outline-variant/30 p-3.5 space-y-2">
					<div className="flex items-center gap-1.5 text-xs font-bold text-primary">
						<Compass size={14} />
						<h4>Mục Tiêu Hồi Truyện (Arc Goal)</h4>
					</div>
					<p className="text-xs text-on-surface font-medium leading-relaxed">{arc.endgameGoal}</p>
					{arc.arcSummary && (
						<p className="text-[11px] text-on-surface-variant leading-relaxed pt-1 border-t border-outline-variant/20">{arc.arcSummary}</p>
					)}
				</div>
			)}

			{/* Planned and Written Chapters List */}
			<div className="space-y-2">
				<div className="flex items-center justify-between px-1">
					<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Kế Hoạch & Tiến Độ Chương ({chapters.length})</h4>
					<span className="text-[10px] font-mono text-on-surface-variant">Nhấn vào để đọc chương đã viết</span>
				</div>

				<div className="space-y-1.5">
					{chapters.map((chap) => {
						const isWritten = chap.chapterNumber <= (branch.lastWrittenChapter || 0);
						return (
							<div
								key={chap.chapterNumber}
								onClick={() => {
									if (!isWritten) return;
									triggerHaptic('light');
									navigate(`/book/${bookId}`);
								}}
								className={`p-3 rounded-xl border transition-all ${
									isWritten
										? 'bg-emerald-500/10 border-emerald-500/30 text-on-surface cursor-pointer hover:bg-emerald-500/15'
										: 'bg-surface-container/40 border-outline-variant/20 text-on-surface-variant opacity-80'
								}`}
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<div
											className={`w-6 h-6 rounded-lg font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
												isWritten ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-on-surface-variant'
											}`}
										>
											{chap.chapterNumber}
										</div>
										<h5 className="text-xs font-bold truncate">{chap.title}</h5>
									</div>

									<div className="flex-shrink-0">
										{isWritten ? (
											<span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
												<CheckCircle size={12} />
												<span>Đã viết</span>
											</span>
										) : (
											<span className="flex items-center gap-1 text-[10px] font-mono text-on-surface-variant/70">
												<Clock size={12} />
												<span>Dự kiến</span>
											</span>
										)}
									</div>
								</div>

								{chap.summary && <p className="text-[11px] text-on-surface-variant/80 mt-1 line-clamp-2 pl-8">{chap.summary}</p>}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
