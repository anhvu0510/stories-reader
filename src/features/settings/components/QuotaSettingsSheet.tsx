import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, RefreshCw } from 'lucide-react';
import { AIRepository } from '../../../repositories/AIRepository';
import { AIQuota } from '../../../shared/types';
import { useToastStore } from '../../../stores/useToastStore';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

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
  const [quotas, setQuotas] = useState<AIQuota[]>(initialQuotas);
  const [activeTab, setActiveTab] = useState<'VERTEX_API' | 'AI_STUDIO'>('VERTEX_API');
  const [isLoading, setIsLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AIQuota>>({});

  const showToast = useToastStore((state) => state.showToast);

  const fetchQuotas = async () => {
    setIsLoading(true);
    try {
      const res = await AIRepository.getQuotas();
      if (res) {
        setQuotas(res.availableModels || []);
        onQuotasUpdated();
      }
    } catch {
      showToast('Lỗi khi tải danh sách quota AI models', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuotas.length === 0) {
      fetchQuotas();
    }
  }, []);

  const handleEdit = (q: AIQuota) => {
    setEditingId(q._id);
    setFormData(q);
  };

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

  const content = (
    <div
      className={`relative bg-surface/50 dark:bg-surface/50 backdrop-blur-xl text-on-surface w-full flex flex-col ${
        !isEmbedded
          ? 'flex-1 overflow-hidden border border-white/20 h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-[600px] z-10'
          : 'h-full max-w-full bg-transparent'
      }`}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-white/10 flex flex-col gap-3 bg-transparent rounded-2xl mb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-primary">Quản lý AI Models</h2>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              title="Thêm Model Mới"
              onClick={startCreate}
              disabled={editingId === 'new'}
              className="p-1.5 sm:p-2 bg-white/10 border border-white/20 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
            <button
              title="Làm Mới"
              onClick={fetchQuotas}
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
        <div className="flex bg-white/10 p-1 rounded-xl border border-white/15">
          <button
            onClick={() => setActiveTab('VERTEX_API')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'VERTEX_API'
                ? 'bg-primary/20 text-primary border border-primary/50 shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            VERTEX API
          </button>
          <button
            onClick={() => setActiveTab('AI_STUDIO')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'AI_STUDIO'
                ? 'bg-primary/20 text-primary border border-primary/50 shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            AI STUDIO
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar w-full bg-transparent">
        <div className="p-1 sm:p-2 flex flex-col gap-2.5 max-w-[600px] mx-auto w-full">
          {editingId === 'new' && (
            <QuotaEditor
              formData={formData}
              setFormData={setFormData}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          )}

          {quotas
            .filter((q) => q.platform === activeTab)
            .map((q) => (
              <div key={q._id}>
                {editingId === q._id ? (
                  <QuotaEditor
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    className={`p-3 rounded-2xl border transition-all ${
                      q.isActive
                        ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                        : 'border-white/10 bg-white/[0.02] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-on-surface leading-tight truncate pt-0.5">
                            {q.model.replace(/^gemini-/, '').replace(/-/g, ' ').toUpperCase() || q.model}
                          </h3>
                          {!q.isActive && (
                            <span className="text-[9px] bg-outline-variant/20 px-1.5 py-0.5 rounded text-on-surface-variant font-medium shrink-0">
                              Tắt
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-2.5">
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
                            RPD: {q.rpdLimit > 0 ? q.rpdLimit.toLocaleString() : '∞'}
                          </span>
                          <span className="text-[10px] font-bold bg-surface-container-highest text-on-surface px-2 py-1 rounded-md border border-outline-variant/20">
                            RPM: {q.rpmLimit > 0 ? q.rpmLimit.toLocaleString() : '∞'}
                          </span>
                          <span className="text-[10px] font-bold bg-surface-container-highest text-on-surface px-2 py-1 rounded-md border border-outline-variant/20">
                            TPM: {q.tpmLimit > 0 ? q.tpmLimit.toLocaleString() : '∞'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 bg-surface-container-high rounded-xl p-0.5">
                        <button
                          onClick={() => handleEdit(q)}
                          className="p-2 rounded-lg text-primary hover:bg-surface-container-highest transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(q._id)}
                          className="p-2 rounded-lg text-error hover:bg-surface-container-highest transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {quotas.filter((q) => q.platform === activeTab).length === 0 && editingId !== 'new' && (
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

  useBodyScrollLock(!isEmbedded);

  if (isEmbedded) {
    return <div className="flex flex-col w-full h-full bg-transparent">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[99000] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-none">
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} onTouchMove={(e) => e.preventDefault()} />
      {content}
    </div>
  );
}

function QuotaEditor({
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
          onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
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
