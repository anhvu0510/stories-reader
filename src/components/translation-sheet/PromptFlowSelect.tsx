import { useId } from 'react';

import { cn } from '@/lib/utils';

export type PromptFlowVersion = 'v1' | 'v2' | 'v3';

interface PromptFlowSelectProps {
	value: PromptFlowVersion;
	onChange: (value: PromptFlowVersion) => void;
	surfaceClassName?: string;
}

const FLOW_OPTIONS: Array<{ value: PromptFlowVersion; label: string }> = [
	{ value: 'v3', label: 'V3 · In-Memory PAIRS' },
	{ value: 'v2', label: 'V2 · Single-Call' },
	{ value: 'v1', label: 'V1 · Legacy' },
];

export function PromptFlowSelect({ value, onChange, surfaceClassName = 'bg-white/5' }: PromptFlowSelectProps) {
	const selectId = useId();

	return (
		<div
			className={cn('col-span-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 border border-white/10', surfaceClassName)}
		>
			<label htmlFor={selectId} className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0">
				Flow dịch
			</label>
			<select
				id={selectId}
				value={value}
				onChange={(e) => onChange(e.target.value as PromptFlowVersion)}
				className="bg-transparent text-[11px] font-mono font-bold text-primary focus:outline-none cursor-pointer text-right"
			>
				{FLOW_OPTIONS.map((opt) => (
					<option key={opt.value} value={opt.value} className="bg-surface text-on-surface">
						{opt.label}
					</option>
				))}
			</select>
		</div>
	);
}
