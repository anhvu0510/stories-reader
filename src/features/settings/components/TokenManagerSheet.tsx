import React, { useState, useEffect, useCallback } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { AIRepository } from '@/repositories/AIRepository';
import { useToastStore } from '@/stores/useToastStore';

import { TokenEditor, TokenHeader, TokenItemCard } from './token-manager/TokenManagerComponents';

import type { AIToken } from '@/shared/types';

function useTokenManagerState() {
	const [tokens, setTokens] = useState<AIToken[]>([]);
	const [activeTab, setActiveTab] = useState<'VERTEX_API' | 'AI_STUDIO'>('VERTEX_API');
	const [isLoading, setIsLoading] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<AIToken>>({});

	const showToast = useToastStore((state) => state.showToast);

	const fetchTokens = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await AIRepository.getTokens(activeTab);
			if (res) {
				setTokens(res.tokens || []);
			}
		} catch {
			showToast('Lỗi khi tải danh sách token API', 'error');
		} finally {
			setIsLoading(false);
		}
	}, [activeTab, showToast]);

	useEffect(() => {
		fetchTokens();
	}, [fetchTokens]);

	const handleDelete = async (id: string) => {
		if (!window.confirm('Bạn có chắc chắn muốn xoá token này?')) return;
		try {
			await AIRepository.deleteToken(id);
			showToast('Đã xoá token', 'success');
			fetchTokens();
		} catch {
			showToast('Lỗi khi xoá token', 'error');
		}
	};

	const handleToggleStatus = async (t: AIToken) => {
		try {
			const newStatus = t.status === 'active' ? 'paused' : 'active';
			await AIRepository.updateToken(t._id, { status: newStatus });
			showToast(`Đã ${newStatus === 'active' ? 'kích hoạt' : 'tạm dừng'} token`, 'success');
			fetchTokens();
		} catch {
			showToast('Lỗi khi cập nhật trạng thái token', 'error');
		}
	};

	const handleSave = async () => {
		if (!formData.name || !formData.platform) {
			showToast('Vui lòng điền đủ tên gợi nhớ và platform', 'error');
			return;
		}
		try {
			if (editingId === 'new') {
				await AIRepository.createToken(formData);
			} else {
				await AIRepository.updateToken(editingId as string, formData);
			}
			showToast('Đã lưu token thành công', 'success');
			setEditingId(null);
			fetchTokens();
		} catch {
			showToast('Lỗi khi lưu token', 'error');
		}
	};

	const startCreate = () => {
		setEditingId('new');
		setFormData({
			name: '',
			email: '',
			platform: activeTab,
			model: '*',
			status: 'active',
			priority: 0,
			configAI: {},
		});
	};

	return {
		tokens,
		activeTab,
		setActiveTab,
		isLoading,
		editingId,
		setEditingId,
		formData,
		setFormData,
		fetchTokens,
		handleDelete,
		handleToggleStatus,
		handleSave,
		startCreate,
	};
}

export function TokenManagerSheet({ onClose, isEmbedded = false }: { onClose?: () => void; isEmbedded?: boolean }) {
	const {
		tokens,
		activeTab,
		setActiveTab,
		isLoading,
		editingId,
		setEditingId,
		formData,
		setFormData,
		fetchTokens,
		handleDelete,
		handleToggleStatus,
		handleSave,
		startCreate,
	} = useTokenManagerState();

	const content = (
		<div
			className={`relative bg-surface/50 dark:bg-surface/50 backdrop-blur-xl text-on-surface w-full flex flex-col ${isEmbedded ? 'h-full max-w-full bg-transparent' : 'flex-1 overflow-hidden border border-white/20 h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-[600px] z-10'}`}
		>
			<TokenHeader
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				onStartCreate={startCreate}
				isCreating={editingId === 'new'}
				onRefresh={fetchTokens}
				isLoading={isLoading}
				onClose={onClose}
				isEmbedded={isEmbedded}
			/>

			<div className="flex-1 overflow-y-auto hide-scrollbar w-full bg-transparent">
				<div className="p-1 sm:p-2 flex flex-col gap-2.5 max-w-[600px] mx-auto w-full">
					{editingId === 'new' && (
						<TokenEditor
							formData={formData}
							setFormData={setFormData}
							onSave={handleSave}
							onCancel={() => setEditingId(null)}
							isNew={true}
						/>
					)}

					{tokens.map((t) => (
						<div key={t._id}>
							<TokenItemCard
								token={t}
								isEditing={editingId === t._id}
								formData={formData}
								setFormData={setFormData}
								onSave={handleSave}
								onCancel={() => setEditingId(null)}
								onToggleStatus={handleToggleStatus}
								onEdit={(item) => {
									setEditingId(item._id);
									setFormData(item);
								}}
								onDelete={handleDelete}
							/>
						</div>
					))}

					{tokens.length === 0 && editingId !== 'new' && (
						<div className="text-center py-12 text-on-surface-variant">
							<p className="text-sm border border-dashed border-outline-variant/30 p-4 rounded-xl">
								Chưa có token nào được cấu hình cho tab này
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
		<BottomSheet isOpen={true} onClose={onClose || (() => {})} ariaLabel="Quản lý API Tokens" showDragHandle={false}>
			{content}
		</BottomSheet>
	);
}
