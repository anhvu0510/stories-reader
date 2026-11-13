import { Edit2, Trash2, Check, PlayCircle, PauseCircle } from 'lucide-react';
import React from 'react';

import { formatModelDisplayName } from '@/shared/utils/modelFormatters';

import { AIPlatformSheetHeader } from '../AIPlatformSheetHeader';

import type { AIToken } from '@/shared/types';

export function TokenHeader(props: {
	activeTab: 'VERTEX_API' | 'AI_STUDIO';
	setActiveTab: (tab: 'VERTEX_API' | 'AI_STUDIO') => void;
	onStartCreate: () => void;
	isCreating: boolean;
	onRefresh: () => void;
	isLoading: boolean;
	onClose?: () => void;
	isEmbedded?: boolean;
}) {
	return <AIPlatformSheetHeader {...props} title="Quản lý API Token" addTitle="Thêm Token Mới" />;
}

function TokenStatusBadge({ status }: { status: string }) {
	if (status === 'active') {
		return <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">ACTIVE</span>;
	}
	if (status === 'banned') {
		return <span className="text-[9px] bg-error/20 text-error px-1.5 py-0.5 rounded font-medium shrink-0">BANNED</span>;
	}
	return (
		<span className="text-[9px] bg-outline-variant/20 px-1.5 py-0.5 rounded text-on-surface-variant font-medium shrink-0">PAUSED</span>
	);
}

function TokenUsageItem({
	item,
}: {
	key?: string;
	item: {
		model: string;
		rpdLimit: number;
		rpmLimit: number;
		usageToday?: { rpd?: number; rpdPercent?: number; rpm?: number };
	};
}) {
	const modelLabel = formatModelDisplayName(item.model);

	return (
		<div className="bg-surface-container flex items-center justify-between p-2 rounded-lg">
			<span className="text-[10px] font-bold truncate max-w-[120px]" title={item.model}>
				{modelLabel}
			</span>
			<div className="flex gap-3 text-[9px] font-medium text-on-surface-variant/80">
				{item.rpdLimit > 0 && (
					<span>
						RPD: {item.usageToday?.rpd || 0}/{item.rpdLimit} ({item.usageToday?.rpdPercent || 0}%)
					</span>
				)}
				{item.rpmLimit > 0 && <span>RPM: {item.usageToday?.rpm || 0}</span>}
			</div>
		</div>
	);
}

function parseConfigAI(raw: unknown): { apiKey?: string; project?: string; location?: string; vertexai?: boolean } {
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}
	if (raw && typeof raw === 'object') {
		return raw as { apiKey?: string; project?: string; location?: string; vertexai?: boolean };
	}
	return {};
}

function TokenPlatformConfigInputs({
	platform,
	configAI,
	onChangeConfig,
}: {
	platform?: string;
	configAI: { apiKey?: string; project?: string; location?: string; vertexai?: boolean };
	onChangeConfig: (updated: { apiKey?: string; project?: string; location?: string; vertexai?: boolean }) => void;
}) {
	if (platform === 'AI_STUDIO') {
		return (
			<input
				type="text"
				value={configAI.apiKey || ''}
				onChange={(e) => onChangeConfig({ ...configAI, apiKey: e.target.value })}
				placeholder="API Key"
				className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none font-mono"
			/>
		);
	}
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
			<input
				type="text"
				value={configAI.project || ''}
				onChange={(e) => onChangeConfig({ ...configAI, vertexai: true, project: e.target.value })}
				placeholder="GCP Project ID"
				className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none font-mono"
			/>
			<input
				type="text"
				value={configAI.location || ''}
				onChange={(e) => onChangeConfig({ ...configAI, vertexai: true, location: e.target.value })}
				placeholder="Location (vd: global)"
				className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none font-mono"
			/>
		</div>
	);
}

