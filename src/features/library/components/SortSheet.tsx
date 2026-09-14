import React, { useState, useEffect } from 'react';
import { X, Check, ArrowUpDown, RotateCcw, Clock, Calendar } from 'lucide-react';
import { SortByField, SortOrderDirection } from '../../../stores/useLibraryStore';
import { BottomSheet } from '../../../components/BottomSheet';

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
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Sắp xếp danh sách"
      maxHeight="max-h-[85vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
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
            className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
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
      <div className="p-3.5 space-y-2 overflow-y-auto hide-scrollbar flex-1 overscroll-contain">
        {SORT_OPTIONS.map((opt) => {
          const isSelected = currentOptionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.sortBy, opt.sortOrder)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all active:scale-[0.99] text-left ${
                isSelected
                  ? 'bg-primary/20 hover:bg-primary/25 border-2 border-primary text-primary shadow-xs'
                  : 'bg-surface-container hover:bg-surface-container-high border-2 border-outline-variant/50 hover:border-primary/60 text-on-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-primary/30 border border-primary/70 text-primary font-extrabold'
                      : 'bg-primary/10 border border-primary/30 text-primary'
                  }`}
                >
                  {opt.icon}
                </div>
                <div>
                  <div className={`text-xs font-extrabold leading-snug ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{opt.label}</div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      isSelected ? 'text-primary/90 font-medium' : 'text-on-surface-variant/70'
                    }`}
                  >
                    {opt.description}
                  </div>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-primary/30 border border-primary/70 text-primary font-bold' : 'border border-outline-variant/60'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Action */}
      <div className="p-3.5 border-t border-outline-variant/30 bg-surface-container-high flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl bg-surface-container hover:bg-surface border-2 border-outline-variant/50 text-on-surface text-xs font-bold active:scale-95 transition-all"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 py-2.5 rounded-xl bg-primary/25 hover:bg-primary/35 backdrop-blur-md border-2 border-primary/70 text-primary text-xs font-extrabold shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] active:scale-95 transition-all"
        >
          Áp dụng
        </button>
      </div>
    </BottomSheet>
  );
}

