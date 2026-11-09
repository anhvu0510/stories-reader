import React, { useState, useEffect, useCallback, useRef } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { AIRepository } from '@/repositories/AIRepository';
import { useToastStore } from '@/stores/useToastStore';

import { QuotaEditor, QuotaHeader, QuotaItemCard } from './quota-settings/QuotaSettingsComponents';

import type { AIQuota } from '@/shared/types';

function useQuotaManagerState(initialQuotas: AIQuota[], onQuotasUpdated: () => void) {
	const [quotas, setQuotas] = useState<AIQuota[]>(initialQuotas);
	const [activeTab, setActiveTab] = useState<'VERTEX_API' | 'AI_STUDIO'>('AI_STUDIO');
	const [isLoading, setIsLoading] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<AIQuota>>({});

	const showToast = useToastStore((state) => state.showToast);
	const onQuotasUpdatedRef = useRef(onQuotasUpdated);
	onQuotasUpdatedRef.current = onQuotasUpdated;

	const fetchQuotas = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await AIRepository.getQuotas();
			if (res) {
				setQuotas(res.availableModels || []);
				onQuotasUpdatedRef.current();
			}
		} catch {
			showToast('Lỗi khi tải danh sách quota AI models', 'error');
		} finally {
			setIsLoading(false);
		}
	}, [showToast]);

	useEffect(() => {
		if (initialQuotas.length === 0) {
			fetchQuotas();
		}
	}, [fetchQuotas, initialQuotas.length]);

	const handleDelete = async (id: string) => {
		if (!window.confirm('Bạn có chắc chắn muốn xoá model này?')) return;
		try {
			await AIRepository.deleteQuota(id);
			showToast('Đã xoá model', 'success');
			fetchQuotas();
		} catch {
			showToast('Lỗi khi xoá model', 'error');
		}
	};

	const handleSave = async () => {
		if (!formData.model || !formData.platform) {
			showToast('Vui lòng điền đủ tên model và platform', 'error');
			return;
		}
		try {
			if (editingId === 'new') {
				await AIRepository.createQuota(formData);
			} else {
				await AIRepository.updateQuotaConfig(formData);
			}
			showToast('Đã lưu model thành công', 'success');
			setEditingId(null);
			fetchQuotas();
		} catch {
			showToast('Lỗi khi lưu model', 'error');
		}
	};

	const startCreate = () => {
		setEditingId('new');
		setFormData({
			model: '',
			platform: 'AI_STUDIO',
			rpmLimit: 15,
			tpmLimit: 1000000,
			rpdLimit: 1500,
			isActive: true,
		});
	};

	return {
		quotas,
		activeTab,
		setActiveTab,
		isLoading,
		editingId,
		setEditingId,
		formData,
		setFormData,
		fetchQuotas,
		handleDelete,
		handleSave,
		startCreate,
	};
}

export function QuotaSettingsSheet({
	onClose,
	quotas: initialQuotas = [],
	onQuotasUpdated = () => {},
	isEmbedded = false,
}: {
	onClose?: () => void;
	quotas?: AIQuota[];
	onQuotasUpdated?: () => void;
	isEmbedded?: boolean;
}) {
	const {
		quotas,
		activeTab,
		setActiveTab,
		isLoading,
		editingId,
		setEditingId,
		formData,
		setFormData,
		fetchQuotas,
		handleDelete,
		handleSave,
		startCreate,
	} = useQuotaManagerState(initialQuotas, onQuotasUpdated);

	const filteredQuotas = quotas.filter((q) => q.platform === activeTab);

	const content = (
		<div
			className={`relative bg-surface/50 dark:bg-surface/50 backdrop-blur-xl text-on-surface w-full flex flex-col ${isEmbedded ? 'h-full max-w-full bg-transparent' : 'flex-1 overflow-hidden border border-white/20 h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-[600px] z-10'}`}
		>
			<QuotaHeader
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				onStartCreate={startCreate}
				isCreating={editingId === 'new'}
				onRefresh={fetchQuotas}
				isLoading={isLoading}
				onClose={onClose}
				isEmbedded={isEmbedded}
			/>

			<div className="flex-1 overflow-y-auto hide-scrollbar w-full bg-transparent">
				<div className="p-1 sm:p-2 flex flex-col gap-2.5 max-w-[600px] mx-auto w-full">
					{editingId === 'new' && (
						<QuotaEditor formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} />
					)}

					{filteredQuotas.map((q) => (
						<div key={q._id}>
							<QuotaItemCard
								quota={q}
								isEditing={editingId === q._id}
								formData={formData}
								setFormData={setFormData}
								onSave={handleSave}
								onCancel={() => setEditingId(null)}
								onEdit={(item) => {
									setEditingId(item._id);
									setFormData(item);
								}}
								onDelete={handleDelete}
							/>
						</div>
					))}

					{filteredQuotas.length === 0 && editingId !== 'new' && (
						<div className="text-center py-12 text-on-surface-variant">
							<p className="text-sm border border-dashed border-outline-variant/30 p-4 rounded-xl">
								Chưa có model AI nào được cấu hình cho tab này
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);

	if (isEmbedded) {
		return <div className="flex flex-col w-full h-full bg-transparent">{content}</div>;
	}

	return (
		<BottomSheet isOpen={true} onClose={onClose || (() => {})} ariaLabel="Cấu hình Hạn mức Quota" showDragHandle={false}>
			{content}
		</BottomSheet>
	);
}