export function TokenEditor({
	formData,
	setFormData,
	onSave,
	onCancel,
	isNew,
}: {
	formData: Partial<AIToken>;
	setFormData: (d: Partial<AIToken>) => void;
	onSave: () => void;
	onCancel: () => void;
	isNew: boolean;
}) {
	const configAI = parseConfigAI(formData.configAI);

	return (
		<div className="bg-white/10 p-3 rounded-2xl border border-white/20 shadow-xs space-y-3">
			<div className="grid grid-cols-1 gap-2">
				<input
					autoFocus={isNew}
					type="text"
					value={formData.name || ''}
					onChange={(e) => setFormData({ ...formData, name: e.target.value })}
					placeholder="Tên gợi nhớ"
					className="w-full bg-white/10 border border-white/15 px-2.5 py-1.5 rounded-xl text-xs font-bold text-on-surface focus:border-primary/60 focus:outline-none shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
				/>
			</div>

			<div>
				<input
					type="email"
					value={formData.email || ''}
					onChange={(e) => setFormData({ ...formData, email: e.target.value })}
					placeholder="Email tài khoản"
					className="w-full bg-white/10 border border-white/15 px-2.5 py-1.5 rounded-xl text-xs font-medium text-on-surface focus:border-primary/60 focus:outline-none shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
				/>
			</div>

			<div className="grid grid-cols-2 gap-3 items-center">
				<select
					value={formData.status || 'active'}
					onChange={(e) => setFormData({ ...formData, status: e.target.value as AIToken['status'] })}
					className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:border-primary focus:outline-none appearance-none"
				>
					<option value="active">Active</option>
					<option value="paused">Paused</option>
					<option value="banned">Banned</option>
				</select>
				<input
					type="text"
					value={formData.model || '*'}
					onChange={(e) => setFormData({ ...formData, model: e.target.value })}
					placeholder="Model scope (vd: *)"
					className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:border-primary focus:outline-none"
				/>
			</div>

			<div className="pt-2 border-t border-outline-variant/10">
				<label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
					{formData.platform === 'AI_STUDIO' ? 'AI Studio Configuration' : 'Vertex API Configuration'}
				</label>
				<TokenPlatformConfigInputs
					platform={formData.platform}
					configAI={configAI}
					onChangeConfig={(updated) => setFormData({ ...formData, configAI: updated })}
				/>
			</div>

			<div className="flex gap-2 pt-1 border-t border-outline-variant/10 mt-2 pt-3">
				<button
					onClick={onCancel}
					className="flex-1 py-1.5 sm:py-2 bg-surface-container-high rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors"
				>
					Huỷ Bỏ
				</button>
				<button
					onClick={onSave}
					className="flex-1 py-1.5 sm:py-2 bg-primary text-on-primary rounded-lg text-xs font-bold flex animate-none items-center justify-center gap-1 hover:bg-primary-fixed transition-colors"
				>
					<Check size={12} /> Lưu Lại
				</button>
			</div>
		</div>
	);
}

export function TokenItemCard({
	token,
	isEditing,
	formData,
	setFormData,
	onSave,
	onCancel,
	onToggleStatus,
	onEdit,
	onDelete,
}: {
	token: AIToken;
	isEditing: boolean;
	formData: Partial<AIToken>;
	setFormData: (d: Partial<AIToken>) => void;
	onSave: () => void;
	onCancel: () => void;
	onToggleStatus: (t: AIToken) => void;
	onEdit: (t: AIToken) => void;
	onDelete: (id: string) => void;
}) {
	if (isEditing) {
		return <TokenEditor formData={formData} setFormData={setFormData} onSave={onSave} onCancel={onCancel} isNew={false} />;
	}

	return (
		<div
			className={`p-3 rounded-2xl border transition-all ${token.status === 'active' ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]' : 'border-white/10 bg-white/[0.02] opacity-60'}`}
		>
			<div className="flex justify-between gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-bold text-sm text-on-surface leading-tight truncate">{token.name}</h3>
						<TokenStatusBadge status={token.status} />
					</div>
					<div className="text-[10px] text-on-surface-variant/80 mt-1 font-medium truncate flex gap-2">{token.email}</div>
				</div>
				<div className="flex gap-1 shrink-0 bg-surface-container-high rounded-xl p-0.5 h-fit">
					{token.status !== 'banned' && (
						<button
							onClick={() => onToggleStatus(token)}
							className={`p-2 rounded-lg transition-colors ${token.status === 'active' ? 'text-warning hover:bg-warning/10' : 'text-primary hover:bg-primary/10'}`}
						>
							{token.status === 'active' ? <PauseCircle size={12} /> : <PlayCircle size={12} />}
						</button>
					)}
					<button
						onClick={() => onEdit(token)}
						className="p-2 rounded-lg text-primary hover:bg-surface-container-highest transition-colors"
					>
						<Edit2 size={12} />
					</button>
					<button
						onClick={() => onDelete(token._id)}
						className="p-2 rounded-lg text-error hover:bg-surface-container-highest transition-colors"
					>
						<Trash2 size={12} />
					</button>
				</div>
			</div>

			{token.modelList && token.modelList.length > 0 && (
				<div className="mt-3 grid grid-cols-1 gap-2">
					{token.modelList.map((m) => (
						<TokenUsageItem key={m.model} item={m} />
					))}
				</div>
			)}
		</div>
	);
}
