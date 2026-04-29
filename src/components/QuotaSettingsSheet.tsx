import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { api, AIQuota } from '../lib/api';
import { showToast } from './Toast';

export function QuotaSettingsSheet({ onClose, quotas: initialQuotas = [], onQuotasUpdated = () => {} }: { onClose: () => void, quotas?: AIQuota[], onQuotasUpdated?: () => void }) {
  const [quotas, setQuotas] = useState<AIQuota[]>(initialQuotas);
  const [activeTab, setActiveTab] = useState<'VERTEX_API' | 'AI_STUDIO'>('VERTEX_API');
  const [isLoading, setIsLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AIQuota>>({});

  const fetchQuotas = async () => {
    setIsLoading(true);
    try {
      const res = await api.getQuota();
      if (res) {
        setQuotas(res.availableModels || []);
        onQuotasUpdated();
      }
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
       await api.deleteQuota(id);
       showToast('Đã xoá', 'success');
       fetchQuotas();
    } catch(e) {
       showToast('Lỗi xoá', 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.model || !formData.platform) {
      showToast('Vui lòng điền đủ tên model và platform', 'error');
      return;
    }
    
    try {
      if (editingId === 'new') {
        await api.createQuota(formData as Partial<AIQuota>);
      } else {
        await api.updateQuota(editingId!, formData as Partial<AIQuota>);
      }
      showToast('Đã lưu', 'success');
      setEditingId(null);
      fetchQuotas();
    } catch(e) {
      showToast('Lỗi khi lưu', 'error');
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

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      
      {/* Container */}
      <div className="relative bg-surface border border-outline-variant/30 text-on-surface w-full max-w-[600px] h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl z-10 overflow-hidden">
        
        {/* Header */}
        <div className="flex-shrink-0 p-3 sm:p-5 border-b border-outline-variant/10 flex flex-col gap-3 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold font-serif text-primary">Quản lý AI Models</h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <button title="Thêm Model Mới" onClick={startCreate} disabled={editingId === 'new'} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50">
                <Plus size={16} />
              </button>
              <button title="Làm Mới" onClick={fetchQuotas} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button title="Đóng" onClick={onClose} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex bg-surface-container-highest p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('VERTEX_API')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'VERTEX_API' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >VERTEX API</button>
            <button 
              onClick={() => setActiveTab('AI_STUDIO')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'AI_STUDIO' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >AI STUDIO</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar w-full bg-surface">
          <div className="p-3 sm:p-5 flex flex-col gap-2.5">
            
            {editingId === 'new' && (
              <QuotaEditor formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} />
            )}

            {quotas.filter(q => q.platform === activeTab).map(q => (
              <div key={q._id}>
                {editingId === q._id ? (
                  <QuotaEditor formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className={`p-3.5 rounded-2xl border transition-all ${q.isActive ? 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/30' : 'border-outline-variant/10 bg-surface-container-lowest/50 opacity-60'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-on-surface leading-tight truncate pt-0.5">
                            {q.model.replace(/^gemini-/, '').replace(/-/g, ' ').toUpperCase() || q.model}
                          </h3>
                          {!q.isActive && <span className="text-[9px] bg-outline-variant/20 px-1.5 py-0.5 rounded text-on-surface-variant font-medium shrink-0">Tắt</span>}
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
                        <button onClick={() => handleEdit(q)} className="p-2 rounded-lg text-primary hover:bg-surface-container-highest transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(q._id)} className="p-2 rounded-lg text-error hover:bg-surface-container-highest transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {quotas.filter(q => q.platform === activeTab).length === 0 && editingId !== 'new' && (
              <div className="text-center py-12 text-on-surface-variant">
                <p className="text-sm border border-dashed border-outline-variant/30 p-4 rounded-xl">Chưa có model AI nào được cấu hình cho tab này</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotaEditor({ formData, setFormData, onSave, onCancel }: { formData: Partial<AIQuota>, setFormData: (d: Partial<AIQuota>) => void, onSave: () => void, onCancel: () => void }) {
  return (
    <div className="bg-surface-container-lowest p-3 rounded-xl border border-primary/40 shadow-sm space-y-3">
      <div>
        <input 
          autoFocus
          type="text" 
          value={formData.model || ''} 
          onChange={e => setFormData({...formData, model: e.target.value})}
          placeholder="Tên Model (vd: gemini-1.5-flash)"
          className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-bold focus:border-primary focus:outline-none" 
        />
      </div>
      
      <div className="grid grid-cols-[1fr_min-content] gap-3 items-center">
        <select 
          value={formData.platform || 'AI_STUDIO'} 
          onChange={e => setFormData({...formData, platform: e.target.value as any})}
          className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:border-primary focus:outline-none appearance-none"
        >
          <option value="AI_STUDIO">AI Studio</option>
          <option value="VERTEX_API">Vertex API</option>
        </select>
        <label className="flex items-center gap-1.5 cursor-pointer bg-surface-container-high px-2 py-1.5 rounded-lg border border-transparent hover:border-outline-variant/20 transition-colors whitespace-nowrap">
          <input type="checkbox" checked={formData.isActive !== false} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="accent-primary w-3.5 h-3.5" />
          <span className="text-xs font-bold text-on-surface-variant">KÍCH HOẠT</span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-container-high px-2 py-1.5 rounded-lg">
           <label className="text-[9px] font-bold text-on-surface-variant/70 mb-0.5 block">RPD (Ngày)</label>
           <input type="number" value={formData.rpdLimit || 0} onChange={e => setFormData({...formData, rpdLimit: parseInt(e.target.value) || 0})} className="w-full bg-transparent outline-none text-xs font-bold" />
        </div>
        <div className="bg-surface-container-high px-2 py-1.5 rounded-lg">
           <label className="text-[9px] font-bold text-on-surface-variant/70 mb-0.5 block">RPM (Phút)</label>
           <input type="number" value={formData.rpmLimit || 0} onChange={e => setFormData({...formData, rpmLimit: parseInt(e.target.value) || 0})} className="w-full bg-transparent outline-none text-xs font-bold" />
        </div>
        <div className="bg-surface-container-high px-2 py-1.5 rounded-lg">
           <label className="text-[9px] font-bold text-on-surface-variant/70 mb-0.5 block">TPM / Phút</label>
           <input type="number" value={formData.tpmLimit || 0} onChange={e => setFormData({...formData, tpmLimit: parseInt(e.target.value) || 0})} className="w-full bg-transparent outline-none text-xs font-bold" />
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-outline-variant/10 mt-2 pt-3">
        <button onClick={onCancel} className="flex-1 py-1.5 sm:py-2 bg-surface-container-high rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors">Huỷ Bỏ</button>
        <button onClick={onSave} className="flex-1 py-1.5 sm:py-2 bg-primary text-on-primary rounded-lg text-xs font-bold flex animate-none items-center justify-center gap-1 hover:bg-primary-fixed transition-colors"><Check size={14} /> Lưu Lại</button>
      </div>
    </div>
  );
}
