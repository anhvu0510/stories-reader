import { Pause, Square, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

import type { AutopilotStatusRecord } from '../types';

interface AutopilotConsoleProps {
	branchTitle: string;
	lastWrittenChapter: number;
	autopilot?: AutopilotStatusRecord;
	batchTarget: number;
	isRunning: boolean;
	isPending: boolean;
	onSetBatchTarget: (count: number) => void;
	onStart: () => void;
	onPause: () => void;
	onStop: () => void;
}

const PIPELINE_STEPS = [
	{ key: 'PLANNING', label: '1. Beats' },
	{ key: 'DRAFTING', label: '2. Chấp Bút' },
	{ key: 'VERIFIED', label: '3. Kiểm Định' },
	{ key: 'DONE', label: '4. Xuất Bản' },
];

function getStatusDotColor(status: string, isRunning: boolean): string {
	if (isRunning) return 'bg-emerald-400 animate-ping';
	if (status === 'COMPLETED') return 'bg-emerald-500';
	if (status === 'PAUSED') return 'bg-amber-400';
	if (status === 'ERROR') return 'bg-rose-500';
	return 'bg-on-surface-variant/40';
}

function AutopilotProgressSection({
	autopilot,
	lastWrittenChapter,
	targetCount,
	completedCount,
}: {
	autopilot?: AutopilotStatusRecord;
	lastWrittenChapter: number;
	targetCount: number;
	completedCount: number;
}) {
	const currentStep = autopilot?.currentStep || 'IDLE';
	const progressPercent = Math.min(100, Math.round((completedCount / (targetCount || 1)) * 100));

	return (
		<div className="space-y-2 py-1">
			<div className="flex items-center justify-between text-xs">
				<span className="font-semibold text-primary flex items-center gap-1.5">
					<Loader2 size={13} className="animate-spin" />
					Đang viết chương {autopilot?.currentChapterNumber || lastWrittenChapter + 1}...
				</span>
				<span className="font-mono text-on-surface-variant font-bold">
					{completedCount} / {targetCount} ({progressPercent}%)
				</span>
			</div>

			<div className="w-full h-2 rounded-full bg-black/20 overflow-hidden border border-outline-variant/20">
				<div
					className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-300"
					style={{ width: `${progressPercent}%` }}
				/>
			</div>

			<div className="grid grid-cols-4 gap-1 pt-1">
				{PIPELINE_STEPS.map((step) => {
					const isCurrent = currentStep === step.key;
					const stepClass = isCurrent
						? 'bg-primary/25 text-primary font-bold border border-primary/50'
						: 'bg-white/[0.03] text-on-surface-variant/50';
					return (
						<div key={step.key} className={`text-center py-1 px-0.5 rounded-lg text-[10px] font-mono transition-colors ${stepClass}`}>
							{step.label}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function AutopilotStatusAlerts({ status, isRunning, error }: { status: string; isRunning: boolean; error?: string }) {
	if (status === 'ERROR' && error) {
		return (
			<div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
				<AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
				<div className="min-w-0">
					<span className="font-bold">Lỗi Autopilot:</span> {error}
				</div>
			</div>
		);
	}

	if (status === 'COMPLETED' && !isRunning) {
		return (
			<div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
				<CheckCircle2 size={15} className="flex-shrink-0" />
				<span>Hoàn thành đợt viết! Các chương đã được xuất bản tự động.</span>
			</div>
		);
	}

	return null;
}

function AutopilotControlButtons({
	isRunning,
	isPending,
	batchTarget,
	onStart,
	onPause,
	onStop,
}: {
	isRunning: boolean;
	isPending: boolean;
	batchTarget: number;
	onStart: () => void;
	onPause: () => void;
	onStop: () => void;
}) {
	if (!isRunning) {
		return (
			<motion.button
				whileTap={{ scale: 0.96 }}
				onClick={() => {
					triggerHaptic('medium');
					onStart();
				}}
				disabled={isPending}
				className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
			>
				<Sparkles size={15} />
				<span>Bắt Đầu Autopilot (+{batchTarget} Chương)</span>
			</motion.button>
		);
	}

	return (
		<div className="flex items-center gap-2 w-full">
			<motion.button
				whileTap={{ scale: 0.96 }}
				onClick={() => {
					triggerHaptic('medium');
					onPause();
				}}
				disabled={isPending}
				className="flex-1 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30 transition-all"
			>
				<Pause size={14} />
				<span>Tạm Dừng</span>
			</motion.button>
			<motion.button
				whileTap={{ scale: 0.96 }}
				onClick={() => {
					triggerHaptic('heavy');
					onStop();
				}}
				disabled={isPending}
				className="flex-1 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-500/30 transition-all"
			>
				<Square size={14} />
				<span>Dừng Hẳn</span>
			</motion.button>
		</div>
	);
}

export function AutopilotConsole({
	branchTitle,
	lastWrittenChapter,
	autopilot,
	batchTarget,
	isRunning,
	isPending,
	onSetBatchTarget,
	onStart,
	onPause,
	onStop,
}: AutopilotConsoleProps) {
	const status = autopilot?.status || 'IDLE';
	const completedCount = autopilot?.completedCount || 0;
	const targetCount = autopilot?.targetCount || batchTarget;
	const dotColor = getStatusDotColor(status, isRunning);

	return (
		<div className="rounded-2xl bg-surface-container/70 border border-outline-variant/30 p-3.5 space-y-3 shadow-md backdrop-blur-sm">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
					<h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">Autopilot • {branchTitle}</h3>
				</div>
				<div className="text-[11px] font-mono text-on-surface-variant">
					Đã viết đến: <span className="font-bold text-primary">Ch.{lastWrittenChapter}</span>
				</div>
			</div>

			{!isRunning && (
				<div className="flex items-center justify-between gap-2 pt-1">
					<span className="text-xs text-on-surface-variant font-medium">Số chương viết tiếp:</span>
					<div className="flex items-center gap-1.5">
						{[5, 10, 20].map((count) => (
							<button
								key={count}
								type="button"
								onClick={() => {
									triggerHaptic('selection');
									onSetBatchTarget(count);
								}}
								className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
									batchTarget === count
										? 'bg-primary text-on-primary shadow-xs'
										: 'bg-white/5 border border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
								}`}
							>
								+{count} chương
							</button>
						))}
					</div>
				</div>
			)}

			{isRunning && (
				<AutopilotProgressSection
					autopilot={autopilot}
					lastWrittenChapter={lastWrittenChapter}
					targetCount={targetCount}
					completedCount={completedCount}
				/>
			)}

			<AutopilotStatusAlerts status={status} isRunning={isRunning} error={autopilot?.error} />

			<div className="pt-1">
				<AutopilotControlButtons
					isRunning={isRunning}
					isPending={isPending}
					batchTarget={batchTarget}
					onStart={onStart}
					onPause={onPause}
					onStop={onStop}
				/>
			</div>
		</div>
	);
}
