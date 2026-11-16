import { X, Plus, RefreshCw } from 'lucide-react';
import React from 'react';

import { formatPlatformDisplayName } from '@/shared/utils/modelFormatters';

export function AIPlatformSheetHeader({
	title,
	addTitle,
	activeTab,
	setActiveTab,
	availableTabs = ['AI_STUDIO', 'VERTEX_API', 'DEPLOYAI'],
	onStartCreate,
	isCreating,
	onRefresh,
	isLoading,
	onClose,
	isEmbedded,
}: {
	title: string;
	addTitle: string;
	activeTab: string;
	setActiveTab: (tab: string) => void;
	availableTabs?: string[];
	onStartCreate: () => void;
	isCreating: boolean;
	onRefresh: () => void;
	isLoading: boolean;
	onClose?: () => void;
	isEmbedded?: boolean;
}) {
	const tabs = availableTabs.length > 0 ? availableTabs : ['AI_STUDIO'];

	return (
		<div className="flex-shrink-0 p-3 sm:p-4 border-b border-white/10 flex flex-col gap-3 bg-transparent rounded-2xl mb-2">
			<div className="flex items-center justify-between">
				<h2 className="text-base sm:text-lg font-extrabold text-primary">{title}</h2>
				<div className="flex items-center gap-1 sm:gap-2">
					<button
						title={addTitle}
						onClick={onStartCreate}
						disabled={isCreating}
						className="p-1.5 sm:p-2 bg-white/10 border border-white/20 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all disabled:opacity-50"
					>
						<Plus size={14} />
					</button>
					<button
						title="Làm Mới"
						onClick={onRefresh}
						className="p-1.5 sm:p-2 bg-white/10 border border-white/20 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all"
					>
						<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
					</button>
					{!isEmbedded && onClose && (
						<button
							title="Đóng"
							onClick={onClose}
							className="p-1.5 sm:p-2 bg-white/10 border border-white/20 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all"
						>
							<X size={14} />
						</button>
					)}
				</div>
			</div>
			<div className="flex bg-white/10 p-1 rounded-xl border border-white/15 gap-1 overflow-x-auto hide-scrollbar">
				{tabs.map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === tab ? 'bg-primary/20 text-primary border border-primary/50 shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
					>
						{formatPlatformDisplayName(tab)}
					</button>
				))}
			</div>
		</div>
	);
}
