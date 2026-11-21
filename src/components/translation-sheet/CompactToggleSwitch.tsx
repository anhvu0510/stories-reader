import React from 'react';

interface CompactToggleSwitchProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	surfaceClassName?: string;
}

export function CompactToggleSwitch({
	label,
	checked,
	onChange,
	surfaceClassName = 'bg-white/5 border border-white/10',
}: CompactToggleSwitchProps) {
	return (
		<label className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer select-none ${surfaceClassName}`}>
			<span className="text-[10px] font-bold text-on-surface-variant uppercase truncate">{label}</span>
			<span className="relative inline-flex items-center shrink-0">
				<input
					type="checkbox"
					role="switch"
					aria-checked={checked}
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
					className="sr-only peer"
				/>
				<span className="w-7 h-4 rounded-full bg-white/15 border border-white/10 peer-checked:bg-primary/80 peer-checked:border-primary/60 transition-colors duration-200" />
				<span className="absolute left-0.5 w-3 h-3 rounded-full bg-white shadow-xs transition-transform duration-200 peer-checked:translate-x-3" />
			</span>
		</label>
	);
}
