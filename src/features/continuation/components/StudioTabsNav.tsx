import { GitBranch, Users, Feather } from 'lucide-react';
import React from 'react';

import { triggerHaptic } from '@/hooks/useHaptic';

interface StudioTabsNavProps {
	activeTab: 'autopilot' | 'world' | 'voice';
	onSelectTab: (tab: 'autopilot' | 'world' | 'voice') => void;
}

export function StudioTabsNav({ activeTab, onSelectTab }: StudioTabsNavProps) {
	return (
		<div className="px-3.5 pt-3 pb-2">
			<div className="grid grid-cols-3 gap-1 bg-surface-container/60 p-1 rounded-2xl border border-outline-variant/20">
				<button
					type="button"
					onClick={() => {
						triggerHaptic('selection');
						onSelectTab('autopilot');
					}}
					className={`py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
						activeTab === 'autopilot' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<GitBranch size={13} />
					<span>Autopilot</span>
				</button>

				<button
					type="button"
					onClick={() => {
						triggerHaptic('selection');
						onSelectTab('world');
					}}
					className={`py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
						activeTab === 'world' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<Users size={13} />
					<span>Mô Hình</span>
				</button>

				<button
					type="button"
					onClick={() => {
						triggerHaptic('selection');
						onSelectTab('voice');
					}}
					className={`py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
						activeTab === 'voice' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
					}`}
				>
					<Feather size={13} />
					<span>Văn Phong</span>
				</button>
			</div>
		</div>
	);
}
