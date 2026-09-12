import React, { useState, useEffect } from 'react';
import { X, Check, ArrowUpDown, RotateCcw, Clock, ArrowDownAZ, ArrowUpAZ, Calendar, BookOpen } from 'lucide-react';
import { SortByField, SortOrderDirection } from '../../../stores/useLibraryStore';

export interface SortOption {
  id: string;
  sortBy: SortByField;
  sortOrder: SortOrderDirection;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export const SORT_OPTIONS: SortOption[] = [
  {
    id: 'createdAt-DESC',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    label: 'Mới thêm vào thư viện',
    description: 'Truyện mới được tạo / thêm gần đây',
    icon: <Calendar size={16} />,
  },
  {
    id: 'updatedAt-DESC',
    sortBy: 'updatedAt',
    sortOrder: 'DESC',
    label: 'Mới cập nhật gần nhất',
    description: 'Ưu tiên truyện có chương dịch mới cập nhật',
    icon: <Clock size={16} />,
  },
];

interface SortSheetProps {
  isOpen: boolean;
  currentSortBy: SortByField;
  currentSortOrder: SortOrderDirection;
  defaultSortBy?: SortByField;
  defaultSortOrder?: SortOrderDirection;
  onApply: (sortBy: SortByField, sortOrder: SortOrderDirection) => void;
  onClose: () => void;
}

export function SortSheet({
  isOpen,
  currentSortBy,
  currentSortOrder,
  defaultSortBy = 'createdAt',
  defaultSortOrder = 'DESC',
  onApply,
  onClose,
}: SortSheetProps) {
  const [draftSortBy, setDraftSortBy] = useState<SortByField>(currentSortBy);
  const [draftSortOrder, setDraftSortOrder] = useState<SortOrderDirection>(currentSortOrder);

  useEffect(() => {
    if (isOpen) {
      setDraftSortBy(currentSortBy);
      setDraftSortOrder(currentSortOrder);
    }
  }, [isOpen, currentSortBy, currentSortOrder]);

  if (!isOpen) return null;

  const currentOptionId = `${draftSortBy}-${draftSortOrder}`;

  const handleSelect = (sortBy: SortByField, sortOrder: SortOrderDirection) => {
    setDraftSortBy(sortBy);
    setDraftSortOrder(sortOrder);
  };

  const handleReset = () => {
    setDraftSortBy(defaultSortBy);
    setDraftSortOrder(defaultSortOrder);
  };

  const handleApply = () => {
    onApply(draftSortBy, draftSortOrder);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sort-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900/40 dark:bg-slate-900/40 backdrop-blur-xl border-t sm:border border-white/20 dark:border-white/20 rounded-t-3xl shadow-[0_16px_40px_rgba(0,0,0,0.5),_inset_0_1px_1.5px_0_rgba(255,255,255,0.5)] flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center">
              <ArrowUpDown size={16} />
            </div>
            <div>
              <h2 id="sort-sheet-title" className="text-sm font-bold text-on-surface">
                Sắp xếp danh sách
              </h2>
              <p className="text-[10px] text-on-surface-variant">Chọn tiêu chí hiển thị truyện</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
              title="Đặt lại mặc định"
            >
              <RotateCcw size={12} />
              <span>Mặc định</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-white/10 transition-colors"
              title="Đóng"
              aria-label="Đóng bảng sắp xếp"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Options List */}
        <div className="p-3.5 space-y-2 overflow-y-auto flex-1 overscroll-contain">
          {SORT_OPTIONS.map((opt) => {
            const isSelected = currentOptionId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.sortBy, opt.sortOrder)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.99] text-left ${
                  isSelected
                    ? 'bg-amber-400/20 hover:bg-amber-400/25 backdrop-blur-md border-2 border-amber-400 text-amber-300 shadow-[0_4px_20px_rgba(245,158,11,0.35),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)]'
                    : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border-2 border-outline-variant/60 hover:border-amber-400/80 text-on-surface'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-amber-400/30 border border-amber-400/70 text-amber-300 font-extrabold'
                        : 'bg-amber-400/10 border border-amber-400/30 text-amber-400'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <div>
                    <div className={`text-xs font-extrabold leading-snug ${isSelected ? 'text-amber-300 drop-shadow-xs' : 'text-on-surface'}`}>{opt.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        isSelected ? 'text-amber-200/90 font-medium' : 'text-on-surface-variant/70'
                      }`}
                    >
                      {opt.description}
                    </div>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-amber-400/30 border border-amber-400/70 text-amber-300 font-bold' : 'border border-white/30'
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="p-3.5 border-t border-white/10 bg-white/5 backdrop-blur-xs flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-on-surface-variant hover:bg-white/10 active:scale-95 transition-all"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-black text-xs font-extrabold border border-amber-300/70 shadow-[0_4px_16px_rgba(245,158,11,0.5)] hover:brightness-110 active:scale-95 transition-all"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
