import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit3, ArrowRight, Loader2, Save } from 'lucide-react';
import { ReplacementRepository } from '../../../repositories/ReplacementRepository';
import { Replacement } from '../../../shared/types';
import { useToastStore } from '../../../stores/useToastStore';

interface ReplacementsTabProps {
  initialMatch?: string;
  currentBookId?: string;
  currentChapterId?: string;
}

export function ReplacementsTab({ initialMatch = '', currentBookId, currentChapterId }: ReplacementsTabProps) {
  const showToast = useToastStore((state) => state.showToast);
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'chapter' | 'book' | 'global'>('all');

  const [matchStr, setMatchStr] = useState(initialMatch);
  const [replacementStr, setReplacementStr] = useState('');
  const [scope, setScope] = useState<'chapter' | 'book' | 'global'>('global');
  const [isSaving, setIsSaving] = useState(false);

  const loadReplacements = async () => {
    setLoading(true);
    try {
      const data = await ReplacementRepository.getReplacements();
      setReplacements(data);
    } catch {
      showToast('Lỗi khi tải từ điển', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplacements();
  }, []);

  const handleAdd = async () => {
    if (!matchStr.trim() || !replacementStr.trim()) {
      showToast('Vui lòng nhập từ gốc và từ thay thế', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await ReplacementRepository.addReplacement({
        match: matchStr.trim(),
        replacement: replacementStr.trim(),
        scope,
        bookId: scope === 'book' ? currentBookId : undefined,
        chapterId: scope === 'chapter' ? currentChapterId : undefined,
      });
      showToast('Đã thêm từ thay thế', 'success');
      setMatchStr('');
      setReplacementStr('');
      loadReplacements();
    } catch {
      showToast('Lỗi khi lưu từ thay thế', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ReplacementRepository.deleteReplacement(id);
      showToast('Đã xóa quy tắc', 'success');
      setReplacements((prev) => prev.filter((r) => r.id !== id));
    } catch {
      showToast('Lỗi khi xóa quy tắc', 'error');
    }
  };

  const filtered = replacements.filter((r) => {
    if (scopeFilter !== 'all' && r.scope !== scopeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return r.match.toLowerCase().includes(q) || r.replacement.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Form thêm mới */}
      <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 space-y-3">
        <div className="text-xs font-semibold text-on-surface">Thêm từ thay thế mới</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Từ gốc (ví dụ: tiểu tử)"
            value={matchStr}
            onChange={(e) => setMatchStr(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-outline-variant/30 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Từ thay thế (ví dụ: nhóc con)"
            value={replacementStr}
            onChange={(e) => setReplacementStr(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-outline-variant/30 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant/30 text-xs text-on-surface"
          >
            <option value="global">Tất cả truyện (Global)</option>
            <option value="book">Chỉ truyện này (Book)</option>
            <option value="chapter">Chỉ chương này (Chapter)</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-all flex items-center gap-1"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />} Thêm từ
          </button>
        </div>
      </div>

      {/* Tìm kiếm & Lọc */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="text"
            placeholder="Tìm kiếm từ gốc/thay thế..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface"
        >
          <option value="all">Tất cả Phạm vi</option>
          <option value="global">Global</option>
          <option value="book">Book</option>
          <option value="chapter">Chapter</option>
        </select>
      </div>

      {/* Danh sách quy tắc */}
      {loading ? (
        <div className="py-8 text-center text-xs text-on-surface-variant flex justify-center items-center gap-2">
          <Loader2 size={16} className="animate-spin text-primary" /> Đang tải từ điển...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-on-surface-variant/60">Không tìm thấy từ thay thế nào</div>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center justify-between text-xs hover:bg-surface-container-high transition-all"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium text-on-surface truncate">{item.match}</span>
                <ArrowRight size={12} className="text-on-surface-variant/50 flex-shrink-0" />
                <span className="font-medium text-primary truncate">{item.replacement}</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[10px] text-on-surface-variant capitalize">
                  {item.scope}
                </span>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1 rounded text-error hover:bg-error/10 ml-2"
                title="Xóa"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
