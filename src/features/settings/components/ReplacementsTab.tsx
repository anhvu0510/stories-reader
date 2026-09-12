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
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
        <div className="text-xs font-bold text-on-surface">Thêm từ thay thế mới</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Từ gốc (ví dụ: tiểu tử)"
            value={matchStr}
            onChange={(e) => setMatchStr(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
          />
          <input
            type="text"
            placeholder="Từ thay thế (ví dụ: nhóc con)"
            value={replacementStr}
            onChange={(e) => setReplacementStr(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/15">
            {[
              { id: 'global', label: 'Global' },
              { id: 'book', label: 'Book' },
              { id: 'chapter', label: 'Chapter' },
            ].map((item) => {
              const isActive = scope === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScope(item.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    isActive
                      ? 'bg-primary/20 border border-primary/60 text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10 border border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleAdd}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-primary via-primary-fixed to-primary-fixed-dim text-on-primary text-xs font-extrabold border border-primary/70 shadow-xs hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 shrink-0"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />} Thêm từ
          </button>
        </div>
      </div>

      {/* Tìm kiếm & Lọc */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="text"
            placeholder="Tìm kiếm từ gốc/thay thế..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/60 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)] transition-all"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/15 shrink-0 overflow-x-auto hide-scrollbar">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'global', label: 'Global' },
            { id: 'book', label: 'Book' },
            { id: 'chapter', label: 'Chapter' },
          ].map((item) => {
            const isActive = scopeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScopeFilter(item.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                  isActive
                    ? 'bg-primary/20 border border-primary/60 text-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/10 border border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách quy tắc */}
      {loading ? (
        <div className="py-8 text-center text-xs text-on-surface-variant flex justify-center items-center gap-2">
          <Loader2 size={16} className="animate-spin text-primary" /> Đang tải từ điển...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-on-surface-variant/60">Không tìm thấy từ thay thế nào</div>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 hide-scrollbar">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between text-xs transition-all shadow-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-bold text-on-surface truncate">{item.match}</span>
                <ArrowRight size={12} className="text-on-surface-variant/50 flex-shrink-0" />
                <span className="font-extrabold text-primary truncate">{item.replacement}</span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-mono text-on-surface-variant capitalize">
                  {item.scope}
                </span>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors ml-2"
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
