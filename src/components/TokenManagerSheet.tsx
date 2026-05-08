import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, ExternalLink, RefreshCw, KeyRound, PlayCircle, PauseCircle } from 'lucide-react';
import { api, AIToken } from '../lib/api';
import { showToast } from './Toast';

export function TokenManagerSheet({ onClose, isEmbedded = false }: { onClose?: () => void, isEmbedded?: boolean }) {
  const [tokens, setTokens] = useState<AIToken[]>([]);
  const [activeTab, setActiveTab] = useState<'VERTEX_API' | 'AI_STUDIO'>('VERTEX_API');
  const [isLoading, setIsLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AIToken>>({});

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const res = await api.getTokens(activeTab);
      if (res) {
        setTokens(res.tokens || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [activeTab]);

  const handleEdit = (t: AIToken) => {
    setEditingId(t._id);
    setFormData(t);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá token này?')) return;
    try {
       await api.deleteToken(id);
       showToast('Đã xoá', 'success');
       fetchTokens();
    } catch(e) {
       showToast('Lỗi xoá', 'error');
    }
  };

  const handleToggleStatus = async (t: AIToken) => {
    try {
      const newStatus = t.status === 'active' ? 'paused' : 'active';
      await api.updateToken(t._id, { status: newStatus });
      showToast(`Đã ${newStatus === 'active' ? 'kích hoạt' : 'tạm dừng'} token`, 'success');
      fetchTokens();
    } catch(e) {
      showToast('Lỗi cập nhật trạng thái', 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || (!formData.configAI && editingId === 'new')) {
      showToast('Vui lòng điền đủ Tên, Email và Config', 'error');
      return;
    }
    
    try {
      // try parsing configAI if it's a string
      let parsedConfig = formData.configAI;
      if (typeof parsedConfig === 'string') {
        try {
          parsedConfig = JSON.parse(parsedConfig);
        } catch {
          showToast('Config AI không phải là JSON hợp lệ', 'error');
          return;
        }
      }

      const submissionData = {
        ...formData,
        configAI: parsedConfig
      };

      if (editingId === 'new') {
        await api.createToken(submissionData as Partial<AIToken>);
      } else {
        await api.updateToken(editingId!, submissionData as Partial<AIToken>);
      }
      showToast('Đã lưu', 'success');
      setEditingId(null);
      fetchTokens();
    } catch(e) {
      showToast('Lỗi khi lưu', 'error');
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
      configAI: {}
    });
  };

  const content = (
      <div className={`relative bg-surface text-on-surface w-full flex flex-col ${!isEmbedded ? 'flex-1 overflow-hidden border border-outline-variant/30 h-[85vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-[600px] z-10' : 'h-full max-w-full'}`}>
        
        {/* Header */}
        <div className="flex-shrink-0 p-3 sm:p-5 border-b border-outline-variant/10 flex flex-col gap-3 bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold font-serif text-primary">Quản lý API Token</h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <button title="Thêm Token Mới" onClick={startCreate} disabled={editingId === 'new'} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50">
                <Plus size={16} />
              </button>
              <button title="Làm Mới" onClick={fetchTokens} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              {!isEmbedded && onClose && (
               <button title="Đóng" onClick={onClose} className="p-2 sm:p-2.5 bg-surface rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                  <X size={16} />
                </button>
              )}
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
          <div className="p-3 sm:p-5 flex flex-col gap-2.5 max-w-[600px] mx-auto w-full">
            
            {editingId === 'new' && (
              <TokenEditor formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} isNew={true} />
            )}

            {tokens.map(t => (
              <div key={t._id}>
                {editingId === t._id ? (
                  <TokenEditor formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} isNew={false} />
                ) : (
                  <div className={`p-3.5 rounded-2xl border transition-all ${t.status === 'active' ? 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/30' : 'border-outline-variant/10 bg-surface-container-lowest/50 opacity-60'}`}>
                    <div className="flex justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-on-surface leading-tight truncate">{t.name}</h3>
                          {t.status === 'active' ? (
                            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">ACTIVE</span>
                          ) : t.status === 'banned' ? (
                            <span className="text-[9px] bg-error/20 text-error px-1.5 py-0.5 rounded font-medium shrink-0">BANNED</span>
                          ) : (
                            <span className="text-[9px] bg-outline-variant/20 px-1.5 py-0.5 rounded text-on-surface-variant font-medium shrink-0">PAUSED</span>
                          )}
                        </div>
                        <div className="text-[10px] text-on-surface-variant/80 mt-1 font-medium truncate flex gap-2">
                           {t.email}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 bg-surface-container-high rounded-xl p-0.5 h-fit">
                        {t.status !== 'banned' && (
                            <button onClick={() => handleToggleStatus(t)} className={`p-2 rounded-lg transition-colors ${t.status === 'active' ? 'text-warning hover:bg-warning/10' : 'text-primary hover:bg-primary/10'}`}>
                              {t.status === 'active' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                            </button>
                        )}
                        <button onClick={() => handleEdit(t)} className="p-2 rounded-lg text-primary hover:bg-surface-container-highest transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(t._id)} className="p-2 rounded-lg text-error hover:bg-surface-container-highest transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    

                    {/* Usage list */}
                    {t.modelList && t.modelList.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {t.modelList.map(m => (
                          <div key={m.model} className="bg-surface-container flex items-center justify-between p-2 rounded-lg">
                            <span className="text-[10px] font-bold truncate max-w-[120px]" title={m.model}>
                              {m.model.replace(/^gemini-/, '').replace(/-/g, ' ').toUpperCase()}
                            </span>
                            <div className="flex gap-3 text-[9px] font-medium text-on-surface-variant/80">
                               {m.rpdLimit > 0 && <span>RPD: {m.usageToday?.rpd || 0}/{m.rpdLimit} ({m.usageToday?.rpdPercent || 0}%)</span>}
                               {m.rpmLimit > 0 && <span>RPM: {m.usageToday?.rpm || 0}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {tokens.length === 0 && editingId !== 'new' && (
              <div className="text-center py-12 text-on-surface-variant">
                <p className="text-sm border border-dashed border-outline-variant/30 p-4 rounded-xl">Chưa có token nào được cấu hình cho tab này</p>
              </div>
            )}
          </div>
        </div>
      </div>
  );

  if (isEmbedded) {
    return <div className="flex flex-col w-full h-full bg-surface">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      {content}
    </div>
  );
}

function TokenEditor({ formData, setFormData, onSave, onCancel, isNew }: { formData: Partial<AIToken>, setFormData: (d: Partial<AIToken>) => void, onSave: () => void, onCancel: () => void, isNew: boolean }) {
  const configAI = typeof formData.configAI === 'string' 
    ? (() => { try { return JSON.parse(formData.configAI); } catch { return {}; } })() 
    : (formData.configAI || {});

  return (
    <div className="bg-surface-container-lowest p-3 rounded-xl border border-primary/40 shadow-sm space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <input 
          autoFocus={isNew}
          type="text" 
          value={formData.name || ''} 
          onChange={e => setFormData({...formData, name: e.target.value})}
          placeholder="Tên gợi nhớ"
          className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-bold focus:border-primary focus:outline-none" 
        />
      </div>

      <div>
        <input 
          type="email" 
          value={formData.email || ''} 
          onChange={e => setFormData({...formData, email: e.target.value})}
          placeholder="Email tài khoản"
          className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none" 
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3 items-center">
        <select 
          value={formData.status || 'active'} 
          onChange={e => setFormData({...formData, status: e.target.value as any})}
          className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:border-primary focus:outline-none appearance-none"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="banned">Banned</option>
        </select>
        <input 
           type="text" 
           value={formData.model || '*'} 
           onChange={e => setFormData({...formData, model: e.target.value})}
           placeholder="Model scope (vd: *)"
           className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:border-primary focus:outline-none" 
         />
      </div>

      <div className="pt-2 border-t border-outline-variant/10">
        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">
          {formData.platform === 'AI_STUDIO' ? 'AI Studio Configuration' : 'Vertex API Configuration'}
        </label>
        {formData.platform === 'AI_STUDIO' ? (
          <input 
            type="text" 
            value={configAI.apiKey || ''} 
            onChange={e => setFormData({...formData, configAI: { ...configAI, apiKey: e.target.value }})}
            placeholder="API Key"
            className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none font-mono" 
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input 
              type="text" 
              value={configAI.project || ''} 
              onChange={e => setFormData({...formData, configAI: { ...configAI, vertexai: true, project: e.target.value }})}
              placeholder="GCP Project ID"
              className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none font-mono" 
            />
            <input 
              type="text" 
              value={configAI.location || ''} 
              onChange={e => setFormData({...formData, configAI: { ...configAI, vertexai: true, location: e.target.value }})}
              placeholder="Location (vd: global)"
              className="w-full bg-surface-container-low border border-outline-variant/30 px-2.5 py-1.5 rounded-lg text-sm font-medium focus:border-primary focus:outline-none font-mono" 
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1 border-t border-outline-variant/10 mt-2 pt-3">
        <button onClick={onCancel} className="flex-1 py-1.5 sm:py-2 bg-surface-container-high rounded-lg text-xs font-bold hover:bg-surface-container-highest transition-colors">Huỷ Bỏ</button>
        <button onClick={onSave} className="flex-1 py-1.5 sm:py-2 bg-primary text-on-primary rounded-lg text-xs font-bold flex animate-none items-center justify-center gap-1 hover:bg-primary-fixed transition-colors"><Check size={14} /> Lưu Lại</button>
      </div>
    </div>
  );
}
