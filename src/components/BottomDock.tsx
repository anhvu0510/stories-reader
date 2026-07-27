import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, X, Check, Minus, Plus } from 'lucide-react';

interface BottomDockProps {
  page?: number;
  totalPages?: number;
  total?: number;
  loading?: boolean;
  onPageChange?: (newPage: number) => void;
}

export function BottomDock({
  page = 1,
  totalPages = 1,
  total = 0,
  loading = false,
  onPageChange,
}: BottomDockProps) {
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [targetPage, setTargetPage] = useState<number>(page);

  useEffect(() => {
    setTargetPage(page);
  }, [page]);

  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const handleGoToPage = (target: number) => {
    const validTarget = Math.max(1, Math.min(target, totalPages));
    if (validTarget !== page && onPageChange) {
      onPageChange(validTarget);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setShowPagePicker(false);
  };


  return (
    <>
      <nav className="fixed bottom-4 left-0 right-0 z-40 w-full max-w-md mx-auto px-4 pointer-events-none box-border overflow-x-hidden transition-colors duration-200">
        <div className="bg-surface-container-high/95 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl rounded-full px-2.5 py-1.5 flex items-center justify-between pointer-events-auto transform-gpu transition-all duration-200 gap-2">
          {/* Prev Page Button (Rich "Trang X" format) */}
          <button
            onClick={() => {
              if (canPrev && onPageChange) {
                onPageChange(page - 1);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
            }}
            disabled={!canPrev}
            className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-xs font-extrabold shadow-sm active:scale-95 ${
              canPrev
                ? 'bg-primary text-on-primary hover:opacity-90'
                : 'bg-surface-container text-on-surface-variant/30 cursor-not-allowed border border-transparent'
            }`}
            title="Trang trước"
          >
            <ChevronLeft size={16} />
            <span>Trang {page > 1 ? page - 1 : 1}</span>
          </button>

          {/* Vertical Divider */}
          <div className="w-[1px] h-4.5 bg-white/25 shadow-xs shrink-0" />

          {/* Center Interactive Page Indicator Pill */}
          <button
            onClick={() => {
              setTargetPage(page);
              setShowPagePicker(true);
            }}
            className="flex-1 min-w-0 px-2 py-1 rounded-2xl bg-surface border border-outline-variant/20 hover:border-primary/40 text-center flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 group"
            title="Nhấp để chọn trang"
          >
            <div className="flex items-center justify-center gap-1 text-xs font-mono font-black text-primary truncate">
              <span>Trang {page}/{totalPages || 1}</span>
              <ChevronUp size={12} className="group-hover:-translate-y-0.5 transition-transform text-primary/70" />
            </div>
            {total > 0 && (
              <span className="text-[9.5px] font-mono text-on-surface-variant/70 block truncate leading-none mt-0.5">
                {total} truyện
              </span>
            )}
          </button>

          {/* Vertical Divider */}
          <div className="w-[1px] h-4.5 bg-white/25 shadow-xs shrink-0" />

          {/* Next Page Button (Rich "Trang X" format) */}
          <button
            onClick={() => {
              if (canNext && onPageChange) {
                onPageChange(page + 1);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
            }}
            disabled={!canNext}
            className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-xs font-extrabold shadow-sm active:scale-95 ${
              canNext
                ? 'bg-primary text-on-primary hover:opacity-90'
                : 'bg-surface-container text-on-surface-variant/30 cursor-not-allowed border border-transparent'
            }`}
            title="Trang sau"
          >
            <span>{page < totalPages ? `Trang ${page + 1}` : 'Trang sau'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </nav>

      {/* Mobile-Native Touch Bottom Sheet Page Picker */}
      {showPagePicker && (
        <div className="fixed inset-0 z-[95000] bg-black/75 flex justify-center items-end p-0 overflow-x-hidden box-border">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setShowPagePicker(false)} />

          {/* Touch Bottom Sheet */}
          <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[85dvh] overflow-y-auto hide-scrollbar transform-gpu transition-all duration-200 box-border">
            {/* Drag Handle & Header */}
            <div>
              <div className="w-10 h-1.5 rounded-full bg-outline-variant/50 mx-auto mb-3" />
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                <h3 className="text-sm font-black text-on-surface tracking-tight uppercase font-mono flex items-center gap-2">
                  <span>🚀</span> Nhảy Tới Trang
                </h3>
                <button
                  onClick={() => setShowPagePicker(false)}
                  className="p-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Big Target Page Badge */}
            <div className="text-center py-2 bg-surface-container-low rounded-2xl border border-outline-variant/20">
              <div className="text-2xl font-mono font-black text-primary">
                Trang {targetPage} <span className="text-xs text-on-surface-variant font-normal">/ {totalPages}</span>
              </div>
              <p className="text-[10px] font-mono text-on-surface-variant/70 mt-0.5">
                Vuốt slider hoặc chọn mốc nhanh bên dưới
              </p>
            </div>

            {/* Stepper Buttons & Range Slider */}
            <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20">
              <button
                onClick={() => setTargetPage((prev) => Math.max(1, prev - 1))}
                disabled={targetPage <= 1}
                className="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface disabled:opacity-40 font-bold flex items-center justify-center active:scale-95 shrink-0"
              >
                <Minus size={18} />
              </button>

              <input
                type="range"
                min={1}
                max={totalPages}
                value={targetPage}
                onChange={(e) => setTargetPage(Number(e.target.value))}
                className="flex-1 accent-primary bg-surface-container-highest h-2.5 rounded-lg cursor-pointer"
              />

              <button
                onClick={() => setTargetPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={targetPage >= totalPages}
                className="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface disabled:opacity-40 font-bold flex items-center justify-center active:scale-95 shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={() => handleGoToPage(targetPage)}
              className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-transform uppercase tracking-wider"
            >
              <Check size={18} strokeWidth={3} /> Trang {targetPage}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
