import { Edit2, Trash2, Check } from 'lucide-react';
import React from 'react';

import { formatModelDisplayName } from '@/shared/utils/modelFormatters';

import { AIPlatformSheetHeader } from '../AIPlatformSheetHeader';

import type { AIQuota } from '@/shared/types';

export function QuotaHeader(props: {
	activeTab: 'VERTEX_API' | 'AI_STUDIO';
	setActiveTab: (tab: 'VERTEX_API' | 'AI_STUDIO') => void;
	onStartCreate: () => void;
	isCreating: boolean;
	onRefresh: () => void;
	isLoading: boolean;
	onClose?: () => void;
	isEmbedded?: boolean;
}) {
	return <AIPlatformSheetHeader {...props} title="Quản lý AI Models" addTitle="Thêm Model Mới" />;
}

export function QuotaEditor({
	formData,
	setFormData,
	onSave,
	onCancel,
}: {
	formData: Partial<AIQuota>;
	setFormData: (d: Partial<AIQuota>) => void;
	onSave: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="bg-white/10 p-3 rounded-2xl border border-white/20 shadow-xs space-y-3">
			<div>
				<input
					autoFocus
					type="text"
					value={formData.model || ''}
					onChange={(e) => setFormData({ ...formData, model: e.target.value })}
					placeholder="Tên Model (vd: gemini-1.5-flash)"
					className="w-full bg-white/10 border border-white/15 px-2.5 py-1.5 rounded-xl text-xs font-bold text-on-surface focus:border-primary/60 focus:outline-none shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
				/>
			</div>

			<div className="grid grid-cols-[1fr_min-content] gap-3 items-center">
				<select
					value={formData.platform || 'AI_STUDIO'}
					onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'AI_STUDIO' | 'VERTEX_API' })}
					className="w-full bg-white/10 border border-white/15 px-2.5 py-1.5 rounded-xl text-xs font-medium text-on-surface focus:border-primary/60 focus:outline-none appearance-none shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
				>
					<option value="AI_STUDIO">AI Studio</option>
					<option value="VERTEX_API">Vertex API</option>
				</select>
				<label className="flex items-center gap-1.5 cursor-pointer bg-white/10 px-2 py-1.5 rounded-xl border border-white/15 hover:bg-white/20 transition-colors whitespace-nowrap shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]">
					<input
						type="checkbox"
						checked={formData.isActive !== false}
						onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
						className="accent-primary w-3.5 h-3.5"
					/>
					<span className="text-xs font-bold text-on-surface-variant">KÍCH HOẠT</span>
				</label>
			</div>

			<div className="grid grid-cols-3 gap-2">
				<div className="bg-surface-container-high px-2 py-1.5 rounded-lg">
					<label className="text-[9px] font-bold text-on-surface-variant/70 mb-0.5 block">RPD (Ngày)</label>
					<input
						type="number"
						value={formData.rpdLimit || 0}
						onChange={(e) => setFormData({ ...formData, rpdLimit: parseInt(e.target.value) || 0 })}
						className="w-full bg-transparent outline-none text-xs font-bold"
					/>
				</div>
				<div className="bg-surface-container-high px-2 py-1.5 rounded-lg">
					<label className="text-[9px] font-bold text-on-surface-variant/70 mb-0.5 block">RPM (Phút)</label>
					<input
						type="number"
						value={formData.rpmLimit || 0}
						onChange={(e) => setFormData({ ...formData, rpmLimit: parseInt(e.target.value) || 0 })}
						className="w-full bg-transparent outline-none text-xs font-bold"
					/>
				</div>
				<div className="bg-surface-container-high px-2 py-1.5 rounded-lg">
					<label className="text-[9px] font-bold text-on-surface-variant/70 mb-0.5 block">TPM / Phút</label>
					<input
						type="number"
						value={formData.tpmLimit || 0}
						onChange={(e) => setFormData({ ...formData, tpmLimit: parseInt(e.target.value) || 0 })}
						className="w-full bg-transparent outline-none text-xs font-bold"
					/>
				</div>
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

export function QuotaItemCard({
	quota,
	isEditing,
	formData,
	setFormData,
	onSave,
	onCancel,
	onEdit,
	onDelete,
}: {
	quota: AIQuota;
	isEditing: boolean;
	formData: Partial<AIQuota>;
	setFormData: (d: Partial<AIQuota>) => void;
	onSave: () => void;
	onCancel: () => void;
	onEdit: (q: AIQuota) => void;
	onDelete: (id: string) => void;
}) {
	if (isEditing) {
		return <QuotaEditor formData={formData} setFormData={setFormData} onSave={onSave} onCancel={onCancel} />;
	}

	const modelTitle = formatModelDisplayName(quota.model) || quota.model;

	return (
		<div
			className={`p-3 rounded-2xl border transition-all ${
				quota.isActive ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]' : 'border-white/10 bg-white/[0.02] opacity-60'
			}`}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-bold text-sm text-on-surface leading-tight truncate pt-0.5">{modelTitle}</h3>
						{!quota.isActive && (
							<span className="text-[9px] bg-outline-variant/20 px-1.5 py-0.5 rounded text-on-surface-variant font-medium shrink-0">
								Tắt
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 flex-wrap mt-2.5">
						<span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
							RPD: {quota.rpdLimit > 0 ? quota.rpdLimit.toLocaleString() : '∞'}
						</span>
						<span className="text-[10px] font-bold bg-surface-container-highest text-on-surface px-2 py-1 rounded-md border border-outline-variant/20">
							RPM: {quota.rpmLimit > 0 ? quota.rpmLimit.toLocaleString() : '∞'}
						</span>
						<span className="text-[10px] font-bold bg-surface-container-highest text-on-surface px-2 py-1 rounded-md border border-outline-variant/20">
							TPM: {quota.tpmLimit > 0 ? quota.tpmLimit.toLocaleString() : '∞'}
						</span>
					</div>
				</div>
				<div className="flex gap-1 shrink-0 bg-surface-container-high rounded-xl p-0.5">
					<button
						onClick={() => onEdit(quota)}
						className="p-2 rounded-lg text-primary hover:bg-surface-container-highest transition-colors"
					>
						<Edit2 size={12} />
					</button>
					<button
						onClick={() => onDelete(quota._id)}
						className="p-2 rounded-lg text-error hover:bg-surface-container-highest transition-colors"
					>
						<Trash2 size={12} />
					</button>
				</div>
			</div>
		</div>
	);
}
