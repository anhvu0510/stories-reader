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
  {
    id: 'updatedAt-ASC',
    sortBy: 'updatedAt',
    sortOrder: 'ASC',
    label: 'Cập nhật cũ nhất',
    description: 'Truyện cập nhật lâu nhất lên trước',
    icon: <Calendar size={16} />,
  },
  {
    id: 'bookName-ASC',
    sortBy: 'bookName',
    sortOrder: 'ASC',
    label: 'Tên truyện (A → Z)',
    description: 'Sắp xếp theo thứ tự bảng chữ cái tiếng Việt',
    icon: <ArrowDownAZ size={16} />,
  },
  {
    id: 'bookName-DESC',
    sortBy: 'bookName',
    sortOrder: 'DESC',
    label: 'Tên truyện (Z → A)',
    description: 'Sắp xếp ngược bảng chữ cái tiếng Việt',
    icon: <ArrowUpAZ size={16} />,
  },
  {
    id: 'lastedReadAt-DESC',
    sortBy: 'lastedReadAt',
    sortOrder: 'DESC',
    label: 'Lần đọc gần nhất',
    description: 'Truyện bạn vừa đọc gần đây nhất',
    icon: <BookOpen size={16} />,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border-t border-outline-variant/30 rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
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
              className="px-2.5 py-1 text-xs font-semibold text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1"
              title="Đặt lại mặc định"
            >
              <RotateCcw size={12} />
              <span>Mặc định</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container transition-colors"
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
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-surface-container/50 border-outline-variant/30 text-on-surface hover:bg-surface-container hover:border-outline-variant/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-snug">{opt.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        isSelected ? 'text-primary/80 font-medium' : 'text-on-surface-variant/70'
                      }`}
                    >
                      {opt.description}
                    </div>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-primary text-on-primary' : 'border border-outline-variant/40'
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="p-3.5 border-t border-outline-variant/20 bg-surface/95 backdrop-blur-xs flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 active:scale-95 transition-all"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
