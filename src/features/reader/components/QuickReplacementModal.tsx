import React, { useState } from 'react';
import { X, Save, ArrowRight } from 'lucide-react';
import { ReplacementRepository } from '../../../repositories/ReplacementRepository';
import { useToastStore } from '../../../stores/useToastStore';

interface QuickReplacementModalProps {
  matchText: string;
  bookId?: string;
  chapterId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickReplacementModal({
  matchText,
  bookId,
  chapterId,
  onClose,
  onSuccess,
}: QuickReplacementModalProps) {
  const showToast = useToastStore((state) => state.showToast);
  const [replacement, setReplacement] = useState('');
  const [scope, setScope] = useState<'global' | 'book' | 'chapter'>('global');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!replacement.trim()) return;
    setIsSaving(true);
    try {
      await ReplacementRepository.addReplacement({
        match: matchText,
        replacement: replacement.trim(),
        scope,
        bookId: scope === 'book' ? bookId : undefined,
        chapterId: scope === 'chapter' ? chapterId : undefined,
      });
      showToast(`Đã thêm từ thay thế: "${matchText}" -> "${replacement.trim()}"`, 'success');
      onSuccess();
      onClose();
    } catch {
      showToast('Lỗi khi thêm từ thay thế', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl border border-outline-variant/30 p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-on-surface">Thay thế Từ Nhanh</h3>
          <button onClick={onClose} className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high">
            <X size={16} />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20 flex items-center justify-between text-xs">
          <span className="font-semibold text-on-surface">{matchText}</span>
          <ArrowRight size={14} className="text-on-surface-variant/50" />
          <input
            type="text"
            placeholder="Nhập từ thay thế..."
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            autoFocus
            className="px-2 py-1 rounded bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium text-primary w-32"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-on-surface-variant">Phạm vi:</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="px-2 py-1 rounded bg-surface-container border border-outline-variant/30 text-xs text-on-surface"
          >
            <option value="global">Toàn bộ truyện</option>
            <option value="book">Chỉ cuốn sách này</option>
            <option value="chapter">Chỉ chương này</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !replacement.trim()}
            className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Lưu Từ
          </button>
        </div>
      </div>
    </div>
  );
}
