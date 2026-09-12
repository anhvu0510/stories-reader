import React, { useState } from 'react';
import { Server, Plus, RefreshCw, Check, Trash2, Edit3, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '../../../stores/useAppStore';
import { useToastStore } from '../../../stores/useToastStore';
import { apiClient } from '../../../services/apiClient';
import { SettingsRepository } from '../../../repositories/SettingsRepository';
import { ApiDomain } from '../../../shared/types';

export function ServerTab() {
  const { domains, activeDomainId, isOfflineMode, setOfflineMode, setDomains, setActiveDomainId, addDomain, removeDomain } = useAppStore();
  const showToast = useToastStore((state) => state.showToast);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [domainName, setDomainName] = useState('');
  const [domainUrl, setDomainUrl] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const handleFetchDomains = async () => {
    setIsFetching(true);
    try {
      const dataAPI = await SettingsRepository.getSettings('stories.ui.domain');
      const data = dataAPI?.value ?? [];

      if (Array.isArray(data)) {
        const fetched: ApiDomain[] = data.map((item: any) => ({
          id: String(item.id),
          name: item.name || '',
          url: item.url || '',
        }));

        let newDomains: ApiDomain[] = [];
        if (domains.length > 0) {
          newDomains.push(domains[0]);
        }
        for (const fd of fetched) {
          if (fd.id && fd.url && fd.id !== newDomains[0]?.id) {
            newDomains.push(fd);
          }
        }
        setDomains(newDomains);
        showToast('Đã tải và cập nhật danh sách máy chủ', 'success');
      } else {
        showToast('Dữ liệu máy chủ không hợp lệ', 'error');
      }
    } catch {
      showToast('Lỗi khi tải danh sách máy chủ', 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelectDomain = async (id: string) => {
    setTestingId(id);
    const domain = domains.find((d) => d.id === id);
    if (!domain) {
      setTestingId(null);
      return;
    }

    try {
      const res = await fetch(domain.url, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        setActiveDomainId(id);
        showToast('Đã kết nối với máy chủ', 'success');
        window.location.reload();
      } else {
        showToast('Không thể kết nối đến máy chủ', 'error');
      }
    } catch {
      showToast('Không thể kết nối đến máy chủ', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleSave = () => {
    if (!domainUrl.trim()) return;

    if (editingId) {
      const updated = domains.map((d) =>
        d.id === editingId ? { ...d, name: domainName.trim() || 'Server', url: domainUrl.trim() } : d
      );
      setDomains(updated);
      showToast('Cập nhật máy chủ thành công', 'success');
    } else {
      const newDomain: ApiDomain = {
        id: Date.now().toString(),
        name: domainName.trim() || 'Server Mặc định',
        url: domainUrl.trim(),
      };
      addDomain(newDomain);
      showToast('Thêm máy chủ mới thành công', 'success');
    }

    setShowForm(false);
    setEditingId(null);
    setDomainName('');
    setDomainUrl('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
          <Server size={16} className="text-primary" /> Danh sách Máy chủ API
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextState = !isOfflineMode;
              setOfflineMode(nextState);
              showToast(
                nextState
                  ? 'Đã bật chế độ Ngoại tuyến (Offline Mode)'
                  : 'Đã kết nối lại chế độ Trực tuyến (Online Mode)',
                nextState ? 'info' : 'success'
              );
            }}
            className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium ${
              isOfflineMode
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
            }`}
            title={isOfflineMode ? 'Đang Ngoại tuyến (Nhấp để bật Online)' : 'Đang Trực tuyến (Nhấp để bật Offline)'}
          >
            {isOfflineMode ? <WifiOff size={14} /> : <Wifi size={14} />}
            <span className="hidden sm:inline">{isOfflineMode ? 'Offline' : 'Online'}</span>
          </button>
          <button
            onClick={handleFetchDomains}
            disabled={isFetching}
            className="p-1.5 rounded-xl bg-white/10 border border-white/15 text-on-surface-variant hover:text-on-surface hover:bg-white/20 transition-all text-xs flex items-center gap-1 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]"
            title="Đồng bộ từ hệ thống"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Đồng bộ</span>
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setDomainName('');
              setDomainUrl('');
              setShowForm(true);
            }}
            className="p-1.5 rounded-xl bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 transition-all text-xs flex items-center gap-1 font-bold shadow-xs"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="text-xs font-bold text-on-surface">
            {editingId ? 'Chỉnh sửa Máy chủ' : 'Thêm Máy chủ mới'}
          </div>
          <input
            type="text"
            placeholder="Tên máy chủ (ví dụ: Server Ngrok)"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
          />
          <input
            type="text"
            placeholder="URL (ví dụ: https://abcd.ngrok-free.app)"
            value={domainUrl}
            onChange={(e) => setDomainUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowForm(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-white/10 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-primary via-primary-fixed to-primary-fixed-dim text-on-primary text-xs font-extrabold border border-primary/70 shadow-xs hover:brightness-110 active:scale-95 transition-all"
            >
              Lưu Máy chủ
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {domains.map((domain) => {
          const isActive = domain.id === activeDomainId;
          const isTesting = domain.id === testingId;

          return (
            <div
              key={domain.id}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                isActive
                  ? 'bg-primary/20 border-primary/50 text-on-surface shadow-xs'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-on-surface'
              }`}
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate">{domain.name}</span>
                  {isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                      Đang dùng
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-on-surface-variant/70 truncate mt-0.5">{domain.url}</div>
              </div>

              <div className="flex items-center gap-1.5">
                {!isActive && (
                  <button
                    onClick={() => handleSelectDomain(domain.id)}
                    disabled={isTesting}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest hover:bg-primary hover:text-on-primary text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Kết nối
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingId(domain.id);
                    setDomainName(domain.name);
                    setDomainUrl(domain.url);
                    setShowForm(true);
                  }}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-highest"
                  title="Sửa"
                >
                  <Edit3 size={14} />
                </button>
                {domains.length > 1 && (
                  <button
                    onClick={() => removeDomain(domain.id)}
                    className="p-1.5 rounded-lg text-error hover:bg-error/10"
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
